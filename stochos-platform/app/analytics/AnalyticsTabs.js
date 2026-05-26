"use client";
import { useState, useEffect } from "react";

export default function AnalyticsTabs({ execUrl, ewsUrl }) {
  const [activeTab, setActiveTab] = useState("exec");
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

  const baseTabUrl = activeTab === "exec" ? execUrl : ewsUrl;
  const currentUrl = `${baseTabUrl}?theme=${theme}`;

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
          Early Warning System (EWS)
        </button>
      </div>

      <div style={{ flex: 1, borderRadius: "8px", overflow: "hidden", border: "1px solid var(--border)", backgroundColor: "var(--card-bg)", position: "relative" }}>
        {/* We use a key on the iframe so React completely re-mounts it when the theme or URL changes */}
        <iframe 
          key={currentUrl}
          src={currentUrl}
          title="Stochos Analytics Server"
          style={{ width: "100%", height: "100%", minHeight: "800px", border: "none", display: "block" }}
          sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-popups"
        />
      </div>
    </div>
  );
}
