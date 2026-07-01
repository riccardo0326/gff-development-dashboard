"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  FileBarChart,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
} from "lucide-react";
import { canAccessNav } from "@/lib/roles";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/statistics", label: "Statistics", icon: BarChart3 },
  { href: "/search", label: "Search", icon: Search },
  { href: "/faulty", label: "Faulty DTCs", icon: AlertTriangle },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/reports", label: "Reports", icon: FileBarChart },
  { href: "/settings", label: "Settings", icon: Settings },
];

const SIDEBAR_KEY = "gff-sidebar-collapsed";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role;
  const visibleNav = NAV.filter((item) => canAccessNav(role, item.href));
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(SIDEBAR_KEY);
    if (stored === "true") setCollapsed(true);
  }, []);

  function toggleCollapsed() {
    setCollapsed((value) => {
      const next = !value;
      localStorage.setItem(SIDEBAR_KEY, String(next));
      return next;
    });
  }

  return (
    <div className="min-h-screen lg:flex">
      <aside
        className={cn(
          "border-card-border bg-card flex shrink-0 flex-col border-b transition-[width] duration-300 ease-in-out lg:sticky lg:top-0 lg:min-h-screen lg:self-start lg:border-r lg:border-b-0",
          collapsed ? "w-full lg:w-16" : "w-full lg:w-64",
        )}
      >
        <div
          className={cn(
            "flex items-start gap-2 px-3 py-4",
            collapsed ? "flex-col items-center lg:px-2" : "justify-between px-5",
          )}
        >
          {!collapsed ? (
            <div className="min-w-0">
              <p className="text-muted text-xs tracking-[0.2em] uppercase">
                GFF Tracker
              </p>
              <h1 className="mt-1 text-lg font-semibold leading-tight">
                Development Dashboard
              </h1>
            </div>
          ) : (
            <div
              className="bg-accent-soft text-accent mx-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold"
              title="GFF Tracker"
            >
              GFF
            </div>
          )}
          <button
            type="button"
            onClick={toggleCollapsed}
            className={cn(
              "text-muted hover:text-foreground hover:bg-white/5 hidden shrink-0 rounded-lg p-2 transition-colors lg:inline-flex",
              collapsed && "mx-auto flex w-full items-center justify-center",
            )}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {mounted && collapsed ? (
              <PanelLeftOpen className="h-5 w-5" />
            ) : (
              <PanelLeftClose className="h-5 w-5" />
            )}
          </button>
        </div>

        <nav
          className={cn(
            "flex flex-1 gap-1 overflow-x-auto px-3 pb-4 lg:flex-col lg:overflow-y-auto",
            collapsed && "lg:items-center lg:px-2",
          )}
        >
          {visibleNav.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                className={cn(
                  "flex items-center rounded-lg text-sm transition-colors",
                  collapsed
                    ? "justify-center px-2 py-2.5 lg:w-full"
                    : "gap-2 px-3 py-2 whitespace-nowrap",
                  active
                    ? "bg-accent-soft text-foreground"
                    : "text-muted hover:bg-white/5 hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex shrink-0 items-center justify-center",
                    collapsed ? "h-5 w-full" : "h-4 w-4",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                {!collapsed ? label : null}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
