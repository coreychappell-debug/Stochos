# Stochos Platform: API Keys & Credentials Reference Guide

This document catalogs all API keys, database secrets, and credentials used across the Stochos Platform. It details their purpose, configuration locations, rotation strategies, and security considerations.

---

## 1. NEXTAUTH_SECRET

* **Purpose:** signs and encrypts the JSON Web Tokens (JWT) used for browser session authentication.
* **Scope:** Transactional Web Application (Next.js Node Server).
* **Configuration File:** `stochos-platform/.env.local`
* **Variable Name:** `NEXTAUTH_SECRET`
* **Format:** Base64-encoded cryptographically secure random string.
* **Generation Method:**
  ```bash
  openssl rand -base64 32
  ```
* **Rotation Policy:** Rotate annually or immediately if a compromise is suspected. Rotating this secret will instantly invalidate all active user sessions, requiring all users to log back in.

---

## 2. DATABASE_URL

* **Purpose:** PostgreSQL transactional database connection string. Used for user profiles, CRM data, and audit logging.
* **Scope:** Next.js Application, database migrations, and telemetry reporter scripts.
* **Configuration File:** `stochos-platform/.env.local` and `stochos-platform/.env`
* **Variable Name:** `DATABASE_URL`
* **Format:**
  `postgresql://[username]:[password]@[host]:[port]/[database_name]`
* **Default Dev Value:** `postgresql://stochos:stochos_dev_2026@localhost:5433/stochos_platform`
* **Rotation Policy:** Password should be rotated every 180 days. Requires updating the PostgreSQL database user password and updating the `.env.local` variable on all running server nodes.

---

## 3. SMTP_PASS

* **Purpose:** SMTP authorization credential (e.g. Gmail App Password) for sending automated platform health reports, stale database pipeline warnings, and telemetry reports.
* **Scope:** `status_reporter.py` script.
* **Configuration File:** `stochos-platform/.env.local`
* **Variable Name:** `SMTP_PASS`
* **Rotation Policy:** Rotate Gmail App Passwords if email credentials or the Google account ownership changes. Gmail App Passwords must be generated through the Google Account Security portal under "App Passwords."

---

## 4. CENSUS_API_KEY

* **Purpose:** Authorizes queries to the US Census Bureau Data API to fetch annual American Community Survey (ACS) 5-Year county-level demographics.
* **Scope:** `ny_demographics_ingest.py` data ingestion script.
* **Configuration File:** `stochos-platform/.env.local`
* **Variable Name:** `CENSUS_API_KEY`
* **Format:** 40-character hexadecimal string.
* **Obtaining a Key:** Anyone can request a free API key instantly at [https://api.census.gov/data/key_signup.html](https://api.census.gov/data/key_signup.html).
* **Fallback Behavior:** If missing, the ingestion script defaults to the local/cached 2020 CORGIS county demographics CSV file, allowing the platform to run out-of-the-box without manual API key setup.
* **Rotation Policy:** None required unless leaked.
