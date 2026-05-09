"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

interface Category {
  slug: string | null;
  label: string;
}

export function CategoryFilter({
  categories,
  active,
  basePath,
}: {
  categories: Category[];
  active?: string;
  basePath?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const q = searchParams.get("q");
  const base = basePath ?? pathname;

  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
      {categories.map((cat) => {
        const href = cat.slug
          ? `${base}?category=${cat.slug}${q ? `&q=${q}` : ""}`
          : `${base}${q ? `?q=${q}` : ""}`;
        const isActive = (cat.slug ?? null) === (active ?? null);
        return (
          <Link
            key={cat.slug ?? "all"}
            href={href}
            className={`px-3 py-1 text-xs rounded-full shrink-0 transition-colors ${
              isActive
                ? "bg-primary text-primary-foreground"
                : "bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground border border-border/50"
            }`}
          >
            {cat.label}
          </Link>
        );
      })}
    </div>
  );
}
