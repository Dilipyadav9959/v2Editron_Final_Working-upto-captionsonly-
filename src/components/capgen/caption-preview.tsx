"use client";

import { useMemo } from "react";
import { CAPGEN_FONTS, getFontFamily } from "@/lib/languages";
import { activeSegmentIndex, type CaptionSegment, type CaptionStyle } from "@/lib/captions";
import { activeBrollAt, type BRollClip } from "@/lib/broll";
import { cn } from "@/lib/utils";

type Props = {
  videoUrl: string | null;
  isAudio: boolean;
  segments: CaptionSegment[];
  currentTime: number;
  style: CaptionStyle;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  aspectRatio?: number; // width / height (e.g. 16/9, 9/16, 1)
  onTimeUpdate?: (t: number) => void;
  onLoadedMetadata?: (duration: number) => void;
  onVideoDimensions?: (width: number, height: number) => void;
  brolls?: BRollClip[]; // assigned b-roll cutaways, shown over the main video
  hookTitle?: string; // AI-generated hook title overlay, shown near the top
};

export function CaptionPreview({
  videoUrl,
  isAudio,
  segments,
  currentTime,
  style,
  videoRef,
  aspectRatio = 16 / 9,
  onTimeUpdate,
  onLoadedMetadata,
  onVideoDimensions,
  brolls = [],
  hookTitle = "",
}: Props) {
  const fontFamilyCss = getFontFamily(style.fontFamily);
  const activeBroll = useMemo(() => activeBrollAt(brolls, currentTime), [brolls, currentTime]);

  const activeIdx = useMemo(() => activeSegmentIndex(segments, currentTime), [segments, currentTime]);
  const activeSeg = activeIdx >= 0 ? segments[activeIdx] : null;
  const activeWords = activeSeg ? activeSeg.text.split(/\s+/) : [];

  const positionClass =
    style.position === "top"
      ? "items-start pt-6"
      : style.position === "center"
        ? "items-center"
        : "items-end pb-8";

  const textTransform = style.uppercase ? "uppercase" : "none";
  const fontWeight = style.bold ? 800 : 500;
  const fontStyle = style.italic ? "italic" : "normal";
  const bgStyle =
    style.bgOpacity > 0
      ? {
          backgroundColor: hexWithOpacity(style.bgColor, style.bgOpacity / 100),
        }
      : undefined;

  const wrapperBg = isAudio
    ? "linear-gradient(135deg, #1A1A1A 0%, #2a2a2a 60%, #FF6B1A 200%)"
    : undefined;

  // Constrain the preview height so tall (9:16) videos don't overflow the viewport.
  // We use the aspect ratio to compute a max-height that keeps the preview visible.
  // - Wide videos (16:9, 21:9): naturally fit the available width.
  // - Square (1:1): cap height to ~70vh.
  // - Tall videos (9:16, 2:3, etc.): cap height to ~75vh so the whole frame is visible.
  const isTall = aspectRatio < 1;
  const isSquare = aspectRatio >= 0.95 && aspectRatio <= 1.05;
  const containerStyle: React.CSSProperties = isAudio
    ? { aspectRatio: "16 / 9" }
    : { aspectRatio: `${aspectRatio}` };

  // For tall videos, constrain by max-height instead of width-only.
  // The wrapper centers the video frame horizontally.
  const wrapperClass = cn(
    "mx-auto overflow-hidden rounded-xl border border-[#2a2a2a] bg-black",
    isTall
      ? "h-[75vh] max-h-[640px] w-auto max-w-full"
      : isSquare
        ? "h-[70vh] max-h-[560px] w-auto max-w-full"
        : "w-full"
  );

  return (
    <div className={wrapperClass} style={containerStyle}>
      <div className="relative size-full overflow-hidden bg-black">
        {videoUrl ? (
          <video
            ref={videoRef}
            src={videoUrl}
            className="absolute inset-0 size-full object-contain"
            controls
            onTimeUpdate={(e) => onTimeUpdate?.(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => {
              const v = e.currentTarget;
              onLoadedMetadata?.(v.duration);
              if (v.videoWidth > 0 && v.videoHeight > 0) {
                onVideoDimensions?.(v.videoWidth, v.videoHeight);
              }
            }}
            playsInline
          />
        ) : (
          null
        )}

        {/* B-roll cutaway overlay — swaps in over the main video when the
            playhead is inside an assigned b-roll window. Muted/looping;
            audio always continues from the main video underneath. */}
        {activeBroll && (
          <video
            key={activeBroll.id}
            src={activeBroll.previewUrl}
            className="absolute inset-0 size-full object-cover"
            autoPlay
            muted
            loop
            playsInline
          />
        )}

        {/* AI Hook Title overlay — white callout box near the top, like a
            Reels/Shorts headline. Shown for the whole video. */}
        {hookTitle && (
          <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center px-6">
            <div className="max-w-[90%] rounded-xl bg-white px-4 py-2.5 text-center shadow-lg">
              <span className="text-[15px] font-extrabold leading-snug text-[#111111]">
                {hookTitle}
              </span>
            </div>
          </div>
        )}

        {!videoUrl && (
          <div
            className="absolute inset-0 grid place-items-center"
            style={{
              background: wrapperBg || "linear-gradient(135deg, #1A1A1A 0%, #2a2a2a 100%)",
            }}
          >
            <div className="text-center text-white/80">
              <p className="text-sm font-medium">No media loaded</p>
              <p className="mt-1 text-xs text-white/60">Upload a file or try the sample</p>
            </div>
          </div>
        )}

        {/* Caption overlay */}
        {activeSeg && (
          <div
            className={cn(
              "pointer-events-none absolute inset-0 flex justify-center px-6",
              positionClass
            )}
          >
            <div
              className="max-w-[88%] rounded-md px-2 py-1 text-center"
              style={{
                ...bgStyle,
                fontFamily: fontFamilyCss,
                fontSize: `${style.fontSize}px`,
                color: style.textColor,
                fontWeight,
                fontStyle,
                textTransform,
                letterSpacing: `${style.letterSpacing}px`,
                lineHeight: 1.1,
                textShadow:
                  style.template === "outline"
                    ? undefined
                    : "0 2px 8px rgba(0,0,0,0.6)",
                WebkitTextStroke:
                  style.template === "outline"
                    ? `${Math.max(1, style.strokeWidth)}px ${style.strokeColor}`
                    : undefined,
              }}
            >
              {style.template === "active-word" ? (
                <span className="inline-flex flex-wrap justify-center gap-x-[0.35em] gap-y-0">
                  {activeWords.map((w, i) => (
                    <span
                      key={i}
                      style={{
                        color: i === 0 ? style.highlightColor : style.textColor,
                        backgroundColor: i === 0 ? "transparent" : undefined,
                      }}
                      className={cn(i === 0 && "capgen-active-word")}
                    >
                      {w}
                    </span>
                  ))}
                </span>
              ) : style.template === "boxed" ? (
                <span
                  style={{
                    backgroundColor: style.highlightColor,
                    color: "#ffffff",
                    padding: "0.1em 0.4em",
                    borderRadius: "0.25em",
                  }}
                >
                  {style.uppercase ? activeSeg.text.toUpperCase() : activeSeg.text}
                </span>
              ) : (
                <span>{style.uppercase ? activeSeg.text.toUpperCase() : activeSeg.text}</span>
              )}
            </div>
          </div>
        )}

        {/* preview-only badge */}
        <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 text-[10px] font-bold tracking-wide text-white backdrop-blur">
          <span className="size-2 rounded-full bg-[#FF6B1A]" />
          CapGen Preview
        </div>

        {/* Aspect ratio badge */}
        <div className="pointer-events-none absolute right-3 top-3 rounded-md bg-black/60 px-2 py-1 text-[10px] font-bold tracking-wide text-white backdrop-blur">
          {formatAspectRatio(aspectRatio)}
        </div>
      </div>
    </div>
  );
}

function formatAspectRatio(ratio: number): string {
  // Convert a decimal ratio to a readable X:Y form (e.g. 1.778 -> "16:9", 0.5625 -> "9:16")
  const common: Array<[number, string]> = [
    [16 / 9, "16:9"],
    [9 / 16, "9:16"],
    [1, "1:1"],
    [4 / 3, "4:3"],
    [3 / 4, "3:4"],
    [21 / 9, "21:9"],
    [2 / 3, "2:3"],
    [3 / 2, "3:2"],
  ];
  for (const [r, label] of common) {
    if (Math.abs(ratio - r) < 0.02) return label;
  }
  return ratio.toFixed(2);
}

function hexWithOpacity(hex: string, alpha: number): string {
  // Convert #RRGGBB + 0..1 alpha -> rgba()
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export { CAPGEN_FONTS };