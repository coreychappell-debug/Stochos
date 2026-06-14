"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import FeatureBlocker from "./FeatureBlocker";

const ROUTE_FEATURE_MAP = [
  { prefix: "/analytics/overview", flag: "feature_analytics_overview", label: "Executive Overview" },
  { prefix: "/analytics/retailers", flag: "feature_analytics_retailers", label: "Retailer Profitability" },
  { prefix: "/analytics/portfolio", flag: "feature_analytics_portfolio", label: "Portfolio Mix" },
  { prefix: "/analytics/geography", flag: "feature_analytics_geography", label: "Geography & Network" },
  { prefix: "/analytics/forecast", flag: "feature_analytics_forecast", label: "Forecast & Outlook" },
  { prefix: "/analytics", flag: "feature_analytics_overview", label: "Analytics Overview" },
  { prefix: "/reporting/prep", flag: "feature_reporting_prep", label: "Data Prep Studio" },
  { prefix: "/reporting/grid", flag: "feature_reporting_grid", label: "Governed Grid" },
  { prefix: "/reporting/workflow", flag: "feature_reporting_workflow", label: "Workflow & Binders" },
  { prefix: "/reporting/gasb34", flag: "feature_reporting", label: "GFPA Financial Administration" },
  { prefix: "/reporting", flag: "feature_reporting", label: "GFPA Financial Administration" },
  { prefix: "/budgeting", flag: "feature_budgeting", label: "Divisional Budgeting" },
  { prefix: "/marketing", flag: "feature_marketing", label: "Marketing MRM" },
  { prefix: "/instant-tickets", flag: "feature_instant_tickets", label: "Instant Tickets Planner" },
  { prefix: "/draw-planning", flag: "feature_draw_planning", label: "Draw Game Planning" },
  { prefix: "/products", flag: "feature_products", label: "Product Catalog" },
  { prefix: "/fomo", flag: "feature_fomo", label: "VCRM Operations" },
  { prefix: "/contracts", flag: "feature_contracts", label: "Contract Management" },
  { prefix: "/fleet", flag: "feature_fleet", label: "Fleet Management" },
  { prefix: "/vendors", flag: "feature_vendors", label: "Vendor Registry" },
  { prefix: "/spatial-ops", flag: "feature_spatial_ops", label: "SOLR Risk & Logistics" },
  { prefix: "/assets", flag: "feature_assets", label: "Asset Management" },
  { prefix: "/organization", flag: "feature_organization", label: "Organization & Leadership" },
];

export default function AppShell({ children }) {
  const pathname = usePathname();
  const [features, setFeatures] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Read from localStorage on mount (client-side only)
    try {
      const cached = localStorage.getItem("stochos_features");
      if (cached) {
        setFeatures(JSON.parse(cached));
      }
    } catch (e) {}

    const fetchSettings = () => {
      fetch("/api/admin/settings")
        .then((res) => res.json())
        .then((data) => {
          if (data.features) {
            setFeatures(data.features);
            localStorage.setItem("stochos_features", JSON.stringify(data.features));
          }
        })
        .catch(() => {})
        .finally(() => {
          setLoading(false);
        });
    };

    fetchSettings();

    window.addEventListener("storage", fetchSettings);
    return () => window.removeEventListener("storage", fetchSettings);
  }, []);

  // Find if current route is governed by a disabled feature flag
  let matchedBlock = null;
  for (const item of ROUTE_FEATURE_MAP) {
    if (pathname === item.prefix || pathname.startsWith(item.prefix + "/")) {
      if (features[item.flag] === false) {
        matchedBlock = item;
      }
      break;
    }
  }

  if (loading) {
    return (
      <div className="app-layout">
        <Sidebar />
        <main className="main-content" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
          <div className="animate-spin" style={{ width: "32px", height: "32px", border: "3px solid var(--border)", borderTopColor: "var(--gold)", borderRadius: "50%" }} />
        </main>
      </div>
    );
  }

  if (matchedBlock) {
    return <FeatureBlocker moduleName={matchedBlock.label} noShell={true} />;
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">{children}</main>
    </div>
  );
}
