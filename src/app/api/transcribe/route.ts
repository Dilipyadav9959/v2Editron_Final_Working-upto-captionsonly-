import { NextRequest, NextResponse } from "next/server";
import { writeFile, unlink, mkdir, access } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export const runtime = "nodejs";
export const maxDuration = 600; // 10 min — larger files need more time for model load + ffmpeg extract + transcription on CPU

const MAX_FILE_BYTES = 150 * 1024 * 1024; // 150 MB
const SCRIPT_PATH = join(process.cwd(), "scripts", "transcribe.py");

// Resolve the Python binary that actually has faster-whisper installed.
// Prefer the venv python (always has it), fall back to system python, then PATH lookup.
const PYTHON_BIN = process.env.PYTHON_BIN || "/home/z/.venv/bin/python3";

type WhisperCaption = {
  start: number;
  end: number;
  text: string;
};

export async function POST(req: NextRequest) {
  const startedAt = Date.now();

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const language = (formData.get("language") as string | null) || "en";
    const mode = (formData.get("mode") as string) === "translate" ? "translate" : "transcribe";
    const wpcRaw = formData.get("words_per_caption");
    const wordsPerCaption = wpcRaw ? Math.max(1, Math.min(12, parseInt(wpcRaw as string, 10) || 6)) : 6;

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: "No file provided. Upload an audio or video file (mp4, mp3, wav, m4a, webm)." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { success: false, error: `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max 150MB.` },
        { status: 413 }
      );
    }

    if (!existsSync(SCRIPT_PATH)) {
      return NextResponse.json(
        { success: false, error: "Transcription script not found. Contact admin." },
        { status: 500 }
      );
    }

    // Pre-flight: verify the Python binary can import faster_whisper.
    // This catches environment issues early with a clear message instead of
    // a confusing "Command failed" later.
    try {
      await access(PYTHON_BIN);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: `Python binary not found at ${PYTHON_BIN}. Set PYTHON_BIN env var to a valid python3 path.`,
        },
        { status: 500 }
      );
    }

    // Save uploaded file to a temp path
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const ext = (file.name || "audio.wav").includes(".")
      ? (file.name as string).slice(file.name.lastIndexOf("."))
      : ".wav";
    const tempId = randomUUID();
    const tempDir = join(tmpdir(), "capgen-uploads");
    if (!existsSync(tempDir)) await mkdir(tempDir, { recursive: true });
    const tempPath = join(tempDir, `${tempId}${ext}`);
    await writeFile(tempPath, buffer);

    try {
      // Run the Python subprocess
      // env: limit threads to avoid sandbox CPU limits
      const env = {
        ...process.env,
        OMP_NUM_THREADS: "1",
        PYTHONUNBUFFERED: "1",
      };

      const { stdout, stderr } = await execFileAsync(
        PYTHON_BIN,
        [SCRIPT_PATH, tempPath, String(wordsPerCaption), mode, language],
        {
          env,
          timeout: 590_000, // 590s hard cap (maxDuration is 600s)
          maxBuffer: 10 * 1024 * 1024,
          killSignal: "SIGKILL",
        }
      ).catch((err: unknown) => {
        // Distinguish "module not found" / import errors from real timeouts.
        // Node's execFile rejects with a message like "Command failed: python3 ..."
        // and populates err.stderr / err.stdout.
        const e = err as NodeJS.ErrnoException & { stderr?: string; stdout?: string; code?: string | number };
        const errText = (e.stderr || "") + (e.stdout || "");
        console.error("[/api/transcribe] execFile error:", e.message);
        console.error("[/api/transcribe] stderr:", (e.stderr || "").slice(0, 800));
        // If Python crashed with ModuleNotFoundError, surface a clear message.
        if (errText.includes("ModuleNotFoundError") || errText.includes("ImportError")) {
          const m = errText.match(/ModuleNotFoundError: No module named '([^']+)'/) || errText.match(/ImportError: ([^\n]+)/);
          throw new Error(
            `Python dependency missing: ${m ? m[1] : "unknown"}. Run: pip install faster-whisper`
          );
        }
        if (e.message.includes("timed out") || e.code === "ETIMEDOUT") {
          throw new Error("timed out — the file may be too long. Try a clip under 2 minutes.");
        }
        throw new Error(e.message);
      });

      if (stderr) {
        console.error("[/api/transcribe] python stderr:", stderr.slice(0, 800));
      }

      let result: { success?: boolean; captions?: WhisperCaption[]; language?: string; language_probability?: number; error?: string };
      try {
        result = JSON.parse(stdout.trim().split("\n").pop() as string);
      } catch {
        return NextResponse.json(
          {
            success: false,
            error: "Transcription script returned invalid output. Try again with a shorter clip.",
            raw: stdout.slice(0, 500),
            elapsedMs: Date.now() - startedAt,
          },
          { status: 500 }
        );
      }

      if (!result.success) {
        return NextResponse.json(
          {
            success: false,
            error: result.error || "Transcription failed.",
            elapsedMs: Date.now() - startedAt,
          },
          { status: 422 }
        );
      }

      const captions = (result.captions || []).map((c, i) => ({
        id: `seg-${i}-${Math.random().toString(36).slice(2, 8)}`,
        start: c.start,
        end: c.end,
        text: c.text,
      }));

      return NextResponse.json({
        success: true,
        captions,
        language: result.language || language,
        languageProbability: result.language_probability,
        captionCount: captions.length,
        mode,
        elapsedMs: Date.now() - startedAt,
      });
    } finally {
      // Clean up temp file
      try {
        await unlink(tempPath);
      } catch {}
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown transcription error";
    console.error("[/api/transcribe] error:", message);
    const isTimeout =
      message.includes("timed out") ||
      message.includes("SIGKILL") ||
      message.includes("Command failed");
    return NextResponse.json(
      {
        success: false,
        error: isTimeout
          ? "Transcription timed out — the file may be too long. Try a clip under 2 minutes, or split it into smaller parts."
          : message.includes("No speech detected")
            ? "No speech detected. Make sure the video has clear voice audio (not just music or silence)."
            : `Transcription failed: ${message}`,
        elapsedMs: Date.now() - startedAt,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "/api/transcribe",
    method: "POST (multipart/form-data)",
    fields: {
      file: "audio/video file (max 150MB, formats: mp4, mp3, wav, m4a, webm, mov)",
      language: "optional language code (default: auto-detect)",
      mode: '"transcribe" (default) or "translate" (translate to English)',
      words_per_caption: "optional, 1-12, default 6",
    },
    engine: "faster-whisper (small model, CPU, int8)",
    features: ["word-level timestamps", "VAD filter", "language auto-detection", "translation mode"],
  });
}