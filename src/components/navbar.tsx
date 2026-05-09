"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./theme-toggle";
import { MobileNav } from "./mobile-nav";

const NAV_ITEMS = [
  { href: "/", label: "精选", matchExact: true },
  { href: "/all", label: "全部动态", matchExact: false },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="border-b border-border/50 sticky top-0 bg-background/80 backdrop-blur-lg z-50">
      <div className="max-w-2xl mx-auto px-4 h-12 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Link href="/" className="font-bold text-lg mr-4 tracking-tight">
            AI<span className="text-primary">HOT</span>
          </Link>
          <nav className="hidden sm:flex items-center gap-0.5">
            {NAV_ITEMS.map((item) => {
              const isActive = item.matchExact
                ? pathname === item.href
                : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    isActive
                      ? "bg-secondary text-foreground font-medium"
                      : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <MobileNav items={NAV_ITEMS.map(({ href, label }) => ({ href, label }))} />
        </div>
      </div>
    </header>
  );
}
