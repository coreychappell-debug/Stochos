"use client";
import { useState, useEffect } from "react";

export default function AnalyticsTabs({ execUrl, ewsUrl }) {
  const [activeTab, setActiveTab] = useState("exec");
  const [theme, setTheme] = useState("dark");
  const [resolvedUrl, setResolvedUrl] = useState("");

  useEffect(() => {
    // Detect starting theme
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

    // Resolve URL dynamically based on browser hostname
    const resolveDynamicUrl = (tab, activeTheme, activePalette) => {
      try {
        if (typeof window !== "undefined") {
          // Use relative path to bypass mixed content (HTTP inside HTTPS) and port restrictions
          const subPath = tab === "exec" ? "executive" : "ews";
          return `/shiny/${subPath}/?theme=${activeTheme}&palette=${activePalette}`;
        }
        const baseUrl = tab === "exec" ? execUrl : ewsUrl;
        const urlObj = new URL(baseUrl);
        urlObj.hostname = window.location.hostname;
        urlObj.searchParams.set("theme", activeTheme);
        urlObj.searchParams.set("palette", activePalette);
        return urlObj.toString();
      } catch (e) {
        const subPath = tab === "exec" ? "executive" : "ews";
        return `/shiny/${subPath}/?theme=${activeTheme}&palette=${activePalette}`;
      }
    };

    setResolvedUrl(resolveDynamicUrl(activeTab, currentTheme, currentPalette));

    // Observe changes to document.body's class list
    const observer = new MutationObserver(() => {
      const isLightNow = document.body.classList.contains("light-theme");
      const nextTheme = isLightNow ? "light" : "dark";
      const nextPalette = getActivePalette();
      setTheme(nextTheme);
      setResolvedUrl(resolveDynamicUrl(activeTab, nextTheme, nextPalette));
    });

    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, [activeTab, execUrl, ewsUrl]);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      <div className="flex space-x-4 mb-4 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("exec")}
          className={`py-2 px-4 font-medium text-sm border-b-2 transition-colors ${
            activeTab === "exec"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
          }`}
        >
          NY Executive Dashboard
        </button>
        <button
          onClick={() => setActiveTab("ews")}
          className={`py-2 px-4 font-medium text-sm border-b-2 transition-colors ${
            activeTab === "ews"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
          }`}
        >
          Spatial Operations, Logistics & Risk (SOLR)
        </button>
      </div>

      <div style={{ flex: 1, borderRadius: "8px", overflow: "hidden", border: "1px solid var(--border)", backgroundColor: "var(--card-bg)", position: "relative", minHeight: "800px", display: "flex", flexDirection: "column" }}>
        {resolvedUrl ? (
          <iframe 
            key={resolvedUrl} // Re-mount iframe when resolvedUrl changes to force theme refresh
            src={resolvedUrl}
            title="Stochos Analytics Server"
            style={{ width: "100%", height: "100%", flex: 1, minHeight: "800px", border: "none", display: "block" }}
            sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-popups"
          />
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "14px", minHeight: "800px" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ width: "24px", height: "24px", border: "2px solid var(--border)", borderTopColor: "var(--primary)", borderRadius: "50%", margin: "0 auto 12px auto", animation: "spin 1s linear infinite" }}></div>
              Loading Analytics Dashboard...
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
