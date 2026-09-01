import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type IncomingWindow = { id: string; start: number; end: number; query: string };

type NormalizedClip = {
  id: string;
  source: "pexels" | "pixabay";
  previewUrl: string;
  thumbnail: string;
  durationHint?: number;
};

const PEXELS_API_KEY = process.env.PEXELS_API_KEY || "";
const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY || "";

async function searchPexels(query: string, perPage = 3): Promise<NormalizedClip[]> {
  if (!PEXELS_API_KEY) return [];
  try {
    const res = await fetch(
      `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=landscape`,
      { headers: { Authorization: PEXELS_API_KEY }, signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const videos = Array.isArray(data.videos) ? data.videos : [];
    return videos.map((v: any) => {
      // Pick a reasonably small file (SD-ish) so preview/export stays fast.
      const files = Array.isArray(v.video_files) ? v.video_files : [];
      const best =
        files.find((f: any) => f.quality === "sd" && f.width && f.width <= 960) ||
        files.find((f: any) => f.quality === "sd") ||
        files[0];
      return {
        id: `pexels-${v.id}`,
        source: "pexels" as const,
        previewUrl: best?.link || "",
        thumbnail: v.image || "",
        durationHint: v.duration,
      };
    }).filter((c: NormalizedClip) => c.previewUrl);
  } catch {
    return [];
  }
}

async function searchPixabay(query: string, perPage = 3): Promise<NormalizedClip[]> {
  if (!PIXABAY_API_KEY) return [];
  try {
    const res = await fetch(
      `https://pixabay.com/api/videos/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(query)}&per_page=${Math.max(3, perPage)}&safesearch=true`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const hits = Array.isArray(data.hits) ? data.hits : [];
    return hits.slice(0, perPage).map((v: any) => {
      const videos = v.videos || {};
      const best = videos.medium || videos.small || videos.tiny || videos.large;
      return {
        id: `pixabay-${v.id}`,
        source: "pixabay" as const,
        previewUrl: best?.url || "",
        thumbnail: v.picture_id ? `https://i.vimeocdn.com/video/${v.picture_id}_295x166.jpg` : "",
        durationHint: v.duration,
      };
    }).filter((c: NormalizedClip) => c.previewUrl);
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  if (!PEXELS_API_KEY && !PIXABAY_API_KEY) {
    return NextResponse.json(
      {
        success: false,
        error:
          "No b-roll API keys configured. Add PEXELS_API_KEY and/or PIXABAY_API_KEY to .env (both are free — see comments in .env.example).",
      },
      { status: 500 }
    );
  }

  let body: { windows?: IncomingWindow[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const windows = Array.isArray(body.windows) ? body.windows.slice(0, 20) : [];
  if (!windows.length) {
    return NextResponse.json({ success: false, error: "No windows provided." }, { status: 400 });
  }

  // Query each window's keywords against both providers in parallel.
  const results = await Promise.all(
    windows.map(async (w) => {
      const [pexels, pixabay] = await Promise.all([
        searchPexels(w.query, 2),
        searchPixabay(w.query, 2),
      ]);
      return {
        windowId: w.id,
        start: w.start,
        end: w.end,
        query: w.query,
        clips: [...pexels, ...pixabay],
      };
    })
  );

  return NextResponse.json({ success: true, results });
}