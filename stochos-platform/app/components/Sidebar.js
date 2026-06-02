"use client";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";

const navItems = [
  {
    section: "Platform",
    items: [
      { href: "/", label: "Dashboard", icon: "📊" },
      { href: "/organization", label: "Organization & Leadership", icon: "🏛️" },
    ],
  },
  {
    section: "Finance & Reporting",
    items: [
      { href: "/analytics/overview", label: "Executive Overview", icon: "📈" },
      { href: "/analytics/retailers", label: "Retailer Profitability", icon: "🏪" },
      { href: "/analytics/portfolio", label: "Portfolio Mix", icon: "📦" },
      { href: "/reporting", label: "Governed Financial & Performance Administration (GFPA)", icon: "📑" },
      { href: "/reporting/prep", label: "Data Prep Studio", icon: "⚙️" },
      { href: "/reporting/grid", label: "Governed Grid", icon: "📊" },
      { href: "/reporting/workflow", label: "Workflow & Binders", icon: "🗂️" },
      { href: "/budgeting", label: "Divisional Budgeting", icon: "💼" },
    ],
  },
  {
    section: "Marketing",
    items: [
      { href: "/analytics/geography", label: "Geography & Network", icon: "🗺️" },
      { href: "/analytics/forecast", label: "Forecast & Outlook", icon: "🔮" },
      { href: "/marketing", label: "Marketing MRM", icon: "📢" },
      { href: "/instant-tickets", label: "Instant Tickets", icon: "🎫" },
      { href: "/draw-planning", label: "Draw Game Planning", icon: "🎰" },
      { href: "/products", label: "Products", icon: "🎰" },
    ],
  },
  {
    section: "Operations",
    items: [
      { href: "/fomo", label: "Visitations, Coaching & Relationship Management (VCRM)", icon: "🤝" },
      { href: "/contracts", label: "Contracts", icon: "📋" },
      { href: "/fleet", label: "Fleet", icon: "🚗" },
      { href: "/vendors", label: "Vendors", icon: "🏢" },
      { href: "/spatial-ops", label: "Spatial Ops, Logistics & Risk (SOLR)", icon: "🌐" },
    ],
  },
  {
    section: "Information Technology",
    items: [
      { href: "/assets", label: "IT Assets", icon: "💻" },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [theme, setThemeState] = useState("light");

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
  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase()
    : "?";

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <h1>Stochos</h1>
        <p>Lottery Platform</p>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((section) => (
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
          📖 Help & User Guide
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
          {theme === "dark" ? "☀️ Day Mode" : "🌙 Night Mode"}
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
