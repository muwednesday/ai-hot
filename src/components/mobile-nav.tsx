"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";

interface MobileNavProps {
  items: { href: string; label: string }[];
}

export function MobileNav({ items }: MobileNavProps) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className="inline-flex items-center justify-center rounded-md h-9 w-9 hover:bg-secondary sm:hidden">
        <Menu className="h-5 w-5" />
        <span className="sr-only">菜单</span>
      </SheetTrigger>
      <SheetContent side="right" className="w-64">
        <SheetTitle className="text-lg font-bold">
          AI<span className="text-primary">HOT</span>
        </SheetTitle>
        <nav className="flex flex-col gap-1 mt-6">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="px-3 py-2 text-sm rounded-md hover:bg-secondary transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
