"use client";
import { useState, useEffect } from "react";

export default function ShinyEmbed({ tabName, baseUrlType = "exec", title }) {
  const [theme, setTheme] = useState("dark");
  const [resolvedUrl, setResolvedUrl] = useState("");

  useEffect(() => {
    // Hardcoded fallback urls matching the environment defaults
    const execUrl = "http://100.94.253.6:3838/executive";
    const ewsUrl = "http://100.94.253.6:3838/ews";
    const base = baseUrlType === "exec" ? execUrl : ewsUrl;

    const isLight = document.body.classList.contains("light-theme");
    const currentTheme = isLight ? "light" : "dark";
    setTheme(currentTheme);

    const getActivePalette = () => {
      const classList = document.body.classList;
      if (classList.contains("theme-newyork")) return "newyork";
      if (classList.contains("theme-california")) return "california";
      if (classList.contains("theme-texas")) return "texas";
      if (classList.contains("theme-florida")) return "florida";
      return "classic";
    };

    const currentPalette = getActivePalette();

    const resolveDynamicUrl = (activeTheme, activePalette) => {
      try {
        const urlObj = new URL(base);
        urlObj.hostname = window.location.hostname;
        urlObj.searchParams.set("theme", activeTheme);
        urlObj.searchParams.set("palette", activePalette);
        urlObj.searchParams.set("embed", "1");
        if (tabName) {
          urlObj.searchParams.set("tab", tabName);
        }
        return urlObj.toString();
      } catch (e) {
        return `${base}${base.includes('?') ? '&' : '?'}theme=${activeTheme}&palette=${activePalette}&embed=1${tabName ? `&tab=${tabName}` : ''}`;
      }
    };

    setResolvedUrl(resolveDynamicUrl(currentTheme, currentPalette));

    const observer = new MutationObserver(() => {
      const isLightNow = document.body.classList.contains("light-theme");
      const nextTheme = isLightNow ? "light" : "dark";
      const nextPalette = getActivePalette();
      setTheme(nextTheme);
      setResolvedUrl(resolveDynamicUrl(nextTheme, nextPalette));
    });

    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, [tabName, baseUrlType]);

  return (
    <div style={{ flex: 1, borderRadius: "8px", overflow: "hidden", border: "1px solid var(--border)", backgroundColor: "var(--card-bg)", position: "relative", minHeight: "800px", display: "flex", flexDirection: "column" }}>
      {resolvedUrl ? (
        <iframe 
          key={resolvedUrl}
          src={resolvedUrl}
          title={title}
          style={{ width: "100%", height: "100%", flex: 1, minHeight: "800px", border: "none", display: "block" }}
          sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-popups"
        />
      ) : (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "14px", minHeight: "800px" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ width: "24px", height: "24px", border: "2px solid var(--border)", borderTopColor: "var(--primary)", borderRadius: "50%", margin: "0 auto 12px auto", animation: "spin 1s linear infinite" }}></div>
            Loading Dashboard...
          </div>
        </div>
      )}
    </div>
  );
}
