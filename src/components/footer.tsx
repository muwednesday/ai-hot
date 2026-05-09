"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/about", label: "关于" },
  { href: "/agent", label: "API" },
  { href: "/feed.xml", label: "RSS", external: true },
];

export function Footer() {
  const pathname = usePathname();

  return (
    <footer className="border-t border-border/50 mt-auto">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span>
              AI<span className="text-primary font-semibold">HOT</span>
            </span>
            {LINKS.map((link) => {
              const isActive = !link.external && pathname === link.href;
              const cls = isActive
                ? "text-foreground font-medium"
                : "hover:text-foreground transition-colors";
              if (link.external) {
                return (
                  <a
                    key={link.href}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cls}
                  >
                    {link.label}
                  </a>
                );
              }
              return (
                <Link key={link.href} href={link.href} className={cls}>
                  {link.label}
                </Link>
              );
            })}
          </div>
          <span>数据每 15 分钟更新 · Powered by DeepSeek</span>
        </div>
      </div>
    </footer>
  );
}
