"use client";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { 
  LayoutDashboard, Users, BarChart3, Store, Package, 
  FileSpreadsheet, Settings, Grid, Folders, Briefcase, 
  Map, TrendingUp, Megaphone, Ticket, Dices, Layers, 
  Handshake, FileText, Car, Building2, Globe, Monitor, 
  BookOpen, Sun, Moon 
} from "lucide-react";

const navItems = [
  {
    section: "Platform",
    items: [
      { href: "/", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
      { href: "/organization", label: "Organization & Leadership", icon: <Users size={18} /> },
    ],
  },
  {
    section: "Finance & Reporting",
    items: [
      { href: "/analytics/overview", label: "Executive Overview", icon: <BarChart3 size={18} /> },
      { href: "/analytics/retailers", label: "Retailer Profitability", icon: <Store size={18} /> },
      { href: "/analytics/portfolio", label: "Portfolio Mix", icon: <Package size={18} /> },
      { href: "/reporting", label: "Governed Financial & Performance Administration (GFPA)", icon: <FileSpreadsheet size={18} /> },
      { href: "/reporting/prep", label: "Data Prep Studio", icon: <Settings size={18} /> },
      { href: "/reporting/grid", label: "Governed Grid", icon: <Grid size={18} /> },
      { href: "/reporting/workflow", label: "Workflow & Binders", icon: <Folders size={18} /> },
      { href: "/budgeting", label: "Divisional Budgeting", icon: <Briefcase size={18} /> },
    ],
  },
  {
    section: "Marketing",
    items: [
      { href: "/analytics/geography", label: "Geography & Network", icon: <Map size={18} /> },
      { href: "/analytics/forecast", label: "Forecast & Outlook", icon: <TrendingUp size={18} /> },
      { href: "/marketing", label: "Marketing MRM", icon: <Megaphone size={18} /> },
      { href: "/instant-tickets", label: "Instant Tickets", icon: <Ticket size={18} /> },
      { href: "/draw-planning", label: "Draw Game Planning", icon: <Dices size={18} /> },
      { href: "/products", label: "Products", icon: <Layers size={18} /> },
    ],
  },
  {
    section: "Operations",
    items: [
      { href: "/fomo", label: "Visitations, Coaching & Relationship Management (VCRM)", icon: <Handshake size={18} /> },
      { href: "/contracts", label: "Contracts", icon: <FileText size={18} /> },
      { href: "/fleet", label: "Fleet", icon: <Car size={18} /> },
      { href: "/vendors", label: "Vendors", icon: <Building2 size={18} /> },
      { href: "/spatial-ops", label: "Spatial Ops, Logistics & Risk (SOLR)", icon: <Globe size={18} /> },
      { href: "/assets", label: "Asset Management", icon: <Monitor size={18} /> },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [theme, setThemeState] = useState("light");
  const [features, setFeatures] = useState({});

  const fetchFeatures = () => {
    fetch("/api/admin/settings")
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error();
      })
      .then((data) => {
        setFeatures(data.features || {});
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchFeatures();
    
    // Listen for custom settings storage change notifications
    window.addEventListener("storage", fetchFeatures);
    return () => {
      window.removeEventListener("storage", fetchFeatures);
    };
  }, []);

  const getFeatureKey = (href) => {
    if (href === "/organization") return "feature_organization";
    if (href === "/analytics/overview") return "feature_analytics_overview";
    if (href === "/analytics/retailers") return "feature_analytics_retailers";
    if (href === "/analytics/portfolio") return "feature_analytics_portfolio";
    if (href === "/reporting") return "feature_reporting";
    if (href === "/reporting/prep") return "feature_reporting_prep";
    if (href === "/reporting/grid") return "feature_reporting_grid";
    if (href === "/reporting/workflow") return "feature_reporting_workflow";
    if (href === "/budgeting") return "feature_budgeting";
    if (href === "/analytics/geography") return "feature_analytics_geography";
    if (href === "/analytics/forecast") return "feature_analytics_forecast";
    if (href === "/marketing") return "feature_marketing";
    if (href === "/instant-tickets") return "feature_instant_tickets";
    if (href === "/draw-planning") return "feature_draw_planning";
    if (href === "/products") return "feature_products";
    if (href === "/fomo") return "feature_fomo";
    if (href === "/contracts") return "feature_contracts";
    if (href === "/fleet") return "feature_fleet";
    if (href === "/vendors") return "feature_vendors";
    if (href === "/spatial-ops") return "feature_spatial_ops";
    if (href === "/assets") return "feature_assets";
    return null;
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") || "light";
    setThemeState(savedTheme);
    if (savedTheme === "light") {
      document.body.classList.add("light-theme");
    } else {
      document.body.classList.remove("light-theme");
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setThemeState(newTheme);
    localStorage.setItem("theme", newTheme);
    if (newTheme === "light") {
      document.body.classList.add("light-theme");
    } else {
      document.body.classList.remove("light-theme");
    }
  };

  const user = session?.user;
  const isAdmin = user?.role === "admin";
  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase()
    : "?";

  const updatedNavItems = [
    ...navItems,
    ...(isAdmin ? [{
      section: "Administration",
      items: [
        { href: "/admin/settings", label: "Feature Toggles", icon: <Settings size={18} /> }
      ]
    }] : [])
  ];

  const filteredNavItems = updatedNavItems.map(section => {
    const visibleItems = section.items.filter(item => {
      const key = getFeatureKey(item.href);
      return key ? features[key] !== false : true;
    });
    return { ...section, items: visibleItems };
  }).filter(section => section.items.length > 0);

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <h1>Stochos</h1>
        <p>Lottery Platform</p>
      </div>

      <nav className="sidebar-nav">
        {filteredNavItems.map((section) => (
          <div className="nav-section" key={section.section}>
            <div className="nav-section-label">{section.section}</div>
            {section.items.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.disabled ? "#" : item.href}
                  className={`nav-link ${isActive ? "active" : ""} ${item.disabled ? "disabled" : ""}`}
                >
                  <span className="nav-icon">{item.icon}</span>
                  {item.label}
                  {item.badge && <span className="nav-badge">{item.badge}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <Link 
          href="/help"
          style={{
            width: "100%",
            padding: "8px 12px",
            marginBottom: "8px",
            backgroundColor: "var(--surface-3)",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            color: "var(--text)",
            cursor: "pointer",
            fontSize: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            textDecoration: "none",
            transition: "all var(--transition)"
          }}
          className="help-guide-btn"
        >
          <BookOpen size={16} /> Help & User Guide
        </Link>

        <button 
          onClick={toggleTheme}
          style={{
            width: "100%",
            padding: "8px 12px",
            marginBottom: "12px",
            backgroundColor: "var(--surface-3)",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            color: "var(--text)",
            cursor: "pointer",
            fontSize: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            transition: "all var(--transition)"
          }}
          className="theme-toggle-btn"
        >
          {theme === "dark" ? <><Sun size={16} /> Day Mode</> : <><Moon size={16} /> Night Mode</>}
        </button>

        <div className="sidebar-user">
          <div className="sidebar-user-avatar">{initials}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{user?.name || "Loading..."}</div>
            <div className="sidebar-user-role">{user?.role || ""}</div>
          </div>
          <button
            className="sidebar-logout"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            Sign Out
          </button>
        </div>
      </div>
    </aside>
  );
}
