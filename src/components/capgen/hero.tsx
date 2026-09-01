"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Play, Sparkles, ArrowRight } from "lucide-react";
import { INDIAN_LANGUAGES, INTERNATIONAL_LANGUAGES } from "@/lib/languages";
import { cn } from "@/lib/utils";

const HERO_INDIAN = INDIAN_LANGUAGES.slice(0, 12);
const HERO_INTL = INTERNATIONAL_LANGUAGES.slice(0, 12);

export function Hero({ onOpenStudio }: { onOpenStudio?: () => void }) {
  const [tab, setTab] = useState<"indian" | "international">("indian");
  const [activeWord, setActiveWord] = useState(2);

  const chips = tab === "indian" ? HERO_INDIAN : HERO_INTL;

  // Auto-cycle the highlighted word in the hero preview
  if (typeof window !== "undefined") {
    setTimeout(() => setActiveWord((w) => (w + 1) % 4), 900);
  }

  const handleCta = () => {
    const el = document.getElementById("studio");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    else onOpenStudio?.();
  };

  return (
    <section
      id="top"
      className="relative overflow-hidden bg-[#0a0a0a]"
    >
      {/* Decorative backgrounds */}
      <div className="pointer-events-none absolute inset-0 capgen-radial-orange" />
      <div className="pointer-events-none absolute inset-0 capgen-grid-bg opacity-40" />
      <div className="pointer-events-none absolute -top-24 right-[-10%] h-72 w-72 rounded-full bg-[#FF6B1A]/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-20%] left-[-10%] h-72 w-72 rounded-full bg-[#2a1a0d]/60 blur-3xl" />

      <div className="relative mx-auto w-full max-w-7xl px-4 pb-16 pt-14 sm:px-6 sm:pt-20 lg:px-8 lg:pb-24 lg:pt-24">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left: copy */}
          <div className="text-center lg:text-left">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#3d2410] bg-[#2a1a0d] px-3 py-1 text-xs font-semibold text-[#FF6B1A]"
            >
              <Sparkles className="size-3.5" />
              82 languages · word-timed captions
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.05 }}
              className="text-balance text-4xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl"
            >
              The only captioning tool{" "}
              <span className="capgen-gradient-text">you always needed.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.12 }}
              className="mx-auto mt-5 max-w-xl text-lg text-[#a0a0a0] lg:mx-0"
            >
              14 Indian languages. 68 international. One tool. Generate word-timed
              captions, auto-trim silences, and export SRT — all in your browser.
            </motion.p>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mt-3 text-sm text-[#888888]"
            >
              Free to start · no card needed
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.25 }}
              className="mt-7 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center lg:justify-start"
            >
              <Button
                onClick={handleCta}
                size="lg"
                className="h-12 px-7 text-base font-semibold bg-[#FF6B1A] text-white shadow-[0_10px_30px_-10px_rgba(255,107,26,0.6)] hover:bg-[#E55A0E]"
              >
                Caption a video, free
                <ArrowRight className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="h-12 border-[#2a2a2a] bg-[#141414] px-7 text-base font-semibold text-white hover:bg-[#1a1a1a] hover:text-[#FF6B1A]"
                onClick={() => setTab(tab === "indian" ? "international" : "indian")}
              >
                See it in your language
              </Button>
            </motion.div>

            {/* Language chip switcher */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.32 }}
              id="languages"
              className="mt-9 scroll-mt-24"
            >
              <Tabs value={tab} onValueChange={(v) => setTab(v as "indian" | "international")}>
                <TabsList className="bg-[#1a1a1a]">
                  <TabsTrigger value="indian" className="data-[state=active]:bg-[#2a1a0d] data-[state=active]:text-[#FF6B1A]">
                    Indian · 14
                  </TabsTrigger>
                  <TabsTrigger value="international" className="data-[state=active]:bg-[#2a1a0d] data-[state=active]:text-[#FF6B1A]">
                    International · 68
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="mt-3 flex flex-wrap justify-center gap-2 lg:justify-start">
                {chips.map((l) => (
                  <span
                    key={l.code}
                    className="rounded-full border border-[#2a2a2a] bg-[#141414] px-3 py-1.5 text-xs font-medium text-[#a0a0a0] shadow-sm transition-colors hover:border-[#FF6B1A]/40 hover:text-[#FF6B1A]"
                  >
                    {l.name}
                    {l.roman && (
                      <span className="ml-1 rounded bg-[#1a1a1a] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[#FF6B1A]">
                        roman
                      </span>
                    )}
                  </span>
                ))}
                <span className="rounded-full border border-dashed border-[#FF6B1A]/40 bg-[#2a1a0d] px-3 py-1.5 text-xs font-semibold text-[#FF6B1A]">
                  + {tab === "indian" ? INDIAN_LANGUAGES.length - HERO_INDIAN.length : INTERNATIONAL_LANGUAGES.length - HERO_INTL.length} more
                </span>
              </div>
            </motion.div>
          </div>

          {/* Right: hero visual — mock captioned video frame */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="relative"
          >
            <div className="relative mx-auto aspect-[9/12] w-full max-w-sm overflow-hidden rounded-3xl border border-[#2a2a2a] bg-gradient-to-br from-[#1A1A1A] via-[#2a2a2a] to-[#1A1A1A] shadow-2xl sm:aspect-[4/5]">
              {/* faux video poster */}
              <div className="absolute inset-0 opacity-30" style={{
                backgroundImage:
                  "radial-gradient(circle at 30% 20%, rgba(255,107,26,0.6) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(255,178,122,0.4) 0%, transparent 50%)",
              }} />
              {/* play button */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                <div className="grid size-16 place-items-center rounded-full bg-[#141414]/95 shadow-xl ring-1 ring-white/10">
                  <Play className="size-7 fill-[#FF6B1A] text-[#FF6B1A]" />
                </div>
              </div>

              {/* Caption overlay — word-by-word active highlight */}
              <div className="absolute inset-x-4 bottom-12 flex flex-wrap justify-center gap-x-2 gap-y-1 text-center">
                {["KEEP", "THE", "GOLD", "BABY"].map((word, i) => (
                  <span
                    key={i}
                    className={cn(
                      "rounded-md px-2 py-1 font-extrabold uppercase transition-all duration-200",
                      i === activeWord
                        ? "scale-110 bg-[#FF6B1A] text-white shadow-lg capgen-active-word"
                        : "bg-black/60 text-white"
                    )}
                    style={{ fontFamily: "var(--font-archivo-black), sans-serif", fontSize: "1.6rem", lineHeight: 1 }}
                  >
                    {word}
                  </span>
                ))}
              </div>

              {/* Time chip */}
              <div className="absolute right-3 top-3 rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-white backdrop-blur">
                00:12 / 04:42
              </div>

              {/* CapGen badge */}
              <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-md bg-[#141414]/95 px-2 py-1 text-[10px] font-bold tracking-wide text-white ring-1 ring-white/10">
                <span className="size-2 rounded-full bg-[#FF6B1A]" />
                CapGen · Live
              </div>
            </div>

            {/* floating accent chips */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
              className="absolute -left-3 top-12 hidden rounded-xl border border-[#2a2a2a] bg-[#141414] p-3 shadow-lg sm:block"
            >
              <div className="text-[10px] font-semibold uppercase tracking-wide text-[#888888]">Auto Trim</div>
              <div className="mt-0.5 text-sm font-bold text-white">
                raw 4:12 → <span className="text-[#FF6B1A]">2:47</span>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.75 }}
              className="absolute -right-3 bottom-20 hidden rounded-xl border border-[#2a2a2a] bg-[#141414] p-3 shadow-lg sm:block"
            >
              <div className="text-[10px] font-semibold uppercase tracking-wide text-[#888888]">.SRT export</div>
              <div className="mt-0.5 text-sm font-bold text-white">
                ready in <span className="text-[#FF6B1A]">2 clicks</span>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
