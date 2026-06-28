#!/usr/bin/env python3
import os
import sys
import datetime
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

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

def load_dotenv():
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
            loaded = True
            break
    return loaded

def send_alert(subject, log_path=None):
    load_dotenv()
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
        print("Error: SMTP_PASS not found. Skipping alert.")
        return False
        
    body_content = "A Stochos cron job failed to execute successfully.\n\n"
    body_content += f"Job Name/Subject: {subject}\n"
    body_content += f"Failure Time (UTC): {datetime.datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}\n\n"
    
    if log_path and os.path.exists(log_path):
        body_content += f"--- Last 30 lines of {os.path.basename(log_path)} ---\n"
        try:
            with open(log_path, "r") as f:
                lines = f.readlines()
            recent_lines = lines[-30:] if len(lines) > 30 else lines
            body_content += "".join(recent_lines)
        except Exception as e:
            body_content += f"Error reading log file: {e}\n"
    else:
        body_content += "No log file path provided or log file does not exist.\n"
        
    msg = MIMEMultipart()
    msg["Subject"] = f"🚨 [JOB FAILURE] {subject}"
    msg["From"] = f"Stochos System Daemon <{smtp_user}>"
    msg["To"] = ", ".join(recipients)
    msg.attach(MIMEText(body_content, "plain"))
    
    try:
        server = smtplib.SMTP(smtp_host, smtp_port, timeout=15)
        server.ehlo()
        server.starttls()
        server.ehlo()
        server.login(smtp_user, smtp_pass)
        server.sendmail(smtp_user, recipients, msg.as_string())
        server.close()
        print("Alert email dispatched successfully.")
        return True
    except Exception as e:
        print(f"Failed to send alert email: {e}")
        return False

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 send_alert.py '<Subject>' [<LogFilePath>]")
        sys.exit(1)
        
    subj = sys.argv[1]
    lpath = sys.argv[2] if len(sys.argv) > 2 else None
    send_alert(subj, lpath)
