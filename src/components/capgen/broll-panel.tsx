"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Clapperboard, X, Check, RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { buildBrollWindows, activeBrollAt, type BRollClip, type BRollWindow } from "@/lib/broll";
import type { CaptionSegment } from "@/lib/captions";
import { formatClock } from "@/lib/captions";

type SuggestionResult = {
  windowId: string;
  start: number;
  end: number;
  query: string;
  clips: {
    id: string;
    source: "pexels" | "pixabay";
    previewUrl: string;
    thumbnail: string;
    durationHint?: number;
  }[];
};

type Props = {
  segments: CaptionSegment[];
  brolls: BRollClip[];
  setBrolls: React.Dispatch<React.SetStateAction<BRollClip[]>>;
};

export function BRollPanel({ segments, brolls, setBrolls }: Props) {
  const [windows, setWindows] = useState<BRollWindow[]>([]);
  const [suggestions, setSuggestions] = useState<Record<string, SuggestionResult>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSuggestions = async () => {
    if (!segments.length) return;
    setLoading(true);
    setError(null);
    const w = buildBrollWindows(segments, { windowSeconds: 6, maxWindows: 20 });
    setWindows(w);
    try {
      const res = await fetch("/api/broll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ windows: w.map((x) => ({ id: x.id, start: x.start, end: x.end, query: x.query })) }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Failed to fetch b-roll suggestions.");
        return;
      }
      const map: Record<string, SuggestionResult> = {};
      for (const r of data.results as SuggestionResult[]) map[r.windowId] = r;
      setSuggestions(map);
    } catch (e) {
      setError("Network error reaching /api/broll.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (segments.length) fetchSuggestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments.length]);

  const assignClip = (win: BRollWindow, clip: SuggestionResult["clips"][number]) => {
    setBrolls((prev) => {
      const withoutThisWindow = prev.filter((b) => b.windowId !== win.id);
      return [
        ...withoutThisWindow,
        {
          id: `${win.id}-${clip.id}`,
          windowId: win.id,
          start: win.start,
          end: win.end,
          source: clip.source,
          previewUrl: clip.previewUrl,
          thumbnail: clip.thumbnail,
          query: win.query,
          durationHint: clip.durationHint,
        },
      ].sort((a, b) => a.start - b.start);
    });
    toast({ title: "B-roll added", description: `${formatClock(win.start)} – ${formatClock(win.end)}` });
  };

  const removeClip = (windowId: string) => {
    setBrolls((prev) => prev.filter((b) => b.windowId !== windowId));
  };

  if (!segments.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-white/50">
        <Clapperboard className="size-8" />
        <p className="text-sm">Generate captions first — b-roll suggestions are built from your transcript.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">B-Roll Suggestions</h3>
          <p className="text-xs text-white/50">
            Pulled from Pexels &amp; Pixabay based on what's being said, in ~6s windows.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 border-[#2a2a2a] text-white/80 hover:text-white"
          onClick={fetchSuggestions}
          disabled={loading}
        >
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}

      {brolls.length > 0 && (
        <div className="rounded-md border border-[#2a2a2a] bg-[#161616] p-3">
          <p className="mb-2 text-xs font-medium text-white/70">Assigned cutaways ({brolls.length})</p>
          <div className="flex flex-col gap-1.5">
            {brolls.map((b) => (
              <div key={b.id} className="flex items-center gap-2 rounded bg-[#1e1e1e] px-2 py-1.5 text-xs">
                <img src={b.thumbnail} alt="" className="h-8 w-14 rounded object-cover" />
                <span className="text-white/60">
                  {formatClock(b.start)}–{formatClock(b.end)}
                </span>
                <span className="truncate text-white/40">"{b.query}"</span>
                <span className="ml-auto rounded bg-[#2a2a2a] px-1.5 py-0.5 text-[10px] uppercase text-white/40">
                  {b.source}
                </span>
                <button
                  onClick={() => removeClip(b.windowId)}
                  className="text-white/40 hover:text-red-400"
                  aria-label="Remove b-roll"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <ScrollArea className="h-[420px] pr-2">
        <div className="flex flex-col gap-4">
          {windows.map((w) => {
            const s = suggestions[w.id];
            const assigned = brolls.find((b) => b.windowId === w.id);
            return (
              <div key={w.id} className="rounded-md border border-[#2a2a2a] bg-[#161616] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-white/70">
                    {formatClock(w.start)} – {formatClock(w.end)}
                  </span>
                  <span className="rounded bg-[#2a2a2a] px-1.5 py-0.5 text-[10px] text-[#FF6B1A]">
                    "{w.query}"
                  </span>
                </div>
                {!s ? (
                  <div className="flex items-center gap-2 py-3 text-xs text-white/40">
                    <Loader2 className="size-3.5 animate-spin" /> Searching…
                  </div>
                ) : s.clips.length === 0 ? (
                  <p className="py-2 text-xs text-white/40">No clips found for this moment.</p>
                ) : (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {s.clips.map((c) => {
                      const isActive = assigned?.id === `${w.id}-${c.id}`;
                      return (
                        <button
                          key={c.id}
                          onClick={() => assignClip(w, c)}
                          className={`group relative shrink-0 overflow-hidden rounded border ${
                            isActive ? "border-[#FF6B1A]" : "border-[#2a2a2a] hover:border-white/30"
                          }`}
                        >
                          <img src={c.thumbnail} alt="" className="h-16 w-28 object-cover" />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40">
                            {isActive ? (
                              <Check className="size-4 text-[#FF6B1A] opacity-100" />
                            ) : (
                              <span className="text-[10px] text-white opacity-0 group-hover:opacity-100">Use</span>
                            )}
                          </div>
                          <span className="absolute bottom-0.5 right-0.5 rounded bg-black/70 px-1 text-[9px] uppercase text-white/70">
                            {c.source}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}