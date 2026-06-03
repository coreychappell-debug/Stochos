#!/usr/bin/env python3
import os
import sys
import datetime
import smtplib
import re
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import psycopg2

# Path configurations
ENV_PATHS = [
    "./.env.local",
    "./.env",
    "../.env.local",
    "../.env",
    "/mnt/c/Users/corey/Downloads/Corey - Code Stuff/R Server Project folder/New York Scripts and Process/stochos-platform/.env.local",
    "/mnt/c/Users/corey/Downloads/Corey - Code Stuff/R Server Project folder/New York Scripts and Process/stochos-platform/.env",
    "/srv/stochos/analyst_lab/stochos-platform/.env.local",
    "/srv/stochos/analyst_lab/stochos-platform/.env"
]

WATCHDOG_LOG_PATHS = [
    "/mnt/c/Users/corey/Downloads/Corey - Code Stuff/R Server Project folder/New York Scripts and Process/watchdog.log",
    "/srv/stochos/logs/watchdog.log"
]

MAINTENANCE_LOG_PATHS = [
    "/srv/stochos/logs/stochos-weekly-maintenance.log"
]

NY_INGEST_LOG_PATHS = [
    "/srv/stochos/logs/ny_refresh.log"
]

DUCKDB_REFRESH_LOG_PATHS = [
    "/srv/stochos/logs/ny_duckdb_refresh.log"
]

GEODATA_LOG_PATHS = [
    "/srv/stochos/logs/geodata_audit.log"
]

OBSERVABILITY_PLATFORM_LOG_PATHS = [
    "/mnt/c/Users/corey/Downloads/Corey - Code Stuff/R Server Project folder/New York Scripts and Process/stochos-platform/logs/observability.log",
    "./logs/observability.log",
    "/srv/stochos/analyst_lab/stochos-platform/logs/observability.log"
]

OBSERVABILITY_SHINY_LOG_PATHS = [
    "/srv/stochos/logs/observability_shiny.log"
]

def load_dotenv():
    """Load environment variables from env files without external dependencies."""
    loaded = False
    for path in ENV_PATHS:
        if os.path.exists(path):
            with open(path, "r") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    parts = line.split("=", 1)
                    if len(parts) == 2:
                        key = parts[0].strip()
                        val = parts[1].strip().strip('"').strip("'")
                        os.environ[key] = val
            print(f"Loaded configuration from: {path}")
            loaded = True
            break
    return loaded

def get_db_stats():
    """Queries PostgreSQL database for geodata and retailer statistics."""
    conn_str = os.environ.get("DATABASE_URL", "postgresql://stochos:stochos_dev_2026@127.0.0.1:5433/stochos_platform")
    if "localhost" in conn_str:
        conn_str = conn_str.replace("localhost", "127.0.0.1")
        
    stats = {}
    try:
        conn = psycopg2.connect(conn_str)
        cur = conn.cursor()
        
        # 1. Total Retailers
        cur.execute("SELECT COUNT(*) FROM crm_retailers;")
        stats["total_retailers"] = cur.fetchone()[0]
        
        # 2. Geodata Status Counts
        cur.execute("""
            SELECT 
                COALESCE(geodata_status, 'unknown'), 
                COUNT(*) 
            FROM crm_retailers 
            GROUP BY geodata_status;
        """)
        status_counts = dict(cur.fetchall())
        stats["verified"] = status_counts.get("verified", 0)
        stats["mismatch"] = status_counts.get("mismatch", 0)
        stats["unmatched"] = status_counts.get("unmatched", 0)
        stats["unknown"] = status_counts.get("unknown", 0)
        
        # 3. Overrides & Flags
        cur.execute("SELECT COUNT(*) FROM crm_retailers WHERE geodata_bypassed = TRUE;")
        stats["bypassed"] = cur.fetchone()[0]
        
        cur.execute("SELECT COUNT(*) FROM crm_retailers WHERE geodata_host_correction_requested = TRUE;")
        stats["host_corrections"] = cur.fetchone()[0]
        
        # 4. Audits in last 24h
        cur.execute("SELECT COUNT(*) FROM crm_retailers WHERE geodata_last_checked >= NOW() - INTERVAL '24 hours';")
        stats["audited_24h"] = cur.fetchone()[0]
        
        conn.close()
    except Exception as e:
        print(f"Database statistics query failed: {e}")
        stats = None
        
    return stats

def get_ews_health():
    """Checks DuckDB for the last successful EWS run and determines if it is stale (> 2 hours old)."""
    db_path = "/srv/stochos/data/duckdb/stochos_lottery.duckdb"
    health = {
        "status": "success",
        "last_run_time": "Unknown",
        "last_run_id": "None",
        "details": "No runs recorded."
    }
    
    if not os.path.exists(db_path):
        health["status"] = "failure"
        health["details"] = f"DuckDB file not found at {db_path}"
        return health
        
    try:
        import duckdb
        con = duckdb.connect(db_path, read_only=True)
        res = con.execute("SELECT run_id, ingest_timestamp FROM ny_retailer_risk_history ORDER BY ingest_timestamp DESC LIMIT 1;").fetchone()
        con.close()
        
        if res:
            run_id, ingest_timestamp = res[0], res[1]
            health["last_run_id"] = run_id
            
            if isinstance(ingest_timestamp, str):
                try:
                    dt = datetime.datetime.strptime(ingest_timestamp.split(".")[0], "%Y-%m-%d %H:%M:%S")
                except ValueError:
                    dt = None
            else:
                dt = ingest_timestamp
                
            if dt:
                health["last_run_time"] = dt.strftime("%Y-%m-%d %H:%M:%S")
                now = datetime.datetime.now()
                diff = now - dt
                diff_hours = diff.total_seconds() / 3600.0
                
                if diff_hours > 2.0:
                    health["status"] = "warning"
                    health["details"] = f"EWS pipeline data is stale (last run was {diff_hours:.1f} hours ago)."
                else:
                    health["status"] = "success"
                    health["details"] = f"EWS pipeline is healthy. Last run: {run_id} ({diff_hours:.1f} hours ago)."
            else:
                health["last_run_time"] = str(ingest_timestamp)
                health["details"] = "EWS pipeline timestamp could not be parsed."
        else:
            health["status"] = "warning"
            health["details"] = "No run history found in ny_retailer_risk_history."
            
    except Exception as e:
        health["status"] = "failure"
        health["details"] = f"Failed to query EWS database health: {e}"
        
    return health

def parse_watchdog_logs():
    """Reads recent lines from watchdog log file to detect recovery warnings or errors."""
    log_content = []
    has_issues = False
    
    for path in WATCHDOG_LOG_PATHS:
        if os.path.exists(path):
            try:
                with open(path, "r") as f:
                    lines = f.readlines()
                recent_lines = lines[-40:] if len(lines) > 40 else lines
                for line in recent_lines:
                    line_str = line.strip()
                    if "[WARNING]" in line_str or "[ERROR]" in line_str or "[RESTART]" in line_str:
                        log_content.append(line_str)
                        has_issues = True
                break
            except Exception as e:
                print(f"Error reading watchdog log at {path}: {e}")
                
    return log_content, has_issues

def parse_maintenance_logs():
    """Parses the weekly maintenance and backup logs."""
    log_summary = "No maintenance log file found or log is empty."
    status = "unknown"
    details = []
    
    for path in MAINTENANCE_LOG_PATHS:
        if os.path.exists(path):
            try:
                with open(path, "r") as f:
                    lines = f.readlines()
                if not lines:
                    break
                
                # Find the start of the last run
                start_idx = 0
                for idx, line in enumerate(reversed(lines)):
                    if "Starting weekly maintenance:" in line:
                        start_idx = len(lines) - 1 - idx
                        break
                
                last_run_lines = lines[start_idx:]
                details = [line.strip() for line in last_run_lines if line.strip()]
                log_summary = "\n".join(details)
                
                # Check status
                complete = any("Weekly maintenance COMPLETE" in line for line in last_run_lines)
                has_errors = any(
                    "unknown command" in line.lower() or 
                    "failed" in line.lower() or 
                    "error" in line.lower() 
                    for line in last_run_lines
                )
                
                if complete and not has_errors:
                    status = "success"
                elif complete and has_errors:
                    status = "warning"
                else:
                    status = "failure"
                break
            except Exception as e:
                print(f"Error reading maintenance log at {path}: {e}")
                
    return log_summary, status

def parse_ny_ingest_logs():
    """Parses the raw New York data download and ingest logs."""
    log_summary = "No ingest log file found or log is empty."
    status = "unknown"
    
    for path in NY_INGEST_LOG_PATHS:
        if os.path.exists(path):
            try:
                with open(path, "r") as f:
                    lines = f.readlines()
                if not lines:
                    break
                
                # Get the last line that isn't empty
                non_empty = [line.strip() for line in lines if line.strip()]
                if non_empty:
                    last_line = non_empty[-1]
                    log_summary = last_line
                    
                    # Parse: "NY refresh complete. Downloaded: 11. Errors: 0."
                    match = re.search(r"Downloaded:\s*(\d+)\.\s*Errors:\s*(\d+)", last_line)
                    if match:
                        downloads = int(match.group(1))
                        errors = int(match.group(2))
                        if errors == 0:
                            status = "success"
                        else:
                            status = "failure"
                    elif "error" in last_line.lower() or "failed" in last_line.lower():
                        status = "failure"
                    else:
                        status = "success"
                break
            except Exception as e:
                print(f"Error reading ingest log at {path}: {e}")
                
    return log_summary, status

def parse_duckdb_refresh_logs():
    """Parses the DuckDB analytics refresh / marts rebuild logs."""
    log_summary = "No DuckDB refresh log file found or log is empty."
    status = "unknown"
    net_contrib = "Unknown"
    
    for path in DUCKDB_REFRESH_LOG_PATHS:
        if os.path.exists(path):
            try:
                with open(path, "r") as f:
                    lines = f.readlines()
                if not lines:
                    break
                
                # Retrieve from the reconciliation section if it exists
                reconcile_idx = -1
                for idx, line in enumerate(lines):
                    if "Final Multi-State Truth Reconciliation" in line:
                        reconcile_idx = idx
                        
                if reconcile_idx != -1:
                    last_block = lines[reconcile_idx:]
                    log_summary = "".join([line for line in last_block if line.strip()])
                    
                    # Extract PURE NET CONTRIBUTION
                    for line in last_block:
                        if "PURE NET CONTRIBUTION TO STATE:" in line:
                            net_contrib = line.split(":")[-1].strip()
                            break
                    status = "success"
                else:
                    # Generic fallback to last 15 lines
                    recent_lines = [line.strip() for line in lines[-15:] if line.strip()]
                    log_summary = "\n".join(recent_lines)
                    has_errors = any("error" in line.lower() or "failed" in line.lower() or "exception" in line.lower() for line in recent_lines)
                    status = "failure" if has_errors else "success"
                break
            except Exception as e:
                print(f"Error reading DuckDB refresh log at {path}: {e}")
                
    return log_summary, status, net_contrib

def parse_geodata_logs():
    """Reads geodata audit log files to confirm cron runs and counts."""
    log_summary = "No geodata audit log file found or log is empty."
    status = "unknown"
    
    for path in GEODATA_LOG_PATHS:
        if os.path.exists(path):
            try:
                with open(path, "r") as f:
                    lines = f.readlines()
                if lines:
                    recent_lines = [line.strip() for line in lines[-20:] if line.strip()]
                    log_summary = "\n".join(recent_lines)
                    
                    # Check for errors in the run summary line
                    has_errors = False
                    for line in reversed(recent_lines):
                        if "Geodata Audit Job Complete" in line or "Processed:" in line:
                            if "failed" in line.lower() and "0 failed" not in line.lower():
                                has_errors = True
                            break
                    status = "warning" if has_errors else "success"
                break
            except Exception as e:
                print(f"Error reading geodata log at {path}: {e}")
                
    return log_summary, status

def parse_observability_logs():
    """Reads Platform & Shiny observability JSON logs to capture recent errors and slow query telemetry."""
    status = "success"
    recent_entries = []
    
    # Target window: past 24 hours (UTC comparison)
    now = datetime.datetime.now(datetime.timezone.utc)
    cutoff = now - datetime.timedelta(hours=24)
    
    error_count = 0
    warning_count = 0
    
    # 1. Parse Platform Logs
    for path in OBSERVABILITY_PLATFORM_LOG_PATHS:
        if os.path.exists(path):
            try:
                with open(path, "r") as f:
                    for line in f:
                        line = line.strip()
                        if not line:
                            continue
                        try:
                            import json
                            entry = json.loads(line)
                            ts_str = entry.get("timestamp", "")
                            if ts_str.endswith("Z"):
                                ts_str = ts_str[:-1] + "+00:00"
                            ts = datetime.datetime.fromisoformat(ts_str)
                            
                            if ts >= cutoff:
                                lvl = entry.get("level", "INFO")
                                msg = entry.get("message", "")
                                if lvl == "ERROR":
                                    error_count += 1
                                    recent_entries.append(f"🔴 [Platform] {msg}")
                                elif lvl == "WARN":
                                    warning_count += 1
                                    recent_entries.append(f"🟡 [Platform] {msg}")
                        except Exception:
                            pass
                break
            except Exception as e:
                print(f"Error reading platform observability log at {path}: {e}")
                
    # 2. Parse Shiny Logs
    for path in OBSERVABILITY_SHINY_LOG_PATHS:
        if os.path.exists(path):
            try:
                with open(path, "r") as f:
                    for line in f:
                        line = line.strip()
                        if not line:
                            continue
                        try:
                            import json
                            entry = json.loads(line)
                            ts_str = entry.get("timestamp", "")
                            if ts_str.endswith("Z"):
                                ts_str = ts_str[:-1] + "+00:00"
                            ts = datetime.datetime.fromisoformat(ts_str)
                            
                            if ts >= cutoff:
                                lvl = entry.get("level", "INFO")
                                msg = entry.get("message", "")
                                if lvl == "ERROR":
                                    error_count += 1
                                    recent_entries.append(f"🔴 [Shiny] {msg}")
                                elif lvl == "WARN":
                                    warning_count += 1
                                    recent_entries.append(f"🟡 [Shiny] {msg}")
                        except Exception:
                            pass
                break
            except Exception as e:
                print(f"Error reading Shiny observability log at {path}: {e}")

    # Limit to last 20 events to avoid bloating the email
    recent_entries = recent_entries[-20:]
    log_summary = "\n".join(recent_entries) if recent_entries else "No errors or warnings logged in the last 24 hours."
    
    if error_count > 0:
        status = "failure"
    elif warning_count > 0:
        status = "warning"
        
    return log_summary, status, error_count, warning_count

def build_email_body(stats, watchdog_alerts, has_watchdog_issues, 
                     maint_log, maint_status,
                     ingest_log, ingest_status,
                     duckdb_log, duckdb_status, net_contrib,
                     geodata_log, geodata_status, ews_health,
                     observability_log, observability_status):
    """Formats the system status metrics and job logs into a beautiful HTML email."""
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    # Check overall health status
    all_statuses = [maint_status, ingest_status, duckdb_status, geodata_status, ews_health["status"], observability_status]
    if has_watchdog_issues or "failure" in all_statuses or stats is None:
        status_badge = '<span style="background-color: #fef2f2; color: #dc2626; padding: 6px 12px; border-radius: 20px; font-weight: bold; font-size: 14px; border: 1px solid #f87171;">🔴 CRITICAL ALERT</span>'
        status_bg = '#fef2f2'
    elif "warning" in all_statuses:
        status_badge = '<span style="background-color: #fef3c7; color: #d97706; padding: 6px 12px; border-radius: 20px; font-weight: bold; font-size: 14px; border: 1px solid #f59e0b;">🟡 WARNINGS DETECTED</span>'
        status_bg = '#fffbeb'
    else:
        status_badge = '<span style="background-color: #d1fae5; color: #059669; padding: 6px 12px; border-radius: 20px; font-weight: bold; font-size: 14px; border: 1px solid #10b981;">🟢 SYSTEM HEALTHY</span>'
        status_bg = '#f0fdf4'
        
    # Helper for status lights
    def get_status_light(status):
        if status == "success":
            return '<span style="color: #22c55e; font-weight: bold;">🟢 SUCCESS</span>'
        elif status == "warning":
            return '<span style="color: #eab308; font-weight: bold;">🟡 WARNING</span>'
        elif status == "failure":
            return '<span style="color: #ef4444; font-weight: bold;">🔴 FAILURE</span>'
        return '<span style="color: #94a3b8; font-weight: bold;">⚪ UNKNOWN</span>'

    # Database summary table
    db_metrics_html = ""
    if stats:
        db_metrics_html = f"""
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-family: sans-serif; font-size: 13px;">
            <tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                <th style="padding: 10px; text-align: left; color: #475569; font-weight: 600;">Metric</th>
                <th style="padding: 10px; text-align: right; color: #475569; font-weight: 600; width: 100px;">Count</th>
                <th style="padding: 10px; text-align: right; color: #475569; font-weight: 600; width: 80px;">Ratio</th>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px; color: #0f172a; font-weight: bold;">Total Active Retailers</td>
                <td style="padding: 10px; text-align: right; color: #0f172a; font-weight: bold;">{stats['total_retailers']:,}</td>
                <td style="padding: 10px; text-align: right; color: #64748b;">100%</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px; color: #15803d;"><span style="display:inline-block; width:8px; height:8px; border-radius:50%; background-color:#22c55e; margin-right:8px;"></span>Verified Coordinates</td>
                <td style="padding: 10px; text-align: right; color: #15803d; font-weight: bold;">{stats['verified']:,}</td>
                <td style="padding: 10px; text-align: right; color: #15803d;">{(stats['verified']/stats['total_retailers']*100):.1f}%</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px; color: #b91c1c;"><span style="display:inline-block; width:8px; height:8px; border-radius:50%; background-color:#ef4444; margin-right:8px;"></span>Geodata Mismatches</td>
                <td style="padding: 10px; text-align: right; color: #b91c1c; font-weight: bold;">{stats['mismatch']:,}</td>
                <td style="padding: 10px; text-align: right; color: #b91c1c;">{(stats['mismatch']/stats['total_retailers']*100):.1f}%</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px; color: #d97706;"><span style="display:inline-block; width:8px; height:8px; border-radius:50%; background-color:#f59e0b; margin-right:8px;"></span>Unmatched Addresses</td>
                <td style="padding: 10px; text-align: right; color: #d97706; font-weight: bold;">{stats['unmatched']:,}</td>
                <td style="padding: 10px; text-align: right; color: #d97706;">{(stats['unmatched']/stats['total_retailers']*100):.1f}%</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px; color: #6d28d9;"><span style="display:inline-block; width:8px; height:8px; border-radius:50%; background-color:#8b5cf6; margin-right:8px;"></span>Bypassed ( Mall/Approved )</td>
                <td style="padding: 10px; text-align: right; color: #6d28d9; font-weight: bold;">{stats['bypassed']:,}</td>
                <td style="padding: 10px; text-align: right; color: #6d28d9;">{(stats['bypassed']/stats['total_retailers']*100):.1f}%</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px; color: #2563eb;"><span style="display:inline-block; width:8px; height:8px; border-radius:50%; background-color:#3b82f6; margin-right:8px;"></span>Pending Host Correction</td>
                <td style="padding: 10px; text-align: right; color: #2563eb; font-weight: bold;">{stats['host_corrections']:,}</td>
                <td style="padding: 10px; text-align: right; color: #2563eb;">{(stats['host_corrections']/stats['total_retailers']*100):.1f}%</td>
            </tr>
        </table>
        """
    else:
        db_metrics_html = '<p style="color: #b91c1c; font-weight: bold;">⚠️ Unable to query platform statistics from the PostgreSQL database.</p>'

    # Watchdog log alerts
    watchdog_html = ""
    if watchdog_alerts:
        alert_items = "".join([f'<li style="padding: 4px 0; color: #be185d;">{alert}</li>' for alert in watchdog_alerts])
        watchdog_html = f"""
        <div style="margin-top: 15px; padding: 12px; border-radius: 6px; border: 1px solid #fbcfe8; background-color: #fdf2f8;">
            <h4 style="margin: 0 0 5px 0; color: #be185d; font-family: sans-serif; font-size: 13px;">⚠️ Watchdog Alerts & Container Actions</h4>
            <ul style="margin: 0; padding-left: 15px; font-family: sans-serif; font-size: 12px;">
                {alert_items}
            </ul>
        </div>
        """

    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Stochos System Status Report</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: Arial, sans-serif;">
        <div style="max-width: 650px; margin: 20px auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); overflow: hidden; border: 1px solid #e4e4e7;">
            
            <!-- Header Banner -->
            <div style="background: linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%); padding: 25px 20px; text-align: center;">
                <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: bold; letter-spacing: 1px;">S T O C H O S</h1>
                <p style="margin: 5px 0 0 0; color: #93c5fd; font-size: 13px;">Automated Platform Status & Geodata Report</p>
            </div>
            
            <!-- Overall Health Status -->
            <div style="background-color: {status_bg}; padding: 12px 20px; border-bottom: 1px solid #e2e8f0; text-align: center;">
                {status_badge}
            </div>
            
            <!-- Body Content -->
            <div style="padding: 20px;">
                
                <!-- Section: Business & Database Stats -->
                <div style="margin-bottom: 20px; border-bottom: 1px solid #f1f5f9; padding-bottom: 20px;">
                    <h3 style="margin: 0 0 10px 0; color: #1e293b; font-size: 16px;">📊 Database & Geocoding Statistics</h3>
                    {db_metrics_html}
                    
                    <div style="margin-top: 12px; font-size: 13px; color: #475569; font-family: sans-serif;">
                        <strong>Analytical Contribution (NY):</strong> <span style="color: #2563eb; font-weight: bold;">{net_contrib}</span><br>
                        <strong>EWS Pipeline Status:</strong> <span style="color: {'#eab308' if ews_health['status'] == 'warning' else '#ef4444' if ews_health['status'] == 'failure' else '#16a34a'}; font-weight: bold;">{ews_health['details']}</span>
                    </div>
                    {watchdog_html}
                </div>
                
                <!-- Section: Server Jobs Status -->
                <div style="margin-bottom: 20px; border-bottom: 1px solid #f1f5f9; padding-bottom: 20px;">
                    <h3 style="margin: 0 0 15px 0; color: #1e293b; font-size: 16px;">🖥️ Server Jobs & Maintenance Status</h3>
                    
                    <table style="width: 100%; border-collapse: collapse; font-family: sans-serif; font-size: 13px;">
                        <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                            <th style="padding: 8px; text-align: left; color: #475569;">Server Cron Job</th>
                            <th style="padding: 8px; text-align: right; color: #475569; width: 120px;">Last Run Status</th>
                        </tr>
                        <tr style="border-bottom: 1px solid #f1f5f9;">
                            <td style="padding: 8px; color: #334155; font-weight: bold;">Weekly Server Maintenance & Backup</td>
                            <td style="padding: 8px; text-align: right;">{get_status_light(maint_status)}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #f1f5f9;">
                            <td style="padding: 8px; color: #334155; font-weight: bold;">New York Raw Ingest Pipeline (Download)</td>
                            <td style="padding: 8px; text-align: right;">{get_status_light(ingest_status)}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #f1f5f9;">
                            <td style="padding: 8px; color: #334155; font-weight: bold;">DuckDB Analytical Warehouse Refresh</td>
                            <td style="padding: 8px; text-align: right;">{get_status_light(duckdb_status)}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #f1f5f9;">
                            <td style="padding: 8px; color: #334155; font-weight: bold;">Nightly Retailer Geodata Audit (1,000 max)</td>
                            <td style="padding: 8px; text-align: right;">{get_status_light(geodata_status)}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #f1f5f9;">
                            <td style="padding: 8px; color: #334155; font-weight: bold;">Early Warning System (EWS) Risk Pipeline</td>
                            <td style="padding: 8px; text-align: right;">{get_status_light(ews_health["status"])}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #f1f5f9;">
                            <td style="padding: 8px; color: #334155; font-weight: bold;">Next.js & Shiny Observability Telemetry</td>
                            <td style="padding: 8px; text-align: right;">{get_status_light(observability_status)}</td>
                        </tr>
                    </table>
                </div>

                <!-- Section: Raw Log Snippets -->
                <div>
                    <h3 style="margin: 0 0 10px 0; color: #1e293b; font-size: 16px;">📋 Log Snippets & Outputs</h3>
                    
                    <!-- Maintenance Log -->
                    <div style="margin-top: 10px; border-radius: 6px; border: 1px solid #e2e8f0; overflow: hidden;">
                        <div style="background-color: #f8fafc; padding: 6px 10px; border-bottom: 1px solid #e2e8f0; font-size: 12px; color: #475569; font-weight: bold;">
                            stochos-weekly-maintenance.log
                        </div>
                        <pre style="margin: 0; padding: 10px; font-family: monospace; font-size: 11px; white-space: pre-wrap; color: #334155; max-height: 120px; overflow-y: auto; background-color: #fafafa;">{maint_log}</pre>
                    </div>

                    <!-- Ingest Log -->
                    <div style="margin-top: 10px; border-radius: 6px; border: 1px solid #e2e8f0; overflow: hidden;">
                        <div style="background-color: #f8fafc; padding: 6px 10px; border-bottom: 1px solid #e2e8f0; font-size: 12px; color: #475569; font-weight: bold;">
                            ny_refresh.log
                        </div>
                        <pre style="margin: 0; padding: 10px; font-family: monospace; font-size: 11px; white-space: pre-wrap; color: #334155; max-height: 80px; overflow-y: auto; background-color: #fafafa;">{ingest_log}</pre>
                    </div>

                    <!-- DuckDB Marts Log -->
                    <div style="margin-top: 10px; border-radius: 6px; border: 1px solid #e2e8f0; overflow: hidden;">
                        <div style="background-color: #f8fafc; padding: 6px 10px; border-bottom: 1px solid #e2e8f0; font-size: 12px; color: #475569; font-weight: bold;">
                            ny_duckdb_refresh.log (Truth Reconciliation Summary)
                        </div>
                        <pre style="margin: 0; padding: 10px; font-family: monospace; font-size: 11px; white-space: pre-wrap; color: #334155; max-height: 150px; overflow-y: auto; background-color: #fafafa;">{duckdb_log}</pre>
                    </div>

                    <!-- Geodata Audit Log -->
                    <div style="margin-top: 10px; border-radius: 6px; border: 1px solid #e2e8f0; overflow: hidden;">
                        <div style="background-color: #f8fafc; padding: 6px 10px; border-bottom: 1px solid #e2e8f0; font-size: 12px; color: #475569; font-weight: bold;">
                            geodata_audit.log
                        </div>
                        <pre style="margin: 0; padding: 10px; font-family: monospace; font-size: 11px; white-space: pre-wrap; color: #334155; max-height: 100px; overflow-y: auto; background-color: #fafafa;">{geodata_log}</pre>
                    </div>

                    <!-- Platform & Shiny Observability Log -->
                    <div style="margin-top: 10px; border-radius: 6px; border: 1px solid #e2e8f0; overflow: hidden;">
                        <div style="background-color: #f8fafc; padding: 6px 10px; border-bottom: 1px solid #e2e8f0; font-size: 12px; color: #475569; font-weight: bold;">
                            observability.log & observability_shiny.log (Recent Warnings/Errors)
                        </div>
                        <pre style="margin: 0; padding: 10px; font-family: monospace; font-size: 11px; white-space: pre-wrap; color: #334155; max-height: 150px; overflow-y: auto; background-color: #fafafa;">{observability_log}</pre>
                    </div>
                </div>

                <p style="margin-top: 25px; font-size: 11px; color: #94a3b8; text-align: center; font-family: sans-serif;">
                    Report generated automatically by Stochos daemon on {timestamp}.<br>
                    WSL Server Local Time. SMTP relay: coreychappell@thestochos.com.
                </p>
            </div>
            
        </div>
    </body>
    </html>
    """
    return html

def send_email(html_body, maint_status, ingest_status, duckdb_status, geodata_status, ews_status, observability_status, has_watchdog_issues):
    """Sends the status report via Google SMTP."""
    smtp_host = os.environ.get("SMTP_HOST", "smtp.gmail.com")
    try:
        smtp_port = int(os.environ.get("SMTP_PORT", 587))
    except ValueError:
        smtp_port = 587
        
    smtp_user = os.environ.get("SMTP_USER", "coreychappell@thestochos.com")
    smtp_pass = os.environ.get("SMTP_PASS")
    recipients_str = os.environ.get("REPORT_RECIPIENTS", "coreychappell@thestochos.com")
    recipients = [r.strip() for r in recipients_str.split(",") if r.strip()]
    
    if not smtp_pass:
        print("Error: SMTP_PASS is not configured. Email report skipped.")
        return False
        
    date_str = datetime.datetime.now().strftime("%Y-%m-%d")
    
    # Subject prefixes depending on status
    all_statuses = [maint_status, ingest_status, duckdb_status, geodata_status, ews_status, observability_status]
    if "failure" in all_statuses or has_watchdog_issues:
        subj_prefix = "🚨 [CRITICAL ALERT]"
    elif "warning" in all_statuses:
        subj_prefix = "⚠️ [WARNING]"
    else:
        subj_prefix = "📊 [OK]"
        
    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"{subj_prefix} Stochos Platform Uptime & Server Jobs Report - {date_str}"
    msg["From"] = f"Stochos Server <{smtp_user}>"
    msg["To"] = ", ".join(recipients)
    
    msg.attach(MIMEText("This report requires an HTML-capable email client to view.", "plain"))
    msg.attach(MIMEText(html_body, "html"))
    
    print(f"Connecting to SMTP server {smtp_host}:{smtp_port}...")
    try:
        server = smtplib.SMTP(smtp_host, smtp_port, timeout=15)
        server.ehlo()
        server.starttls()
        server.ehlo()
        print(f"Logging in as {smtp_user}...")
        server.login(smtp_user, smtp_pass)
        print(f"Sending status email to: {recipients}...")
        server.sendmail(smtp_user, recipients, msg.as_string())
        server.close()
        print("Status email sent successfully!")
        return True
    except Exception as e:
        print(f"SMTP error occurred: {e}")
        return False

def main():
    print(f"=== Starting System Status Reporter: {datetime.datetime.now()} ===")
    
    # 1. Load config from .env or .env.local
    if not load_dotenv():
        print("Warning: No .env configuration files could be found. Using system environment defaults.")
        
    # 2. Gather database stats
    print("Gathering database statistics...")
    stats = get_db_stats()
    
    # 3. Parse watchdog logs
    print("Parsing watchdog logs...")
    watchdog_alerts, has_watchdog_issues = parse_watchdog_logs()
    
    # 4. Parse server job logs
    print("Parsing maintenance logs...")
    maint_log, maint_status = parse_maintenance_logs()
    
    print("Parsing NY raw ingest logs...")
    ingest_log, ingest_status = parse_ny_ingest_logs()
    
    print("Parsing DuckDB refresh logs...")
    duckdb_log, duckdb_status, net_contrib = parse_duckdb_refresh_logs()
    
    print("Parsing geodata cron logs...")
    geodata_log, geodata_status = parse_geodata_logs()
    
    print("Checking EWS database health telemetry...")
    ews_health = get_ews_health()
    
    print("Parsing Next.js & R/Shiny observability logs...")
    observability_log, observability_status, error_count, warning_count = parse_observability_logs()
    
    # 5. Generate HTML email body
    print("Building HTML email body...")
    html_body = build_email_body(
        stats, 
        watchdog_alerts, has_watchdog_issues,
        maint_log, maint_status,
        ingest_log, ingest_status,
        duckdb_log, duckdb_status, net_contrib,
        geodata_log, geodata_status,
        ews_health,
        observability_log,
        observability_status
    )
    
    # 6. Dispatch email
    send_email(
        html_body, 
        maint_status, 
        ingest_status, 
        duckdb_status, 
        geodata_status, 
        ews_health["status"],
        observability_status,
        has_watchdog_issues
    )
    print("=== System Status Reporter Complete ===")

if __name__ == "__main__":
    main()
