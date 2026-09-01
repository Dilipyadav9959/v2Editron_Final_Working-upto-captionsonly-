"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Upload,
  FileAudio,
  FileVideo,
  Sparkles,
  Loader2,
  Trash2,
  Plus,
  Download,
  Play,
  Pause,
  Wand2,
  Film,
  Type as TypeIcon,
  Settings2,
  CheckCircle2,
  AlertCircle,
  Video,
  Clapperboard,
  Anchor,
  AudioLines,
  Pencil,
} from "lucide-react";
import { INDIAN_LANGUAGES, INTERNATIONAL_LANGUAGES, getFontFamily } from "@/lib/languages";
import {
  DEFAULT_STYLE,
  downloadFile,
  formatClock,
  generateSRT,
  generateTXT,
  generateVTT,
  type CaptionSegment,
  type CaptionStyle,
} from "@/lib/captions";
import { CaptionPreview } from "./caption-preview";
import { StylePanel } from "./style-panel";
import { BRollPanel } from "./broll-panel";
import { activeBrollAt, type BRollClip } from "@/lib/broll";
import { cn } from "@/lib/utils";

type Stage = "idle" | "uploading" | "transcribing" | "timing" | "done" | "error";

const STAGE_LABELS: Record<Stage, string> = {
  idle: "Idle",
  uploading: "Uploading file…",
  transcribing: "Transcribing speech with Whisper AI…",
  timing: "Aligning word timings…",
  done: "Captions ready",
  error: "Something went wrong",
};

const ACCEPTED = ".mp4,.mp3,.wav,.m4a,.webm,.mov,.ogg,.aac,.mkv";

export function CaptionStudio() {
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isAudio, setIsAudio] = useState(false);
  const [language, setLanguage] = useState("en-US");
  const [stage, setStage] = useState<Stage>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [segments, setSegments] = useState<CaptionSegment[]>([]);
  const [style, setStyle] = useState<CaptionStyle>(DEFAULT_STYLE);
  const [brolls, setBrolls] = useState<BRollClip[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [aspectRatio, setAspectRatio] = useState<number>(16 / 9); // width / height
  const [isPlaying, setIsPlaying] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [activeTab, setActiveTab] = useState<"preview" | "captions" | "style" | "broll">("preview");
  const [wordsPerCaption, setWordsPerCaption] = useState(6);
  const [isExportingVideo, setIsExportingVideo] = useState(false);
  const [exportQuality, setExportQuality] = useState<"480p" | "720p" | "1080p">("1080p");
  const [hookTitleEnabled, setHookTitleEnabled] = useState(false);
  const [hookTitle, setHookTitle] = useState<string>("");
  const [hookTitleLoading, setHookTitleLoading] = useState(false);
  const [hookTitleEditing, setHookTitleEditing] = useState(false);
  const [cleanAudioEnabled, setCleanAudioEnabled] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportMsg, setExportMsg] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Cleanup object URLs
  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  const handleFile = useCallback(
    (f: File | null) => {
      if (!f) return;
      // revoke old url
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      const url = URL.createObjectURL(f);
      setFile(f);
      setVideoUrl(url);
      setIsAudio(!f.type.startsWith("video/"));
      setSegments([]);
      setStage("idle");
      setErrorMsg(null);
      setAspectRatio(16 / 9); // reset until metadata loads
    },
    [videoUrl]
  );

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    handleFile(f);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0] || null;
    handleFile(f);
  };

  // ---------- Generation ----------
  const generate = async () => {
    if (!file) {
      setErrorMsg("Upload a file first.");
      setStage("error");
      return;
    }
    setErrorMsg(null);
    setStage("uploading");

    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("language", language);
      fd.append("words_per_caption", String(wordsPerCaption));

      // small UI pacing — show transcribing stage
      setTimeout(() => setStage("transcribing"), 250);

      const res = await fetch("/api/transcribe", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || "Transcription failed.");
      }

      setStage("timing");
      // brief pacing — show timing stage
      await new Promise((r) => setTimeout(r, 250));

      // Use REAL word-timed captions from faster-whisper
      const segs: CaptionSegment[] = (data.captions || []).map(
        (c: { id?: string; start: number; end: number; text: string }, i: number) => ({
          id: c.id || `seg-${i}-${Math.random().toString(36).slice(2, 8)}`,
          start: c.start,
          end: c.end,
          text: c.text,
        })
      );

      if (segs.length === 0) {
        throw new Error("No captions generated. Try a different file with clearer speech.");
      }

      setSegments(segs);
      // Update language if auto-detected
      if (data.language && data.language.length >= 2) {
        setLanguage(data.language);
      }
      setStage("done");
      setActiveTab("captions");
      toast({
        title: "Captions ready!",
        description: `${segs.length} segments · language: ${data.language || language}${data.languageProbability ? ` (${Math.round(data.languageProbability * 100)}%)` : ""}`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Transcription failed.";
      setErrorMsg(msg);
      setStage("error");
      toast({
        title: "Transcription failed",
        description: msg,
        variant: "destructive",
      });
    }
  };

  // ---------- Sample ----------
  const loadSample = async () => {
    try {
      setStage("uploading");
      setErrorMsg(null);
      const res = await fetch("/api/sample-transcript");
      const data = await res.json();
      if (!data.success) throw new Error("Failed to load sample.");
      setStage("timing");
      await new Promise((r) => setTimeout(r, 250));
      // Use returned segments directly (already word-timed)
      setSegments(
        (data.segments as Array<{ start: number; end: number; text: string }>).map((s, i) => ({
          id: `sample-${i}-${Math.random().toString(36).slice(2, 6)}`,
          start: s.start,
          end: s.end,
          text: s.text,
        }))
      );
      setLanguage(data.language || "en-US");
      setStage("done");
      setActiveTab("captions");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Sample load failed.";
      setErrorMsg(msg);
      setStage("error");
    }
  };

  // ---------- Editing ----------
  const updateSegment = (id: string, patch: Partial<CaptionSegment>) => {
    setSegments((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };
  const deleteSegment = (id: string) => {
    setSegments((prev) => prev.filter((s) => s.id !== id));
  };
  const addSegment = () => {
    const lastEnd = segments.length ? segments[segments.length - 1].end : 0;
    const seg: CaptionSegment = {
      id: `seg-new-${Math.random().toString(36).slice(2, 8)}`,
      start: lastEnd,
      end: +(lastEnd + 1.5).toFixed(3),
      text: "new caption",
    };
    setSegments((prev) => [...prev, seg]);
    setEditingId(seg.id);
    setEditText(seg.text);
  };
  const commitEdit = (id: string) => {
    updateSegment(id, { text: editText.trim() || " " });
    setEditingId(null);
    setEditText("");
  };

  const seekTo = (t: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = t;
      setCurrentTime(t);
      if (!isPlaying) {
        videoRef.current.play().catch(() => {});
      }
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
    }
  };

  // ---------- Exports ----------
  const exportSRT = () => {
    if (!segments.length) return;
    downloadFile("capgen-captions.srt", generateSRT(segments), "application/x-subrip");
  };
  const exportVTT = () => {
    if (!segments.length) return;
    downloadFile("capgen-captions.vtt", generateVTT(segments), "text/vtt");
  };
  const exportTXT = () => {
    if (!segments.length) return;
    downloadFile("capgen-transcript.txt", generateTXT(segments), "text/plain");
  };

  // ---------- Burned-in video export via Canvas + MediaRecorder ----------
  const exportVideo = async () => {
    const video = videoRef.current;
    if (!video || !segments.length || !videoUrl) return;

    setIsExportingVideo(true);
    setExportProgress(0);
    setExportMsg("Preparing canvas…");

    try {
      // Wait for video metadata
      if (!video.videoWidth || !video.videoHeight) {
        await new Promise<void>((resolve, reject) => {
          const onLoad = () => resolve();
          const onError = () => reject(new Error("Video failed to load"));
          video.addEventListener("loadedmetadata", onLoad, { once: true });
          video.addEventListener("error", onError, { once: true });
          setTimeout(() => reject(new Error("Video metadata timeout")), 5000);
        });
      }

      const vw = video.videoWidth || 1280;
      const vh = video.videoHeight || 720;

      // Determine the export canvas shape from `aspectRatio` — the value the
      // live preview already detected correctly (confirmed by the "9:16"
      // badge shown on screen) — rather than re-reading
      // video.videoWidth/videoHeight here. Phone-recorded vertical clips
      // often carry rotation metadata that browsers can report
      // inconsistently between the first loadedmetadata event and a later
      // read, which was silently turning portrait exports into landscape
      // canvases (tiny captions + pillarboxed black bars). Using the
      // already-trusted aspectRatio removes that whole class of bug.
      const QUALITY_LONG_SIDE: Record<typeof exportQuality, number> = {
        "480p": 480,
        "720p": 720,
        "1080p": 1080,
      };
      const maxDim = QUALITY_LONG_SIDE[exportQuality];
      let cw: number;
      let ch: number;
      if (aspectRatio >= 1) {
        cw = maxDim;
        ch = Math.round(maxDim / aspectRatio);
      } else {
        ch = maxDim;
        cw = Math.round(maxDim * aspectRatio);
      }
      // Even dimensions — some video encoders reject odd width/height.
      cw = cw % 2 === 0 ? cw : cw + 1;
      ch = ch % 2 === 0 ? ch : ch + 1;

      const canvas = document.createElement("canvas");
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not supported");

      // Set up MediaRecorder to capture canvas + audio track from the original video
      const canvasStream = canvas.captureStream(30); // 30 fps

      // Try to pull audio from the video element too
      let combinedStream: MediaStream = canvasStream;
      let cleanupAudioContext: (() => void) | null = null;
      try {
        const videoEl = video as HTMLVideoElement & { captureStream?: () => MediaStream; mozCaptureStream?: () => MediaStream };
        const vStream = videoEl.captureStream?.() || videoEl.mozCaptureStream?.();
        if (vStream) {
          const audioTracks = vStream.getAudioTracks();
          if (audioTracks.length > 0) {
            let cleanedTrackAdded = false;
            if (cleanAudioEnabled) {
              // "Clean Audio" — real signal processing, not a cosmetic
              // toggle: a high-pass filter removes low-frequency rumble/hum
              // (handling noise, AC hum, wind), and a dynamics compressor
              // evens out volume swings so quiet speech isn't buried and
              // loud peaks don't clip — the same two moves used for basic
              // broadcast/podcast cleanup.
              //
              // This runs in its OWN try/catch, separate from the outer
              // "no audio available at all" fallback below — previously a
              // failure here fell into that outer catch and silently
              // produced an export with NO audio at all and no warning.
              // Now: on failure we explicitly fall back to raw (unprocessed)
              // audio tracks instead of dropping sound entirely, and always
              // tell you which path was taken.
              try {
                const audioCtx = new AudioContext();
                // Some browsers create a fresh AudioContext in a
                // "suspended" state, especially once we're a few `await`s
                // removed from the click that started export — resume()
                // explicitly rather than assuming it's already running.
                await audioCtx.resume();
                const source = audioCtx.createMediaStreamSource(new MediaStream(audioTracks));
                const highpass = audioCtx.createBiquadFilter();
                highpass.type = "highpass";
                highpass.frequency.value = 90; // cut rumble/hum below ~90Hz
                const compressor = audioCtx.createDynamicsCompressor();
                compressor.threshold.value = -28;
                compressor.knee.value = 24;
                compressor.ratio.value = 4;
                compressor.attack.value = 0.005;
                compressor.release.value = 0.15;
                const makeupGain = audioCtx.createGain();
                makeupGain.gain.value = 1.15; // slight boost to offset compression loudness loss
                const dest = audioCtx.createMediaStreamDestination();
                source.connect(highpass);
                highpass.connect(compressor);
                compressor.connect(makeupGain);
                makeupGain.connect(dest);
                const cleanedTracks = dest.stream.getAudioTracks();
                if (cleanedTracks.length === 0) throw new Error("No output track from audio graph");
                cleanedTracks.forEach((t) => canvasStream.addTrack(t));
                cleanupAudioContext = () => audioCtx.close().catch(() => {});
                cleanedTrackAdded = true;
                toast({ title: "Clean Audio applied", description: "High-pass filter + compression active for this export." });
              } catch (audioErr) {
                console.error("[exportVideo] Clean Audio processing failed, falling back to raw audio:", audioErr);
                toast({
                  title: "Clean Audio unavailable",
                  description: "Couldn't process audio in this browser — exporting with original audio instead.",
                  variant: "destructive",
                });
              }
            }
            if (!cleanedTrackAdded) {
              audioTracks.forEach((at) => canvasStream.addTrack(at));
            }
          }
        }
      } catch {
        // Audio capture not critical — continue with video-only
      }

      // Pick the best supported mime type
      const mimeCandidates = [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
        "video/mp4",
      ];
      const mimeType = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || "video/webm";
      const fileExt = mimeType.includes("mp4") ? "mp4" : "webm";

      const recorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond:
          exportQuality === "1080p" ? 8_000_000 : exportQuality === "720p" ? 5_000_000 : 2_500_000,
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      const done = new Promise<Blob>((resolve) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
      });

      // Reset video to start, mute it (audio comes from the stream), and play
      video.pause();
      video.currentTime = 0;
      video.muted = true;
      await new Promise((r) => setTimeout(r, 100));

      const totalDuration = video.duration || segments[segments.length - 1]?.end || 10;

      // Font setup
      const fontFamilyCss = getFontFamily(style.fontFamily);
      const fontWeight = style.bold ? "800" : "500";
      const fontStyle = style.italic ? "italic" : "normal";

      // Preload b-roll video elements (hidden, muted, loaded but paused).
      // Deliberately NOT autoplaying here — a clip that starts playing
      // during preload keeps drifting forward in real time, so by the time
      // its window actually arrives in the export timeline it's showing a
      // random mid-clip (or looped) frame instead of the clip's actual
      // opening shot. Playback is started explicitly, from currentTime=0,
      // the exact moment each window becomes active (see renderFrame).
      const brollEls = new Map<string, HTMLVideoElement>();
      let brollTainted = false; // set true if drawing a broll frame taints the canvas (CORS)
      let lastActiveBrollId: string | null = null;
      if (brolls.length) {
        setExportMsg("Loading b-roll clips…");
        await Promise.all(
          brolls.map(
            (b) =>
              new Promise<void>((resolve) => {
                if (brollEls.has(b.previewUrl)) return resolve();
                const el = document.createElement("video");
                el.crossOrigin = "anonymous";
                el.src = b.previewUrl;
                el.muted = true;
                el.loop = true;
                el.playsInline = true;
                el.preload = "auto";
                const done = () => resolve();
                el.addEventListener("loadeddata", done, { once: true });
                el.addEventListener("error", done, { once: true });
                setTimeout(done, 4000); // don't block export forever on a slow clip
                brollEls.set(b.previewUrl, el);
                el.load();
              })
          )
        );
      }

      setExportMsg("Recording…");

      recorder.start(100);
      await video.play();

      // Render loop
      const renderFrame = () => {
        if (video.paused || video.ended) {
          finishExport();
          return;
        }
        const t = video.currentTime;

        // Cut to b-roll if one is assigned for this moment; otherwise draw
        // the main video frame. B-roll frames are drawn full-frame (cutaway
        // style) — narration audio keeps playing underneath regardless.
        const activeBroll = !brollTainted ? brolls.find((b) => t >= b.start && t < b.end) : undefined;
        const brollEl = activeBroll ? brollEls.get(activeBroll.previewUrl) : undefined;

        // A new b-roll window just became active (or we just left one) —
        // (re)start the clip from its own beginning so what's captured is
        // always its opening frames, and pause whatever was playing before.
        if (activeBroll?.id !== lastActiveBrollId) {
          if (lastActiveBrollId) {
            const prevBroll = brolls.find((b) => b.id === lastActiveBrollId);
            const prevEl = prevBroll ? brollEls.get(prevBroll.previewUrl) : undefined;
            prevEl?.pause();
          }
          if (brollEl) {
            brollEl.currentTime = 0;
            brollEl.play().catch(() => {});
          }
          lastActiveBrollId = activeBroll?.id ?? null;
        }

        try {
          if (brollEl && brollEl.readyState >= 2) {
            // B-roll stock clips are almost always landscape (16:9), so a
            // naive stretch into a vertical canvas squashes/warps the
            // footage (the "plastic surface" look). Cover-crop instead —
            // same idea as CSS object-fit: cover — so it fills the frame
            // without distortion.
            drawCover(ctx, brollEl, brollEl.videoWidth, brollEl.videoHeight, cw, ch);
          } else {
            drawCover(ctx, video, vw, vh, cw, ch);
          }
        } catch {
          // Cross-origin b-roll source tainted the canvas — captureStream
          // would silently produce a blank/broken recording from here on,
          // so permanently fall back to main-video-only for the rest of
          // this export and let the user know.
          brollTainted = true;
          drawCover(ctx, video, vw, vh, cw, ch);
          toast({
            title: "B-roll export limited",
            description: "One or more b-roll sources blocked canvas capture (CORS). Continuing export without cutaways.",
            variant: "destructive",

          });
        }

        // Find active segment
        const seg = segments.find((s) => t >= s.start && t < s.end);
        if (seg) {
          drawCaption(ctx, seg.text, cw, ch, style, fontFamilyCss, fontWeight, fontStyle);
        }

        if (hookTitleEnabled && hookTitle) {
          drawHookTitle(ctx, hookTitle, cw, ch);
        }

        setExportProgress(Math.min(100, Math.round((t / totalDuration) * 100)));

        if (t < totalDuration) {
          requestAnimationFrame(renderFrame);
        } else {
          finishExport();
        }
      };

      const finishExport = () => {
        if (recorder.state !== "inactive") {
          recorder.stop();
        }
        video.pause();
        video.muted = false;
        brollEls.forEach((el) => {
          el.pause();
          el.src = "";
        });
        cleanupAudioContext?.();
      };

      requestAnimationFrame(renderFrame);

      const blob = await done;
      combinedStream.getTracks().forEach((t) => t.stop());

      setExportMsg("Saving file…");
      setExportProgress(100);

      // Download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `capgen-captioned-video.${fileExt}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      setExportMsg(null);
      setIsExportingVideo(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Video export failed";
      console.error("[exportVideo]", msg);
      setExportMsg(`Export failed: ${msg}`);
      setIsExportingVideo(false);
      setTimeout(() => setExportMsg(null), 5000);
    }
  };

  const updateStyle = (patch: Partial<CaptionStyle>) => setStyle((s) => ({ ...s, ...patch }));

  // ---------- AI Hook Title ----------
  const generateHookTitle = useCallback(async () => {
    if (!segments.length) return;
    setHookTitleLoading(true);
    try {
      const res = await fetch("/api/hook-title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          segments: segments.map((s) => ({ start: s.start, end: s.end, text: s.text })),
        }),
      });
      const data = await res.json();
      if (data.success && data.title) {
        setHookTitle(data.title);
      } else {
        toast({ title: "Hook title failed", description: data.error || "Try again.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Hook title failed", description: "Network error.", variant: "destructive" });
    } finally {
      setHookTitleLoading(false);
    }
  }, [segments]);

  const toggleHookTitle = (enabled: boolean) => {
    setHookTitleEnabled(enabled);
    if (enabled && !hookTitle && segments.length) {
      generateHookTitle();
    }
  };

  const canExport = segments.length > 0;
  const activeIdx = segments.findIndex((s) => currentTime >= s.start && currentTime < s.end);

  return (
    <section id="studio" className="relative scroll-mt-20 bg-[#0a0a0a] py-14 sm:py-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#3d2410] bg-[#2a1a0d] px-3 py-1 text-xs font-semibold text-[#FF6B1A]">
            <Sparkles className="size-3.5" />
            Live caption studio
          </div>
          <h2 className="text-balance text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Caption a video <span className="capgen-gradient-text">right now</span>
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-base text-[#a0a0a0]">
            Upload a clip, pick a language, hit generate. Edit word timings, style the captions, export SRT — all in your browser.
          </p>
        </div>

        {/* Studio card */}
        <div className="overflow-hidden rounded-3xl border border-[#2a2a2a] bg-[#141414] shadow-[0_30px_80px_-30px_rgba(255,107,26,0.18)]">
          {/* Toolbar */}
          <div className="flex flex-col gap-3 border-b border-[#2a2a2a] bg-[#0d0d0d] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex items-center gap-3">
              <div className="grid size-9 place-items-center rounded-lg bg-[#FF6B1A] text-white shadow-sm">
                <Film className="size-4.5" />
              </div>
              <div>
                <div className="text-sm font-bold text-white">CapGen Studio</div>
                <div className="text-xs text-[#888888]">
                  {file ? file.name : "No file loaded"}{" "}
                  {file && <span className="text-[#FF6B1A]">· {(file.size / 1024 / 1024).toFixed(2)} MB</span>}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="h-9 w-[200px] border-[#2a2a2a] bg-[#141414] text-sm">
                  <SelectValue placeholder="Language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Indian · 14</SelectLabel>
                    {INDIAN_LANGUAGES.map((l) => (
                      <SelectItem key={l.code} value={l.code}>
                        {l.name}
                        {l.roman && (
                          <span className="ml-1 rounded bg-[#1a1a1a] px-1 text-[10px] uppercase text-[#FF6B1A]">
                            roman
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>International · 68</SelectLabel>
                    {INTERNATIONAL_LANGUAGES.map((l) => (
                      <SelectItem key={l.code} value={l.code}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex h-9 items-center gap-2 rounded-md border border-[#2a2a2a] bg-[#141414] px-3">
                      <Label htmlFor="wpc-input" className="text-xs font-medium text-[#a0a0a0]">
                        Words/caption
                      </Label>
                      <Input
                        id="wpc-input"
                        type="number"
                        min={1}
                        max={12}
                        value={wordsPerCaption}
                        onChange={(e) => {
                          const v = parseInt(e.target.value, 10);
                          if (!isNaN(v)) setWordsPerCaption(Math.max(1, Math.min(12, v)));
                          else setWordsPerCaption(6);
                        }}
                        className="h-6 w-12 border-transparent bg-transparent p-0 text-center text-sm text-white [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Words per caption segment (1–12). Lower = more frequent caption pops.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <Button
                onClick={generate}
                disabled={!file || stage === "uploading" || stage === "transcribing" || stage === "timing"}
                className="h-9 bg-[#FF6B1A] text-white hover:bg-[#E55A0E]"
              >
                {(stage === "uploading" || stage === "transcribing" || stage === "timing") && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                {stage === "idle" || stage === "done" || stage === "error" ? (
                  <Wand2 className="size-4" />
                ) : null}
                Generate Captions
              </Button>

              <Button
                onClick={loadSample}
                variant="outline"
                className="h-9 border-[#2a2a2a] bg-[#141414] text-white hover:bg-[#1a1a1a] hover:text-[#FF6B1A]"
              >
                <Sparkles className="size-4" />
                Try with sample
              </Button>
            </div>
          </div>

          {/* Progress bar */}
          {stage !== "idle" && (
            <div className="border-b border-[#2a2a2a] bg-[#141414] px-4 py-2 sm:px-6">
              <div className="flex items-center gap-2 text-xs">
                {stage === "error" ? (
                  <AlertCircle className="size-4 text-red-500" />
                ) : stage === "done" ? (
                  <CheckCircle2 className="size-4 text-[#FF6B1A]" />
                ) : (
                  <Loader2 className="size-4 animate-spin text-[#FF6B1A]" />
                )}
                <span className={cn("font-medium", stage === "error" ? "text-red-600" : "text-white")}>
                  {STAGE_LABELS[stage]}
                </span>
                {errorMsg && <span className="text-red-500">— {errorMsg}</span>}
                {stage === "done" && segments.length > 0 && (
                  <span className="ml-auto text-[#888888]">
                    {segments.length} segments · {segments.reduce((a, s) => a + s.text.split(/\s+/).length, 0)} words
                  </span>
                )}
              </div>
              {stage !== "error" && stage !== "done" && (
                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[#1a1a1a]">
                  <motion.div
                    className="h-full bg-[#FF6B1A]"
                    initial={false}
                    animate={{
                      width:
                        stage === "uploading" ? "30%" : stage === "transcribing" ? "70%" : stage === "timing" ? "92%" : "100%",
                    }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Body */}
          <div className="grid gap-0 lg:grid-cols-[1.4fr_1fr]">
            {/* Left: preview + upload */}
            <div className="border-b border-[#2a2a2a] p-4 sm:p-6 lg:border-b-0 lg:border-r">
              {videoUrl ? (
                <div className="space-y-3">
                  <CaptionPreview
                    videoUrl={videoUrl}
                    isAudio={isAudio}
                    segments={segments}
                    currentTime={currentTime}
                    style={style}
                    videoRef={videoRef}
                    aspectRatio={aspectRatio}
                    onTimeUpdate={(t) => setCurrentTime(t)}
                    onLoadedMetadata={(d) => setDuration(d)}
                    onVideoDimensions={(w, h) => {
                      if (w > 0 && h > 0) setAspectRatio(w / h);
                    }}
                    brolls={brolls}
                    hookTitle={hookTitleEnabled ? hookTitle : ""}
                  />
                  {/* Mini player controls */}
                  <div className="flex items-center gap-3 rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] px-3 py-2">
                    <button
                      type="button"
                      onClick={togglePlay}
                      className="grid size-8 place-items-center rounded-full bg-[#FF6B1A] text-white shadow-sm hover:bg-[#E55A0E]"
                      aria-label={isPlaying ? "Pause" : "Play"}
                    >
                      {isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
                    </button>
                    <span className="font-mono text-xs text-[#a0a0a0]">
                      {formatClock(currentTime)} / {formatClock(duration)}
                    </span>
                    <div className="ml-auto flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-[#a0a0a0] hover:bg-[#2a1a0d] hover:text-[#FF6B1A]"
                      >
                        <Upload className="size-4" />
                        Replace
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                  style={{ aspectRatio: "16 / 9" }}
                  className={cn(
                    "grid w-full cursor-pointer place-items-center rounded-xl border-2 border-dashed bg-[#0d0d0d] p-6 text-center transition-all",
                    dragOver ? "border-[#FF6B1A] bg-[#1a1a1a]" : "border-[#3d2410] hover:border-[#FF6B1A] hover:bg-[#1a1a1a]"
                  )}
                  onClick={() => fileInputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
                  }}
                >
                  <div className="mx-auto max-w-md">
                    <div className="mx-auto mb-4 grid size-16 place-items-center rounded-2xl bg-[#FF6B1A] text-white shadow-lg">
                      <Upload className="size-7" />
                    </div>
                    <h3 className="text-lg font-bold text-white">
                      Drop a video or audio file
                    </h3>
                    <p className="mt-1 text-sm text-[#888888]">
                      mp4 · mp3 · wav · m4a · webm · mov · up to 150MB
                    </p>
                    <div className="mt-4 flex items-center justify-center gap-2">
                      <Button type="button" className="bg-[#FF6B1A] text-white hover:bg-[#E55A0E]">
                        <Upload className="size-4" />
                        Choose file
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          loadSample();
                        }}
                        className="border-[#2a2a2a] bg-[#141414] text-white hover:bg-[#1a1a1a] hover:text-[#FF6B1A]"
                      >
                        <Sparkles className="size-4" />
                        Try sample
                      </Button>
                    </div>
                    <p className="mt-4 text-xs text-[#888888]">
                      Audio is processed locally — only the bytes are sent to /api/transcribe for ASR.
                    </p>
                  </div>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED}
                onChange={onFileChange}
                className="hidden"
                aria-hidden="true"
              />

              {/* Export buttons */}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-[#888888]">
                  Export
                </span>
                <Select value={exportQuality} onValueChange={(v) => setExportQuality(v as typeof exportQuality)}>
                  <SelectTrigger className="h-9 w-[100px] border-[#2a2a2a] bg-[#141414] text-xs">
                    <SelectValue placeholder="Quality" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="480p">480p</SelectItem>
                    <SelectItem value="720p">720p</SelectItem>
                    <SelectItem value="1080p">1080p</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={exportVideo}
                  disabled={!canExport || isExportingVideo || isAudio}
                  size="sm"
                  className="bg-[#FF6B1A] text-white hover:bg-[#E55A0E] disabled:opacity-50"
                >
                  {isExportingVideo ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Video className="size-3.5" />
                  )}
                  {isExportingVideo ? `Exporting ${exportProgress}%` : "Export Video"}
                </Button>
                <Button
                  onClick={exportSRT}
                  disabled={!canExport}
                  size="sm"
                  variant="outline"
                  className="border-[#2a2a2a] bg-[#141414] text-white hover:bg-[#1a1a1a] hover:text-[#FF6B1A] disabled:opacity-50"
                >
                  <Download className="size-3.5" />
                  .SRT
                </Button>
                <Button
                  onClick={exportVTT}
                  disabled={!canExport}
                  size="sm"
                  variant="outline"
                  className="border-[#2a2a2a] bg-[#141414] text-white hover:bg-[#1a1a1a] hover:text-[#FF6B1A] disabled:opacity-50"
                >
                  <Download className="size-3.5" />
                  .VTT
                </Button>
                <Button
                  onClick={exportTXT}
                  disabled={!canExport}
                  size="sm"
                  variant="outline"
                  className="border-[#2a2a2a] bg-[#141414] text-white hover:bg-[#1a1a1a] hover:text-[#FF6B1A] disabled:opacity-50"
                >
                  <Download className="size-3.5" />
                  .TXT
                </Button>
                {!canExport && (
                  <span className="text-xs text-[#9a9a9a]">Generate captions to enable export</span>
                )}
                {canExport && isAudio && (
                  <span className="text-xs text-[#9a9a9a]">Video export needs a video file (not audio-only)</span>
                )}
              </div>

              {/* Export progress bar */}
              {(isExportingVideo || exportMsg) && (
                <div className="mt-3 rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] px-4 py-2">
                  <div className="flex items-center gap-2 text-xs">
                    {exportMsg && exportMsg.startsWith("Export failed") ? (
                      <AlertCircle className="size-4 text-red-500" />
                    ) : isExportingVideo ? (
                      <Loader2 className="size-4 animate-spin text-[#FF6B1A]" />
                    ) : (
                      <Clapperboard className="size-4 text-[#FF6B1A]" />
                    )}
                    <span className={cn("font-medium", exportMsg?.startsWith("Export failed") ? "text-red-500" : "text-white")}>
                      {exportMsg || "Processing…"}
                    </span>
                  </div>
                  {isExportingVideo && (
                    <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[#1a1a1a]">
                      <motion.div
                        className="h-full bg-[#FF6B1A]"
                        initial={false}
                        animate={{ width: `${exportProgress}%` }}
                        transition={{ duration: 0.2 }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* AI Tools */}
              <div className="mt-4 rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] p-3">
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#888888]">
                  AI Tools
                </h4>

                {/* AI Hook Title */}
                <div className="flex items-center gap-3 border-b border-[#2a2a2a] py-2.5">
                  <div className="grid size-8 shrink-0 place-items-center rounded-md bg-[#1a1a1a] text-[#a0a0a0]">
                    <Anchor className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-white">AI Hook Title</div>
                    <div className="truncate text-xs text-[#888888]">
                      {hookTitleLoading
                        ? "Generating…"
                        : hookTitleEnabled && hookTitle
                          ? hookTitle
                          : "Generate an attention-grabbing intro"}
                    </div>
                  </div>
                  {hookTitleEnabled && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditText(hookTitle);
                        setHookTitleEditing(true);
                      }}
                      disabled={hookTitleLoading || !segments.length}
                      className="h-7 shrink-0 border-[#2a2a2a] bg-[#141414] px-2 text-xs text-white hover:bg-[#1a1a1a]"
                    >
                      <Pencil className="size-3" />
                      Edit
                    </Button>
                  )}
                  {hookTitleLoading && <Loader2 className="size-4 shrink-0 animate-spin text-[#FF6B1A]" />}
                  <Switch
                    checked={hookTitleEnabled}
                    onCheckedChange={toggleHookTitle}
                    disabled={!segments.length}
                    className="shrink-0 data-[state=checked]:bg-[#FF6B1A]"
                  />
                </div>

                {hookTitleEditing && (
                  <div className="flex items-center gap-2 border-b border-[#2a2a2a] py-2.5 pl-11">
                    <Input
                      autoFocus
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          setHookTitle(editText.trim());
                          setHookTitleEditing(false);
                        }
                        if (e.key === "Escape") setHookTitleEditing(false);
                      }}
                      className="h-8 border-[#2a2a2a] bg-[#141414] text-sm"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setHookTitle(editText.trim());
                        setHookTitleEditing(false);
                      }}
                      className="h-8 bg-[#FF6B1A] text-white hover:bg-[#E55A0E]"
                    >
                      Save
                    </Button>
                  </div>
                )}

                {/* Clean Audio */}
                <div className="flex items-center gap-3 py-2.5">
                  <div className="grid size-8 shrink-0 place-items-center rounded-md bg-[#1a1a1a] text-[#a0a0a0]">
                    <AudioLines className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-white">Clean Audio</div>
                    <div className="truncate text-xs text-[#888888]">Make your audio sound professional</div>
                  </div>
                  <Switch
                    checked={cleanAudioEnabled}
                    onCheckedChange={(v) => {
                      setCleanAudioEnabled(v);
                      if (v) {
                        toast({
                          title: "Clean Audio enabled",
                          description: "This applies when you export the video — there's no live preview for it.",
                        });
                      }
                    }}
                    disabled={isAudio}
                    className="shrink-0 data-[state=checked]:bg-[#FF6B1A]"
                  />
                </div>
                <p className="mt-1 text-[10px] text-[#666666]">
                  {isAudio
                    ? "Clean Audio applies during video export (needs a video file, not audio-only)."
                    : "Clean Audio has no live preview — it applies when you click Export Video."}
                </p>
              </div>
            </div>

            {/* Right: tabs (captions + style) */}
            <div className="bg-[#0d0d0d] p-4 sm:p-6">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
                <TabsList className="grid w-full grid-cols-4 bg-[#1a1a1a]">
                  <TabsTrigger value="preview" className="data-[state=active]:bg-[#2a1a0d] data-[state=active]:text-[#FF6B1A]">
                    <Film className="size-3.5" /> Preview
                  </TabsTrigger>
                  <TabsTrigger value="captions" className="data-[state=active]:bg-[#2a1a0d] data-[state=active]:text-[#FF6B1A]">
                    <TypeIcon className="size-3.5" /> Captions
                  </TabsTrigger>
                  <TabsTrigger value="style" className="data-[state=active]:bg-[#2a1a0d] data-[state=active]:text-[#FF6B1A]">
                    <Settings2 className="size-3.5" /> Style
                  </TabsTrigger>
                  <TabsTrigger value="broll" className="data-[state=active]:bg-[#2a1a0d] data-[state=active]:text-[#FF6B1A]">
                    <Clapperboard className="size-3.5" /> B-Roll
                  </TabsTrigger>
                </TabsList>

                {/* Preview tab — shows active segment + quick seek */}
                <TabsContent value="preview" className="mt-4">
                  <div className="rounded-xl border border-[#2a2a2a] bg-[#141414] p-4">
                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#888888]">
                      Now playing
                    </h4>
                    {activeIdx >= 0 ? (
                      <div className="rounded-lg bg-[#1A1A1A] px-4 py-3 text-center">
                        <span
                          className="font-extrabold uppercase"
                          style={{
                            fontFamily: "var(--font-archivo-black), sans-serif",
                            color: "#FFFFFF",
                            fontSize: "1.5rem",
                            lineHeight: 1.1,
                          }}
                        >
                          {segments[activeIdx].text.split(/\s+/).map((w, i, arr) => (
                            <span
                              key={i}
                              style={{
                                color: i === 0 ? "#FF6B1A" : "#FFFFFF",
                                marginRight: "0.35em",
                                display: "inline-block",
                              }}
                            >
                              {w}
                              {i < arr.length - 1 ? "" : ""}
                            </span>
                          ))}
                        </span>
                      </div>
                    ) : (
                      <div className="rounded-lg bg-[#1a1a1a] px-4 py-6 text-center text-sm text-[#888888]">
                        {segments.length
                          ? "Press play to see captions sync"
                          : "Generate captions to see live preview here"}
                      </div>
                    )}

                    <div className="mt-3 flex items-center justify-between text-xs text-[#888888]">
                      <span>{formatClock(currentTime)} / {formatClock(duration)}</span>
                      <span>{segments.length} segments</span>
                    </div>
                  </div>

                  {/* Quick captions list (compact) */}
                  <div className="mt-4">
                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#888888]">
                      Caption timeline
                    </h4>
                    <ScrollArea className="capgen-scroll h-64 rounded-lg border border-[#2a2a2a] bg-[#141414]">
                      <div className="divide-y divide-[#2a2a2a]">
                        {segments.length === 0 && (
                          <div className="p-4 text-center text-sm text-[#9a9a9a]">
                            No segments yet. Generate or add one.
                          </div>
                        )}
                        {segments.map((seg, i) => (
                          <button
                            key={seg.id}
                            type="button"
                            onClick={() => seekTo(seg.start)}
                            className={cn(
                              "flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-[#1a1a1a]",
                              activeIdx === i && "bg-[#1a1a1a]"
                            )}
                          >
                            <span className="font-mono text-[10px] text-[#9a9a9a]">
                              {formatClock(seg.start)}
                            </span>
                            <span className="flex-1 truncate text-white">{seg.text}</span>
                          </button>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </TabsContent>

                {/* Captions tab — full editor */}
                <TabsContent value="captions" className="mt-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-[#888888]">
                      Caption segments ({segments.length})
                    </h4>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={addSegment}
                      className="h-7 border-[#2a2a2a] bg-[#141414] text-[#FF6B1A] hover:bg-[#1a1a1a]"
                    >
                      <Plus className="size-3.5" />
                      Add
                    </Button>
                  </div>

                  <ScrollArea className="capgen-scroll mt-2 h-[420px] rounded-lg border border-[#2a2a2a] bg-[#141414]">
                    <div className="divide-y divide-[#2a2a2a]">
                      {segments.length === 0 && (
                        <div className="p-6 text-center text-sm text-[#9a9a9a]">
                          No segments yet. Generate captions or click <strong>Add</strong>.
                        </div>
                      )}
                      {segments.map((seg, i) => (
                        <div
                          key={seg.id}
                          className={cn(
                            "group p-3 transition-colors hover:bg-[#0d0d0d]",
                            activeIdx === i && "bg-[#1a1a1a]"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <span className="grid size-6 shrink-0 place-items-center rounded bg-[#2a1a0d] text-[10px] font-bold text-[#FF6B1A]">
                              {i + 1}
                            </span>
                            <Input
                              type="number"
                              step="0.1"
                              min="0"
                              value={seg.start.toFixed(2)}
                              onChange={(e) =>
                                updateSegment(seg.id, {
                                  start: Math.max(0, parseFloat(e.target.value) || 0),
                                })
                              }
                              className="h-7 w-20 border-[#2a2a2a] bg-[#141414] font-mono text-xs"
                              aria-label="Start time"
                            />
                            <span className="text-[#9a9a9a]">→</span>
                            <Input
                              type="number"
                              step="0.1"
                              min="0"
                              value={seg.end.toFixed(2)}
                              onChange={(e) =>
                                updateSegment(seg.id, {
                                  end: Math.max(0, parseFloat(e.target.value) || 0),
                                })
                              }
                              className="h-7 w-20 border-[#2a2a2a] bg-[#141414] font-mono text-xs"
                              aria-label="End time"
                            />
                            <button
                              type="button"
                              onClick={() => seekTo(seg.start)}
                              className="ml-auto grid size-7 place-items-center rounded text-[#9a9a9a] hover:bg-[#2a1a0d] hover:text-[#FF6B1A]"
                              aria-label="Seek to segment"
                            >
                              <Play className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteSegment(seg.id)}
                              className="grid size-7 place-items-center rounded text-[#9a9a9a] hover:bg-red-50 hover:text-red-500"
                              aria-label="Delete segment"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>

                          {editingId === seg.id ? (
                            <Input
                              autoFocus
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              onBlur={() => commitEdit(seg.id)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") commitEdit(seg.id);
                                if (e.key === "Escape") {
                                  setEditingId(null);
                                  setEditText("");
                                }
                              }}
                              className="mt-2 h-9 border-[#FF6B1A] bg-[#141414] text-sm"
                            />
                          ) : (
                            <div
                              onClick={() => {
                                setEditingId(seg.id);
                                setEditText(seg.text);
                              }}
                              className="mt-2 cursor-text rounded-md border border-transparent px-2 py-1.5 text-sm text-white hover:border-[#2a2a2a] hover:bg-[#0d0d0d]"
                              title="Click to edit"
                            >
                              {seg.text}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>

                  <p className="mt-2 text-xs text-[#9a9a9a]">
                    Tip: click any caption text to edit it inline. Click the play icon to seek.
                  </p>
                </TabsContent>

                {/* Style tab */}
                <TabsContent value="broll" className="mt-4">
                  <BRollPanel segments={segments} brolls={brolls} setBrolls={setBrolls} />
                </TabsContent>

                <TabsContent value="style" className="mt-4">
                  <StylePanel style={style} onChange={updateStyle} />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>

        {/* Below studio: file type hints */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs text-[#888888]">
          <span className="inline-flex items-center gap-1.5">
            <FileVideo className="size-3.5 text-[#FF6B1A]" /> Video: mp4, webm, mov, mkv
          </span>
          <span className="inline-flex items-center gap-1.5">
            <FileAudio className="size-3.5 text-[#FF6B1A]" /> Audio: mp3, wav, m4a, ogg, aac
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="size-3.5 text-[#FF6B1A]" /> 150MB max
          </span>
        </div>
      </div>
    </section>
  );
}

// ---------- Caption drawing on canvas (for burned-in video export) ----------
// ---------- Cover-crop draw helper (like CSS object-fit: cover) ----------
// Draws `source` into the destination rect, cropping (not stretching) so the
// source fills the destination completely while preserving its own aspect
// ratio. Used for both the main video and b-roll clips during export so
// mismatched-aspect footage (e.g. landscape b-roll into a vertical canvas)
// never looks squashed or stretched.
function drawCover(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sw: number,
  sh: number,
  dw: number,
  dh: number
) {
  if (!sw || !sh) {
    ctx.drawImage(source, 0, 0, dw, dh);
    return;
  }
  const srcRatio = sw / sh;
  const dstRatio = dw / dh;
  let sx = 0;
  let sy = 0;
  let cropW = sw;
  let cropH = sh;
  if (srcRatio > dstRatio) {
    // Source is relatively wider than destination — crop left/right.
    cropW = sh * dstRatio;
    sx = (sw - cropW) / 2;
  } else if (srcRatio < dstRatio) {
    // Source is relatively taller than destination — crop top/bottom.
    cropH = sw / dstRatio;
    sy = (sh - cropH) / 2;
  }
  ctx.drawImage(source, sx, sy, cropW, cropH, 0, 0, dw, dh);
}

// ---------- Hook title overlay draw (white callout box near the top) ----------
function drawHookTitle(ctx: CanvasRenderingContext2D, title: string, canvasW: number, canvasH: number) {
  const scale = canvasH / 720;
  const fontSize = Math.max(16, Math.round(26 * scale));
  ctx.font = `800 ${fontSize}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const maxWidth = canvasW * 0.86;
  const words = title.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";
  for (const w of words) {
    const test = currentLine ? currentLine + " " + w : w;
    if (ctx.measureText(test).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = w;
    } else {
      currentLine = test;
    }
  }
  if (currentLine) lines.push(currentLine);

  const lineHeight = fontSize * 1.25;
  const paddingX = fontSize * 0.7;
  const paddingY = fontSize * 0.55;
  let maxLineW = 0;
  for (const line of lines) maxLineW = Math.max(maxLineW, ctx.measureText(line).width);

  const boxW = Math.min(canvasW * 0.9, maxLineW + paddingX * 2);
  const boxH = lines.length * lineHeight + paddingY * 2;
  const boxX = canvasW / 2 - boxW / 2;
  const boxY = canvasH * 0.035;
  const radius = Math.min(18 * scale, boxH / 2);

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.25)";
  ctx.shadowBlur = 12 * scale;
  ctx.shadowOffsetY = 3 * scale;
  ctx.fillStyle = "#ffffff";
  roundRectPath(ctx, boxX, boxY, boxW, boxH, radius);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = "#111111";
  lines.forEach((line, i) => {
    const y = boxY + paddingY + lineHeight * i + lineHeight / 2;
    ctx.fillText(line, canvasW / 2, y);
  });
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCaption(
  ctx: CanvasRenderingContext2D,
  text: string,
  canvasW: number,
  canvasH: number,
  style: CaptionStyle,
  fontFamilyCss: string,
  fontWeight: string,
  fontStyle: string
) {
  const displayText = style.uppercase ? text.toUpperCase() : text;
  const words = displayText.split(/\s+/);

  // Scale font relative to canvas height (preview fontSize is tuned for ~720px video)
  const scale = canvasH / 720;
  const fontSize = Math.max(14, Math.round(style.fontSize * scale));

  ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamilyCss}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Wrap text to fit within 88% of canvas width
  const maxWidth = canvasW * 0.88;
  const lines: string[] = [];
  let currentLine = "";
  for (const w of words) {
    const test = currentLine ? currentLine + " " + w : w;
    if (ctx.measureText(test).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = w;
    } else {
      currentLine = test;
    }
  }
  if (currentLine) lines.push(currentLine);

  const lineHeight = fontSize * 1.15;
  const totalH = lines.length * lineHeight;

  // Y position based on style.position
  let yCenter: number;
  if (style.position === "top") {
    yCenter = canvasH * 0.12 + totalH / 2;
  } else if (style.position === "center") {
    yCenter = canvasH * 0.5;
  } else {
    yCenter = canvasH * 0.88 - totalH / 2;
  }

  const xCenter = canvasW / 2;

  // Background box (if opacity > 0)
  if (style.bgOpacity > 0) {
    const padding = fontSize * 0.3;
    let maxLineW = 0;
    for (const line of lines) {
      maxLineW = Math.max(maxLineW, ctx.measureText(line).width);
    }
    const boxW = Math.min(canvasW * 0.92, maxLineW + padding * 2);
    const boxH = totalH + padding * 2;
    const boxX = xCenter - boxW / 2;
    const boxY = yCenter - boxH / 2;
    const alpha = style.bgOpacity / 100;
    const bgHex = style.bgColor.replace("#", "");
    const r = parseInt(bgHex.slice(0, 2), 16) || 0;
    const g = parseInt(bgHex.slice(2, 4), 16) || 0;
    const b = parseInt(bgHex.slice(4, 6), 16) || 0;
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
    ctx.fillRect(boxX, boxY, boxW, boxH);
  }

  // Draw each line
  lines.forEach((line, lineIdx) => {
    const lineY = yCenter - totalH / 2 + lineIdx * lineHeight + lineHeight / 2;
    const lineWords = line.split(/\s+/);

    if (style.template === "active-word" && lineIdx === 0 && lineWords.length > 0) {
      // Highlight first word of the first line in the highlight color
      const wordSpacing = fontSize * 0.35;
      const widths = lineWords.map((w) => ctx.measureText(w).width);
      const totalWidth = widths.reduce((a, b) => a + b, 0) + wordSpacing * (lineWords.length - 1);
      let x = xCenter - totalWidth / 2;

      lineWords.forEach((word, i) => {
        ctx.fillStyle = i === 0 ? style.highlightColor : style.textColor;
        if (style.template !== "outline") {
          ctx.shadowColor = "rgba(0,0,0,0.7)";
          ctx.shadowBlur = fontSize * 0.2;
          ctx.shadowOffsetY = fontSize * 0.04;
        }
        ctx.fillText(word, x + widths[i] / 2, lineY);
        x += widths[i] + wordSpacing;
      });
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
    } else if (style.template === "boxed") {
      const lineW = ctx.measureText(line).width;
      const padding = fontSize * 0.25;
      ctx.fillStyle = style.highlightColor;
      const boxX = xCenter - lineW / 2 - padding;
      const boxY = lineY - lineHeight / 2;
      const boxW = lineW + padding * 2;
      const boxH = lineHeight;
      ctx.fillRect(boxX, boxY, boxW, boxH);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(line, xCenter, lineY);
    } else if (style.template === "outline") {
      ctx.fillStyle = style.textColor;
      ctx.strokeStyle = style.strokeColor;
      ctx.lineWidth = Math.max(2, (style.strokeWidth || 3) * scale);
      ctx.lineJoin = "round";
      ctx.strokeText(line, xCenter, lineY);
      ctx.fillText(line, xCenter, lineY);
    } else {
      // plain
      ctx.fillStyle = style.textColor;
      ctx.shadowColor = "rgba(0,0,0,0.7)";
      ctx.shadowBlur = fontSize * 0.2;
      ctx.shadowOffsetY = fontSize * 0.04;
      ctx.fillText(line, xCenter, lineY);
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
    }
  });
}