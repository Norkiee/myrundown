# Daily Reads — Setup Guide

## Quick Start

```bash
# 1. Create the project
npx create-next-app@latest daily-reads --typescript --tailwind --app --src-dir=false --import-alias="@/*"
cd daily-reads

# 2. Install dependencies
npm install @supabase/ssr @supabase/supabase-js @anthropic-ai/sdk

# 3. Copy .env.local.example to .env.local and fill in values
cp .env.local.example .env.local

# 4. Run Supabase migrations (see schema in CLAUDE.md)
# Either via Supabase dashboard SQL editor or supabase CLI

# 5. Start dev server
npm run dev
```

## Environment Variables (.env.local.example)

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Cron security (generate a random string)
CRON_SECRET=your-random-secret
```

## Supabase Setup

1. Create a new project at https://supabase.com
2. Go to SQL Editor
3. Run ALL the SQL from the "Database Schema" section of CLAUDE.md in order:
   - profiles table + RLS
   - articles table + RLS + index
   - daily_picks table + RLS
   - digests table + RLS
   - handle_new_user trigger
4. Go to Authentication > URL Configuration
   - Set Site URL to `http://localhost:3000` (dev) or your production URL
   - Add redirect URLs: `http://localhost:3000/api/auth/callback`
5. Copy project URL and anon key from Settings > API

## Tailwind Config

Add Switzer font and the dark color palette:

```typescript
// tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Switzer", "system-ui", "sans-serif"],
      },
      colors: {
        surface: {
          DEFAULT: "#0e0e0e",
          dark: "#080808",
        },
        border: {
          DEFAULT: "#191919",
          hover: "#2a2a2a",
        },
        text: {
          primary: "#ddd8d0",
          secondary: "#b5b0a8",
          muted: "#444",
          faint: "#333",
        },
        accent: {
          green: "#48a870",
          "green-bg": "#0a1f12",
          blue: "#6080b0",
          "blue-bg": "#0e0e20",
          red: "#a05050",
          "red-bg": "#1f0a0a",
        },
      },
    },
  },
  plugins: [],
};

export default config;
```

## Root Layout Font Import

```typescript
// app/layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link
          href="https://fonts.cdnfonts.com/css/switzer"
          rel="stylesheet"
        />
      </head>
      <body className="bg-surface-dark text-text-secondary font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
```

## Anthropic Client Setup

```typescript
// lib/anthropic.ts
import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// Helper to extract text from Claude response
export function extractText(response: Anthropic.Message): string {
  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

// Helper to parse JSON from Claude response (handles markdown fences)
export function parseJsonResponse<T>(text: string): T {
  const cleaned = text
    .replace(/```json\s*/g, "")
    .replace(/```\s*/g, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]);
    throw new Error("Could not parse JSON from Claude response");
  }
}
```

## Daily Pick Algorithm

```typescript
// lib/picks.ts

function seededRandom(seed: string): () => number {
  let s = seed.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export function selectDailyPicks(
  unreadArticles: Article[],
  date: Date,
  count: number = 2
): Article[] {
  if (unreadArticles.length === 0) return [];

  // Sort by score descending, take top candidates
  const sorted = [...unreadArticles].sort((a, b) => b.score - a.score);
  const candidates = sorted.slice(0, Math.min(count * 3, sorted.length));

  // Deterministic shuffle using date as seed
  const dateStr = date.toISOString().split("T")[0]; // "2026-03-08"
  const random = seededRandom(dateStr);

  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  return candidates.slice(0, count);
}
```

## TypeScript Types

```typescript
// lib/types.ts

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  topics: string[];
  daily_pick_count: number;
  created_at: string;
  updated_at: string;
}

export interface Article {
  id: string;
  user_id: string;
  title: string;
  url: string;
  source: string | null;
  summary: string | null;
  score: number;
  topic: string | null;
  read: boolean;
  saved_at: string;
  read_at: string | null;
}

export interface DailyPick {
  id: string;
  user_id: string;
  article_id: string;
  pick_date: string;
}

export interface Digest {
  id: string;
  article_id: string;
  user_id: string;
  takeaways: string[];
  why_it_matters: string;
  verdict: "Must Read" | "Digest Enough";
  created_at: string;
}

export interface ArticleWithDigest extends Article {
  digest?: Digest | null;
}
```

## Deployment (Vercel)

1. Push to GitHub
2. Import in Vercel
3. Add environment variables in Vercel dashboard
4. Add cron config to `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/cron/fetch", "schedule": "0 6 * * *" },
    { "path": "/api/cron/digest", "schedule": "30 6 * * *" }
  ]
}
```

5. Cron routes should verify the secret:
```typescript
if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
  return new Response("Unauthorized", { status: 401 });
}
```
