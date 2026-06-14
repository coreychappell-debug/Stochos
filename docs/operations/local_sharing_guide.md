# Stochos Platform — Local Sharing and Team Access Guide
**Cost:** $0 (Free-tier open-source tools)  
**Security level:** Enterprise (AES-256 encrypted VPN tunnel + SSL certificates)  
**Purpose:** Explains how to securely share your local development machine with remote team members (Tyler and Caitlin) so they can access the Stochos Platform, RStudio, and Shiny Server using a real, encrypted HTTPS website domain without exposing ports to the public internet.

---

## Technical Architecture

```
  [ Caitlin's PC (Remote) ]     [ Tyler's PC (Remote) ]
             │                             │
             ▼ (Tailscale Private VPN)     ▼ (Tailscale Private VPN)
 ┌────────────────────────────────────────────────────────┐
 │                   Corey's PC (Host)                    │
 │                                                        │
 │                   [ Caddy Proxy ]                      │
 │                   (Port 80/443 HTTPS)                  │
 │                            │                           │
 │        ┌───────────────────┼───────────────────┐       │
 │        ▼ (Port 3000)       ▼ (Port 3838)       ▼ (8787)│
 │   ┌─────────┐         ┌───────────┐       ┌─────────┐  │
 │   │ Next.js │         │  Shiny    │       │ RStudio │  │
 │   └─────────┘         └───────────┘       └─────────┘  │
 └────────────────────────────────────────────────────────┘
```

Rather than deploying the app to an expensive cloud server, we configure Corey's machine to act as the host and use two industry-standard, free tools:
1. **Tailscale**: Connects Corey, Tyler, and Caitlin's computers into a secure, private network (a virtual mesh VPN).
2. **Caddy Web Server**: Runs on Corey's machine to handle reverse-proxying, port mappings, and automatically generate a valid Let's Encrypt HTTPS domain name (with the secure lock icon in the browser).

---

## Step 1: Set Up Tailscale (The Secure Network)

Tailscale handles the networking. It assigns Corey's machine a stable, private domain name that works from anywhere in the world (even if working from home) without doing dangerous router port-forwarding or disabling Windows Firewall.

1. **Sign Up**: Go to [tailscale.com](https://tailscale.com) and create a free account (free for up to 3 users and 100 devices).
2. **Install Tailscale**: Download and install Tailscale on **Corey's, Tyler's, and Caitlin's machines**.
3. **Log In**: Log in to the same Tailscale account on all three machines (or create a tailnet and invite Tyler and Caitlin to join as members).
4. **Retrieve Domain Name**:
   * Open the Tailscale client on Corey's machine or check the online admin console.
   * Note the machine's assigned **MagicDNS domain name** (e.g., `stochosgroup.tail88cba8.ts.net`).
5. **Enable HTTPS Certificates**:
   * In the Tailscale Admin Console, go to **Settings** > **HTTPS**.
   * Click **Enable HTTPS**. This allows Corey's machine to automatically request valid, free Let's Encrypt SSL/TLS certificates for its Tailscale domain name.

---

## Step 2: Set Up Caddy (The Web Portal & HTTPS)

Caddy acts as our web gateway. It listens on standard ports (`80` for HTTP and `443` for HTTPS) and routes traffic to our individual Next.js and Docker services.

1. **Download Caddy**:
   * Download the pre-compiled Caddy binary for Windows (a single `.exe` file) from [caddyserver.com](https://caddyserver.com).
   * Save it on Corey's computer at: `C:\Users\corey\Downloads\Corey - Code Stuff\R Server Project folder\New York Scripts and Process\infrastructure\caddy.exe`
2. **Create Caddyfile**:
   * Create a text file named `Caddyfile` (no extension) in the same directory:
     `C:\Users\corey\Downloads\Corey - Code Stuff\R Server Project folder\New York Scripts and Process\infrastructure\Caddyfile`
   * Paste the following configuration, replacing `stochosgroup.tail88cba8.ts.net` with your actual Tailscale domain name:

```caddy
# Ingress routing for Stochos Platform & Analytics
stochosgroup.tail88cba8.ts.net {
    # 1. Enable automated HTTPS certificates via Tailscale
    tls {
        get_certificate tailscale
    }

    # 2. Next.js platform root (Port 3000)
    reverse_proxy 127.0.0.1:3000 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
    }

    # 3. Production Shiny Server dashboards (Port 3838)
    # Accessible via: https://stochosgroup.tail88cba8.ts.net/shiny/
    reverse_proxy /shiny/* 127.0.0.1:3838 {
        # Enable sticky sessions for active dashboard metrics
        lb_policy cookie stochos_session
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up Connection "Upgrade"
        header_up Upgrade $http_upgrade
    }

    # 4. Production RStudio Server (Port 8787)
    # Accessible via: https://stochosgroup.tail88cba8.ts.net/rstudio/
    # Note: RStudio requires trailing slash strip and auth path rewrites
    route /rstudio* {
        uri strip_prefix /rstudio
        reverse_proxy 127.0.0.1:8787 {
            header_up Host {host}
            header_up X-Real-IP {remote_host}
        }
    }
}
```

3. **Start Caddy**:
   * Open a PowerShell terminal on Corey's computer and navigate to the directory:
     ```powershell
     cd "C:\Users\corey\Downloads\Corey - Code Stuff\R Server Project folder\New York Scripts and Process\infrastructure"
     ```
   * Launch Caddy:
     ```powershell
     .\caddy.exe run --config Caddyfile
     ```
   * Caddy will automatically detect the Tailscale service, retrieve the secure Let's Encrypt certificate, and bind to ports `80` and `443` on Windows.

---

## Step 3: Accessing the Platform

Once Tailscale is connected and Caddy is running, Tyler and Caitlin can open their web browsers on their own machines (from anywhere) and visit:

*   **Next.js Platform**: `https://stochosgroup.tail88cba8.ts.net`
*   **Shiny Analytics**: `https://stochosgroup.tail88cba8.ts.net/shiny/`
*   **RStudio Server**: `https://stochosgroup.tail88cba8.ts.net/rstudio/`

The browser will show a **secure padlock icon (HTTPS)**, and all communications will be encrypted. No ports need to be appended to the URLs.

---

## Troubleshooting

1. **Next.js Hostname Errors**:
   * If Next.js blocks incoming requests from the Tailscale hostname, ensure your `.env.local` file does not restrict hosts, or update Next.js settings to accept wildcards.
2. **Caddy Port Conflicts**:
   * If Caddy fails to start with an error that port `80` or `443` is already in use, check if you have Skype, IIS (Internet Information Services), or another web server running on the Windows host and disable them.
3. **Firewall Blocks**:
   * Ensure that the Windows Defender Firewall on Corey's computer allows Tailscale traffic. Tailscale generally configures this automatically during installation.
