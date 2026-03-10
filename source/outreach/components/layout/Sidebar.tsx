"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, Send, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/campaigns", label: "Campaigns", icon: Send },
  { href: "/contacts/import", label: "Import CSV", icon: Upload },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 shrink-0 border-r bg-card flex flex-col">
      <div className="px-6 py-5">
        <h1 className="text-lg font-semibold tracking-tight">Landomo</h1>
        <p className="text-sm text-muted-foreground">Outreach</p>
      </div>
      <nav className="flex-1 px-3 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              "hover:bg-accent hover:text-accent-foreground",
              pathname.startsWith(href)
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
