"use client";
import { useState, useEffect } from "react";
import { BookOpen } from "lucide-react";
import HelpDrawer from "../components/HelpDrawer";

export default function SpatialOpsClient({ baseUrl }) {
  const [theme, setTheme] = useState("dark");
  const [resolvedUrl, setResolvedUrl] = useState("");
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  useEffect(() => {
    // Detect starting theme
    const isLight = document.body.classList.contains("light-theme");
    const currentTheme = isLight ? "light" : "dark";
    setTheme(currentTheme);

    // Resolve URL dynamically based on browser hostname
    const getResolvedUrl = (activeTheme) => {
      try {
        if (typeof window !== "undefined") {
          // Use relative path to bypass mixed content (HTTP inside HTTPS) and port restrictions
          return `/shiny/ews/?theme=${activeTheme}&cb=${Date.now()}`;
        }
        const urlObj = new URL(baseUrl);
        urlObj.hostname = window.location.hostname;
        urlObj.searchParams.set("theme", activeTheme);
        urlObj.searchParams.set("cb", Date.now().toString());
        return urlObj.toString();
      } catch (e) {
        return `/shiny/ews/?theme=${activeTheme}&cb=${Date.now()}`;
      }
    };

    setResolvedUrl(getResolvedUrl(currentTheme));

    // Observe changes to document.body's class list
    const observer = new MutationObserver(() => {
      const isLightNow = document.body.classList.contains("light-theme");
      const nextTheme = isLightNow ? "light" : "dark";
      setTheme(nextTheme);
      setResolvedUrl(getResolvedUrl(nextTheme));
    });

    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, [baseUrl]);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "12px", minHeight: "850px" }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={() => setIsHelpOpen(true)}
          style={{
            padding: "8px 16px",
            background: "var(--surface-3)",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            color: "var(--text)",
            cursor: "pointer",
            fontWeight: "bold",
            fontSize: "13px",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            transition: "all 0.15s"
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = "var(--border)";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = "var(--surface-3)";
          }}
        >
          <BookOpen size={16} /> Help & Guide
        </button>
      </div>

      <div style={{ flex: 1, borderRadius: "8px", overflow: "hidden", border: "1px solid var(--border)", backgroundColor: "var(--card-bg)", position: "relative", display: "flex", flexDirection: "column" }}>
        {resolvedUrl ? (
          <iframe 
            key={theme} // Force re-mount of iframe when theme toggles so it reloads R graphics with the new theme
            src={resolvedUrl}
            title="Spatial Operations, Logistics & Risk (SOLR)"
            style={{ width: "100%", height: "100%", flex: 1, minHeight: "800px", border: "none", display: "block" }}
            sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-popups"
          />
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "14px", minHeight: "800px" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ width: "24px", height: "24px", border: "2px solid var(--border)", borderTopColor: "var(--primary)", borderRadius: "50%", margin: "0 auto 12px auto", animation: "spin 1s linear infinite" }}></div>
              Loading SOLR Monitor...
            </div>
          </div>
        )}
      </div>

      <HelpDrawer topicId="solr" isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </div>
  );
}
