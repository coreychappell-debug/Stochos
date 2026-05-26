"use client";
import { useState, useEffect } from "react";

export default function EwsClient({ baseUrl }) {
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    // Detect starting theme
    const isLight = document.body.classList.contains("light-theme");
    setTheme(isLight ? "light" : "dark");

    // Observe changes to document.body's class list
    const observer = new MutationObserver(() => {
      const isLightNow = document.body.classList.contains("light-theme");
      setTheme(isLightNow ? "light" : "dark");
    });

    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const ewsUrl = `${baseUrl}?theme=${theme}`;

  return (
    <div style={{ flex: 1, borderRadius: "8px", overflow: "hidden", border: "1px solid var(--border)", backgroundColor: "var(--card-bg)", position: "relative" }}>
      <iframe 
        key={theme} // Force re-mount of iframe when theme toggles so it reloads R graphics with the new theme
        src={ewsUrl}
        title="Stochos Early Warning System"
        style={{ width: "100%", height: "100%", minHeight: "800px", border: "none", display: "block" }}
        sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-popups"
      />
    </div>
  );
}
