"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export type NavItem = { href: string; label: string };

/** Aufklappbares Menü; schließt sich beim Seitenwechsel und bei Klick außerhalb. */
export function NavGroup({ label, items }: { label: string; items: NavItem[] }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();
  const active = items.some((i) => (i.href === "/" ? pathname === "/" : pathname.startsWith(i.href)));
  useEffect(() => {
    ref.current?.removeAttribute("open");
  }, [pathname]);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) ref.current.removeAttribute("open");
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);
  if (items.length === 0) return null;
  return (
    <details ref={ref} className="relative">
      <summary className={`cursor-pointer list-none rounded px-2 py-1 hover:bg-slate-100 ${active ? "font-semibold text-[var(--brand)]" : "text-slate-700"}`}>
        {label} <span className="text-xs">▾</span>
      </summary>
      <div className="absolute left-0 z-20 mt-1 min-w-52 rounded-md border border-slate-200 bg-white py-1 shadow-lg">
        {items.map((i) => (
          <Link key={i.href} href={i.href} className={`block px-3 py-1.5 hover:bg-slate-50 ${pathname.startsWith(i.href) ? "font-medium text-[var(--brand)]" : ""}`}>{i.label}</Link>
        ))}
      </div>
    </details>
  );
}
