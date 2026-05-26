#!/usr/bin/env python3
import os
import sys
import datetime
import smtplib
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

GEODATA_LOG_PATHS = [
    "/srv/stochos/logs/geodata_audit.log"
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
    # Force 127.0.0.1 loopback for WSL connection reliability
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

def parse_watchdog_logs():
    """Reads recent lines from watchdog log file to detect recovery warnings or errors."""
    log_content = []
    has_issues = False
    
    for path in WATCHDOG_LOG_PATHS:
        if os.path.exists(path):
            try:
                with open(path, "r") as f:
                    lines = f.readlines()
                # Grab last 40 lines
                recent_lines = lines[-40:] if len(lines) > 40 else lines
                for line in recent_lines:
                    # Look for warnings, errors, or restarts
                    line_str = line.strip()
                    if "[WARNING]" in line_str or "[ERROR]" in line_str or "[RESTART]" in line_str:
                        log_content.append(line_str)
                        has_issues = True
                break
            except Exception as e:
                print(f"Error reading watchdog log at {path}: {e}")
                
    return log_content, has_issues

def parse_geodata_logs():
    """Reads geodata audit log files to confirm cron runs and counts."""
    log_summary = "No geodata audit log file found or log is empty."
    has_errors = False
    
    for path in GEODATA_LOG_PATHS:
        if os.path.exists(path):
            try:
                with open(path, "r") as f:
                    lines = f.readlines()
                if lines:
                    # Gather the last run blocks
                    recent_lines = lines[-20:] if len(lines) > 20 else lines
                    log_summary = "\n".join([line.strip() for line in recent_lines])
                    for line in recent_lines:
                        if "failed" in line.lower() or "error" in line.lower():
                            # Ignore false positives like "0 failed"
                            if "0 failed" not in line.lower():
                                has_errors = True
                break
            except Exception as e:
                print(f"Error reading geodata log at {path}: {e}")
                
    return log_summary, has_errors

def build_email_body(stats, watchdog_alerts, has_watchdog_issues, geodata_summary, has_geodata_issues):
    """Formats the system status metrics into a beautiful HTML email."""
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    # Uptime status badge
    if has_watchdog_issues or stats is None:
        status_badge = '<span style="background-color: #fef3c7; color: #d97706; padding: 6px 12px; border-radius: 20px; font-weight: bold; font-size: 14px; border: 1px solid #f59e0b;">🟡 MAINTENANCE SUGGESTED</span>'
        status_bg = '#fffbeb'
    else:
        status_badge = '<span style="background-color: #d1fae5; color: #059669; padding: 6px 12px; border-radius: 20px; font-weight: bold; font-size: 14px; border: 1px solid #10b981;">🟢 SYSTEM HEALTHY</span>'
        status_bg = '#f0fdf4'
        
    db_metrics_html = ""
    if stats:
        db_metrics_html = f"""
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-family: sans-serif;">
            <tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                <th style="padding: 12px; text-align: left; color: #475569; font-weight: 600;">Metric</th>
                <th style="padding: 12px; text-align: right; color: #475569; font-weight: 600; width: 100px;">Count</th>
                <th style="padding: 12px; text-align: right; color: #475569; font-weight: 600; width: 100px;">Percentage</th>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 12px; color: #0f172a; font-weight: bold;">Total Active Retailers</td>
                <td style="padding: 12px; text-align: right; color: #0f172a; font-weight: bold;">{stats['total_retailers']:,}</td>
                <td style="padding: 12px; text-align: right; color: #64748b;">100.0%</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 12px; color: #15803d;"><span style="display:inline-block; width:10px; height:10px; border-radius:50%; background-color:#22c55e; margin-right:8px;"></span>Verified Coordinates</td>
                <td style="padding: 12px; text-align: right; color: #15803d; font-weight: bold;">{stats['verified']:,}</td>
                <td style="padding: 12px; text-align: right; color: #15803d;">{(stats['verified']/stats['total_retailers']*100):.1f}%</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 12px; color: #b91c1c;"><span style="display:inline-block; width:10px; height:10px; border-radius:50%; background-color:#ef4444; margin-right:8px;"></span>Geodata Mismatches</td>
                <td style="padding: 12px; text-align: right; color: #b91c1c; font-weight: bold;">{stats['mismatch']:,}</td>
                <td style="padding: 12px; text-align: right; color: #b91c1c;">{(stats['mismatch']/stats['total_retailers']*100):.1f}%</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 12px; color: #d97706;"><span style="display:inline-block; width:10px; height:10px; border-radius:50%; background-color:#f59e0b; margin-right:8px;"></span>Unmatched Addresses</td>
                <td style="padding: 12px; text-align: right; color: #d97706; font-weight: bold;">{stats['unmatched']:,}</td>
                <td style="padding: 12px; text-align: right; color: #d97706;">{(stats['unmatched']/stats['total_retailers']*100):.1f}%</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 12px; color: #6d28d9;"><span style="display:inline-block; width:10px; height:10px; border-radius:50%; background-color:#8b5cf6; margin-right:8px;"></span>Bypassed ( mall / accepted )</td>
                <td style="padding: 12px; text-align: right; color: #6d28d9; font-weight: bold;">{stats['bypassed']:,}</td>
                <td style="padding: 12px; text-align: right; color: #6d28d9;">{(stats['bypassed']/stats['total_retailers']*100):.1f}%</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 12px; color: #2563eb;"><span style="display:inline-block; width:10px; height:10px; border-radius:50%; background-color:#3b82f6; margin-right:8px;"></span>Pending Gaming Host Update</td>
                <td style="padding: 12px; text-align: right; color: #2563eb; font-weight: bold;">{stats['host_corrections']:,}</td>
                <td style="padding: 12px; text-align: right; color: #2563eb;">{(stats['host_corrections']/stats['total_retailers']*100):.1f}%</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9; background-color: #faf5ff;">
                <td style="padding: 12px; color: #4b5563; font-style: italic;">Audited (Last 24 Hours)</td>
                <td style="padding: 12px; text-align: right; color: #4b5563; font-weight: bold;">{stats['audited_24h']:,}</td>
                <td style="padding: 12px; text-align: right; color: #4b5563;">{(stats['audited_24h']/stats['total_retailers']*100):.1f}%</td>
            </tr>
        </table>
        """
    else:
        db_metrics_html = '<p style="color: #b91c1c; font-weight: bold;">⚠️ Unable to query platform statistics from the PostgreSQL database.</p>'

    watchdog_html = ""
    if watchdog_alerts:
        alert_items = "".join([f'<li style="padding: 6px 0; color: #475569; border-bottom: 1px dashed #f1f5f9;">{alert}</li>' for alert in watchdog_alerts])
        watchdog_html = f"""
        <div style="margin-top: 20px; padding: 15px; border-radius: 8px; border: 1px solid #fbcfe8; background-color: #fdf2f8;">
            <h4 style="margin: 0 0 10px 0; color: #be185d; font-family: sans-serif;">⚠️ Watchdog Recoveries & Warnings (Last 40 checks)</h4>
            <ul style="margin: 0; padding-left: 20px; font-family: sans-serif; font-size: 13px;">
                {alert_items}
            </ul>
        </div>
        """
    else:
        watchdog_html = """
        <div style="margin-top: 20px; padding: 15px; border-radius: 8px; border: 1px solid #bbf7d0; background-color: #f0fdf4;">
            <h4 style="margin: 0; color: #166534; font-family: sans-serif;">✓ Watchdog Service Health</h4>
            <p style="margin: 5px 0 0 0; color: #166534; font-size: 13px; font-family: sans-serif;">All server components (RStudio, Shiny, PostgreSQL, WSL VM) completed checks with zero faults or automated restarts.</p>
        </div>
        """

    geodata_audit_html = f"""
    <div style="margin-top: 20px; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; background-color: #f8fafc; font-family: monospace; font-size: 12px; white-space: pre-wrap; color: #334155; line-height: 1.5;">
        <h4 style="margin: 0 0 10px 0; color: #475569; font-family: sans-serif; font-size: 14px;">📋 Geodata Nightly Ingestion Log (Last Run)</h4>
{geodata_summary}
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
        <div style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); overflow: hidden; border: 1px solid #e4e4e7;">
            
            <!-- Header Banner -->
            <div style="background: linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%); padding: 30px 20px; text-align: center;">
                <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: bold; letter-spacing: 1px;">S T O C H O S</h1>
                <p style="margin: 5px 0 0 0; color: #93c5fd; font-size: 14px;">Automated Platform Status & Geodata Report</p>
            </div>
            
            <!-- Uptime Banner -->
            <div style="background-color: {status_bg}; padding: 15px 20px; border-bottom: 1px solid #e2e8f0; text-align: center;">
                {status_badge}
            </div>
            
            <!-- Body Content -->
            <div style="padding: 25px 20px;">
                
                <h3 style="margin-top: 0; color: #1e293b; font-family: sans-serif;">📊 Operational Statistics</h3>
                {db_metrics_html}
                
                {watchdog_html}
                
                {geodata_audit_html}
                
                <p style="margin-top: 25px; font-size: 11px; color: #94a3b8; text-align: center; font-family: sans-serif;">
                    Report generated automatically by Stochos daemon on {timestamp}.<br>
                    Sending Server: WSL2 Ubuntu on Windows Host (smtp.gmail.com).
                </p>
            </div>
            
        </div>
    </body>
    </html>
    """
    return html

def send_email(html_body):
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
    
    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"📊 Stochos Platform Uptime & Geodata Audit Report - {date_str}"
    msg["From"] = f"Stochos Server <{smtp_user}>"
    msg["To"] = ", ".join(recipients)
    
    msg.attach(MIMEText("This report requires an HTML-capable email client to view.", "plain"))
    msg.attach(MIMEText(html_body, "html"))
    
    print(f"Connecting to SMTP server {smtp_host}:{smtp_port}...")
    try:
        server = smtplib.SMTP(smtp_host, smtp_port, timeout=15)
        server.ehlo()
        server.starttls() # Enable security
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
    
    # 3. Parse logs
    print("Parsing watchdog logs...")
    watchdog_alerts, has_watchdog_issues = parse_watchdog_logs()
    
    print("Parsing geodata cron logs...")
    geodata_summary, has_geodata_issues = parse_geodata_logs()
    
    # 4. Generate HTML email body
    print("Building HTML email body...")
    html_body = build_email_body(
        stats, 
        watchdog_alerts, 
        has_watchdog_issues, 
        geodata_summary, 
        has_geodata_issues
    )
    
    # 5. Dispatch email
    send_email(html_body)
    print("=== System Status Reporter Complete ===")

if __name__ == "__main__":
    main()
