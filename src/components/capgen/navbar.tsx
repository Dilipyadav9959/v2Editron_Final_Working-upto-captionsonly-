"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { CapGenLogo } from "./logo";
import { cn } from "@/lib/utils";
import { Menu, X } from "lucide-react";

const NAV_LINKS = [
  { label: "Languages", href: "#languages" },
  { label: "Captions", href: "#captions" },
  { label: "Auto Trim", href: "#auto-trim" },
  { label: "Pricing", href: "#pricing" },
  { label: "Plugin", href: "#plugin" },
];

export function Navbar({ onOpenStudio }: { onOpenStudio?: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleCta = () => {
    setOpen(false);
    const el = document.getElementById("studio");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      onOpenStudio?.();
    }
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full bg-[#0a0a0a]/90 backdrop-blur-md transition-all",
        scrolled ? "border-b border-[#2a2a2a] shadow-[0_4px_24px_-12px_rgba(0,0,0,0.5)]" : "border-b border-transparent"
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <a href="#top" className="flex items-center" aria-label="CapGen home">
          <CapGenLogo />
        </a>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-[#a0a0a0] transition-colors hover:bg-[#1a1a1a] hover:text-[#FF6B1A]"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Button variant="ghost" className="text-white hover:bg-[#1a1a1a] hover:text-[#FF6B1A]">
            Log in
          </Button>
          <Button
            onClick={handleCta}
            className="bg-[#FF6B1A] text-white shadow-sm hover:bg-[#E55A0E]"
          >
            Start free
          </Button>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="grid size-10 place-items-center rounded-md text-white hover:bg-[#1a1a1a] md:hidden"
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-[#2a2a2a] bg-[#0a0a0a] md:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3" aria-label="Mobile">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-medium text-[#a0a0a0] hover:bg-[#1a1a1a] hover:text-[#FF6B1A]"
              >
                {link.label}
              </a>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t border-[#2a2a2a] pt-3">
              <Button variant="outline" className="w-full justify-center border-[#2a2a2a]">
                Log in
              </Button>
              <Button
                onClick={handleCta}
                className="w-full justify-center bg-[#FF6B1A] text-white hover:bg-[#E55A0E]"
              >
                Start free
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
