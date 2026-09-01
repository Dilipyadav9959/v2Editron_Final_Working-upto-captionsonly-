# CapGen — AI Caption Generator

A full-stack AI video caption generator with real word-level timestamps via faster-whisper. Upload any video/audio, generate word-timed captions in 82+ languages (including Telugu, Hindi, Tamil, and other Indic languages), style them, and export as SRT/VTT/TXT or a burned-in video.

![CapGen](https://img.shields.io/badge/Next.js-16-black) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![Tailwind](https://img.shields.io/badge/Tailwind-4-orange) ![Whisper](https://img.shields.io/badge/faster--whisper-1.2-purple)

---

## ✨ Features

- **Real word-level timestamps** via faster-whisper (not simulated)
- **82+ languages** — 14 Indian (Telugu, Hindi, Tamil, Kannada, Malayalam, Bengali, Punjabi, Gujarati, Marathi, Odia, Urdu + Roman variants) + 68 international
- **Multilingual model** — "small" model supports Indic languages in native script
- **Caption Studio** — edit word timings, text, start/end times inline
- **Style Studio** — 15 Google Fonts, font size, text/highlight colors, position (top/center/bottom), templates (active-word, boxed, outline, plain), bold/italic/uppercase, background opacity
- **Live Preview** — video player with synced caption overlay, auto-detects aspect ratio (9:16, 16:9, 1:1, etc.)
- **Export Options**:
  - `.SRT` (SubRip subtitles)
  - `.VTT` (WebVTT)
  - `.TXT` (plain transcript)
  - **Video export** — burned-in captions via Canvas + MediaRecorder (WebM/MP4)
- **Words-per-caption control** — set 1–12 words per segment
- **Auto audio extraction** — ffmpeg extracts clean 16kHz mono WAV before transcription (handles MP4, MOV, MKV, WebM, etc.)
- **VAD filter** — removes silence automatically
- **Dark theme** — black background, white text, orange (#FF6B1A) accents

---

## 📋 Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| **Node.js** | 18+ | Next.js runtime |
| **bun** (recommended) or **npm** | latest | Package manager |
| **Python** | 3.10+ | faster-whisper transcription engine |
| **ffmpeg** | any recent | Audio extraction from video files |

### Install ffmpeg

**macOS (Homebrew):**
```bash
brew install ffmpeg
```

**Ubuntu/Debian:**
```bash
sudo apt install ffmpeg
```

**Windows (Chocolatey):**
```powershell
choco install ffmpeg
```

Or download from https://ffmpeg.org/download.html

---

## 🚀 Quick Start

### 1. Install Node dependencies

```bash
cd capgen
bun install
# or: npm install
```

### 2. Install Python dependencies

```bash
pip install faster-whisper
```

> **Note:** The first time you run a transcription, faster-whisper will download the "small" model (~244MB) from HuggingFace. This takes 1–2 minutes. Subsequent runs use the cached model and start instantly.

### 3. Set up environment

```bash
cp .env.example .env
```

The default `.env` uses a local SQLite file — no external database needed.

### 4. Run the dev server

```bash
bun run dev
# or: npm run dev
```

Open **http://localhost:3000** in your browser.

---

## 🎬 How to Use

1. **Upload** a video or audio file (MP4, MOV, MKV, WebM, MP3, WAV, M4A — up to 50MB)
2. **Pick a language** from the dropdown (or let it auto-detect)
3. **Set words-per-caption** (1–12, default 6) — lower = more frequent caption pops
4. **Click "Generate Captions"** — takes 3–15 seconds depending on file length
5. **Edit captions** in the Captions tab — click any text to edit, adjust start/end times
6. **Style captions** in the Style tab — font, colors, position, template
7. **Preview** in the Preview tab — play the video with captions overlaid
8. **Export**:
   - `.SRT` / `.VTT` / `.TXT` — subtitle files
   - **Export Video** — burned-in captions (takes ~video duration to render)

---

## 🏗️ Project Structure

```
capgen/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── transcribe/route.ts      # POST: spawns Python whisper subprocess
│   │   │   └── sample-transcript/route.ts
│   │   ├── globals.css                  # Dark theme + orange palette
│   │   ├── layout.tsx                   # Root layout, Google Fonts
│   │   └── page.tsx                      # Single-page app (all sections)
│   ├── components/
│   │   ├── ui/                           # shadcn/ui components (60+)
│   │   └── capgen/                       # CapGen section components
│   │       ├── navbar.tsx
│   │       ├── hero.tsx
│   │       ├── caption-studio.tsx       # The main working tool
│   │       ├── caption-preview.tsx       # Video preview + caption overlay
│   │       ├── style-panel.tsx           # Caption styling controls
│   │       ├── auto-trim.tsx
│   │       ├── stats.tsx
│   │       ├── templates.tsx
│   │       ├── pricing.tsx
│   │       ├── testimonials.tsx
│   │       ├── faq.tsx
│   │       ├── final-cta.tsx
│   │       ├── footer.tsx
│   │       └── logo.tsx
│   ├── hooks/
│   │   ├── use-toast.ts
│   │   └── use-mobile.ts
│   └── lib/
│       ├── captions.ts                  # SRT/VTT/TXT generators, timing helpers
│       ├── languages.ts                 # 82-language list + font catalog
│       ├── db.ts                        # Prisma client
│       └── utils.ts
├── scripts/
│   └── transcribe.py                    # faster-whisper subprocess script
├── prisma/
│   └── schema.prisma
├── public/
│   └── logo.svg
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.ts
├── .env.example
└── README.md
```

---

## ⚙️ How Transcription Works

```
Browser (file upload)
    ↓ multipart/form-data
Next.js API /api/transcribe
    ↓ saves file to /tmp
    ↓ spawns Python subprocess
scripts/transcribe.py <file> <words_per_caption> <mode> <language>
    ↓ ffmpeg extracts audio to 16kHz mono WAV
    ↓ faster-whisper transcribes with word_timestamps=True + VAD filter
    ↓ groups words into caption segments
    ↓ outputs JSON to stdout
Next.js parses JSON → returns to browser
    ↓
Caption Studio renders editable segments
```

### Why a subprocess instead of a persistent service?

The Next.js API route spawns `python3 scripts/transcribe.py` per request. This is more reliable than a persistent Flask service because:
- No background process to manage/kill
- Clear lifecycle (process starts, runs, exits)
- Works in restricted sandbox environments
- The model loads in ~10s on first run, then the OS file cache makes subsequent loads fast (~2-3s)

---

## 🎨 Branding

| Token | Value | Usage |
|-------|-------|-------|
| Background | `#0a0a0a` | Page background (near-black) |
| Card | `#141414` | Cards, panels |
| Secondary | `#1a1a1a` | Muted surfaces |
| Accent | `#2a1a0d` | Dark orange tint (highlights) |
| Border | `#2a2a2a` | Dividers, borders |
| Primary | `#FF6B1A` | Orange — buttons, links, active states |
| Foreground | `#ffffff` | Headings |
| Muted text | `#a0a0a0` | Body text |

To change the brand color, edit the CSS variables in `src/app/globals.css` (`:root` block — change `--primary`, `--ring`, `--accent`).

---

## 🌍 Language Support

CapGen uses the **faster-whisper "small" model** which supports 96+ languages. When you pick a language from the dropdown, the API passes it as a hint to whisper:

| CapGen Code | Whisper Code | Language |
|-------------|--------------|----------|
| `en-US` | `en` | English |
| `te` / `telugish` | `te` | Telugu |
| `hi` / `hinglish` | `hi` | Hindi |
| `ta` / `tanglish` | `ta` | Tamil |
| `kn` / `kannadish` | `kn` | Kannada |
| ... | ... | + 77 more |

Roman variants (Hinglish, Telugish, etc.) use the same whisper code — the output will be in native script. For Roman output, use the **translate** mode (translates to English).

---

## 🐛 Troubleshooting

### "Transcription failed: Python dependency missing: faster_whisper"

Install the Python package:
```bash
pip install faster-whisper
```

If `python3` on your PATH doesn't have it, find the right Python and set `PYTHON_BIN` in `.env`:
```bash
which python3
# if that doesn't have faster-whisper, try:
python3 -c "import faster_whisper; print('OK')"
# if broken, install with:
pip install faster-whisper
```

### "Transcription timed out"

The file is too long. The API has a 3-minute timeout. For longer files:
- Split the file into smaller clips (< 2 minutes)
- Or reduce `WHISPER_BEAM_SIZE` to 1 in `.env` (faster but less accurate)

### MP4 transcription fails but MP3 works

Make sure `ffmpeg` is installed and on your PATH:
```bash
ffmpeg -version
```

### Video export produces no audio

Browser security may block audio capture from `<video>` elements with cross-origin sources. The video export will still work (video + captions, just silent). For audio, use a same-origin video file.

### Hydration errors in console

Make sure you're not running browser extensions that inject HTML into the page. The framer-motion progress bars use `initial={false}` to avoid hydration mismatches.

---

## 📜 Available Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start dev server on port 3000 |
| `bun run build` | Production build |
| `bun run start` | Start production server |
| `bun run lint` | Run ESLint |
| `bun run db:push` | Push Prisma schema to SQLite |
| `bun run db:generate` | Generate Prisma client |

---

## 🔧 Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **Language:** TypeScript 5
- **Styling:** Tailwind CSS 4
- **UI:** shadcn/ui (New York) + Lucide icons
- **Animation:** Framer Motion
- **Database:** Prisma ORM + SQLite
- **Transcription:** faster-whisper (Python, CPU, int8)
- **Audio extraction:** ffmpeg
- **Video export:** Canvas + MediaRecorder API

---

## 📝 License

MIT — build whatever you want with this.

---

## 🙏 Credits

- [faster-whisper](https://github.com/SYSTRAN/faster-whisper) — the transcription engine
- [shadcn/ui](https://ui.shadcn.com/) — the component library
- [Next.js](https://nextjs.org/) — the framework
- Inspired by [FluxoCut](https://fluxocut.com/) — built with white & orange branding as CapGen
