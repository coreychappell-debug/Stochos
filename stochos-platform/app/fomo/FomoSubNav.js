"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { LayoutDashboard, Users, Navigation, Map, Store, ShieldAlert, FileSpreadsheet } from "lucide-react";

export default function FomoSubNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isRep = session?.user?.role === "sales_rep";

  const allTabs = [
    { name: "VCRM Dashboard", href: "/fomo", icon: LayoutDashboard },
    { name: "Territory Balancer", href: "/fomo/territories", icon: Users },
    { name: "Trip Planner", href: "/fomo/planner", icon: Navigation },
    { name: "Partner Map", href: "/fomo/map", icon: Map },
    { name: "Retailer Registry", href: "/fomo/retailers", icon: Store },
    { name: "Geodata Audit", href: "/fomo/mismatches", icon: ShieldAlert },
    { name: "Data Importer", href: "/fomo/import", icon: FileSpreadsheet },
  ];

  const tabs = allTabs.filter(tab => {
    if (isRep) {
      return !["/fomo/territories", "/fomo/mismatches", "/fomo/import"].includes(tab.href);
    }
    return true;
  });

  return (
    <div style={{
      display: "flex",
      gap: "4px",
      padding: "0 24px",
      marginBottom: "20px",
      borderBottom: "1px solid var(--border)",
      backgroundColor: "var(--surface-2)",
      overflowX: "auto",
      whiteSpace: "nowrap"
    }}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        // Match dashboard exactly, match others by starting path
        const isActive = tab.href === "/fomo" 
          ? pathname === "/fomo" 
          : pathname === tab.href || pathname.startsWith(tab.href + "/");

        return (
          <Link
            key={tab.href}
            href={tab.href}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "12px 16px",
              fontSize: "13px",
              fontWeight: 600,
              color: isActive ? "var(--blue)" : "var(--text-secondary)",
              borderBottom: isActive ? "2.5px solid var(--blue)" : "2.5px solid transparent",
              textDecoration: "none",
              transition: "all 0.15s ease",
              cursor: "pointer"
            }}
          >
            <Icon size={14} style={{ color: isActive ? "var(--blue)" : "var(--text-muted)" }} />
            {tab.name}
          </Link>
        );
      })}
    </div>
  );
}
