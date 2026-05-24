"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";

const navItems = [
  {
    section: "Platform",
    items: [
      { href: "/", label: "Dashboard", icon: "📊" },
    ],
  },
  {
    section: "Operations",
    items: [
      { href: "/contracts", label: "Contracts", icon: "📋" },
      { href: "/vendors", label: "Vendors", icon: "🏢" },
      { href: "/products", label: "Products", icon: "🎰" },
    ],
  },
  {
    section: "Modules",
    items: [
      { href: "/marketing", label: "Marketing MRM", icon: "📢" },
      { href: "/instant-tickets", label: "Instant Tickets", icon: "🎫" },
      { href: "/analytics", label: "Analytics", icon: "📈" },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

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
