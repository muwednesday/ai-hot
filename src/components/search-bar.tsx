"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

export function SearchBar({ defaultValue, basePath }: { defaultValue?: string; basePath?: string }) {
  const [value, setValue] = useState(defaultValue ?? "");
  const router = useRouter();
  const pathname = usePathname();
  const base = basePath ?? pathname;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && !e.ctrlKey && !e.metaKey) {
        const target = e.target as HTMLElement;
        if (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable
        )
          return;
        e.preventDefault();
        document.getElementById("search-input")?.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) {
          router.push(`${base}?q=${encodeURIComponent(value.trim())}`);
        } else {
          router.push(base);
        }
      }}
      className="flex gap-2"
    >
      <Input
        id="search-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="搜索标题/摘要… 按 / 聚焦"
        className="flex-1 h-9"
      />
      <Button type="submit" size="icon" variant="outline" className="shrink-0 h-9 w-9">
        <Search className="h-4 w-4" />
      </Button>
    </form>
  );
}
