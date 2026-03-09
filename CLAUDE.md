# Daily Reads — AI Article Curation Agent

## What This Is

Daily Reads is a web app that uses AI to curate a personalized reading list. Every day, it picks 2 articles for the user and generates detailed digests (key takeaways, why it matters, read/skip verdict) so they can decide if the full article is worth their time.

Users sign up, define their interests, and the system handles the rest: fetching, scoring, picking, and summarizing.

---

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Database**: Supabase (Postgres + Auth + Edge Functions)
- **AI**: Anthropic Claude API (claude-sonnet-4-20250514) with web search tool
- **Styling**: Tailwind CSS with Switzer font (from CDN Fonts)
- **Deployment**: Vercel
- **Cron**: Vercel Cron Jobs (or Supabase pg_cron)

---

## Design System

### Visual Direction
Dark, minimal, content-centered. Inspired by Minimal (the bookmarking app). Not generic SaaS — more like a reading tool for one person.

### Specifics
- **Font**: Switzer (import from `https://fonts.cdnfonts.com/css/switzer`)
- **Background**: `#080808`
- **Text primary**: `#ddd8d0`
- **Text secondary**: `#b5b0a8`
- **Text muted**: `#444`
- **Surface**: `#0e0e0e`
- **Border**: `#191919`
- **Accent (CTA)**: `#ddd8d0` on dark (inverted)
- **Success**: `#48a870` on `#0a1f12`
- **Content max-width**: `640px`, centered with generous side margins
- **Border radius**: `8px` for buttons, `10-12px` for cards/panels
- **No heavy shadows, no gradients**. Flat, bordered surfaces.
- **Animations**: Subtle fade-ups on cards (200-400ms), no bouncing or spring physics

### Layout Reference
The app should feel like the Minimal bookmarking app screenshots provided during design:
- Clean top bar with logo left, actions right
- Decorative input bar below header (cosmetic, shows tagline)
- Tab navigation directly above content
- Table-style list view for queue/all/read views (favicon initial, title, domain, date)
- Card view for today's picks with digest sections

---

## Database Schema (Supabase)

### `profiles` table
```sql
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  display_name text,
  topics text[] default array[
    'AI agents and autonomous systems',
    'indie hacking and building in public',
    'product design and UX',
    'startup fundraising and growth',
    'economics and monetary policy'
  ],
  daily_pick_count int default 2,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table profiles enable row level security;
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
```

### `articles` table
```sql
create table articles (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  title text not null,
  url text not null,
  source text,
  summary text,
  score int check (score >= 1 and score <= 10),
  topic text,
  read boolean default false,
  saved_at timestamptz default now(),
  read_at timestamptz,
  
  unique(user_id, url)
);

-- Enable RLS
alter table articles enable row level security;
create policy "Users can view own articles" on articles for select using (auth.uid() = user_id);
create policy "Users can insert own articles" on articles for insert with check (auth.uid() = user_id);
create policy "Users can update own articles" on articles for update using (auth.uid() = user_id);
create policy "Users can delete own articles" on articles for delete using (auth.uid() = user_id);

-- Index for daily picks query
create index idx_articles_user_unread on articles(user_id, read, score desc) where read = false;
```

### `daily_picks` table
```sql
create table daily_picks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  article_id uuid references articles(id) on delete cascade not null,
  pick_date date not null default current_date,
  
  unique(user_id, article_id, pick_date)
);

alter table daily_picks enable row level security;
create policy "Users can view own picks" on daily_picks for select using (auth.uid() = user_id);
create policy "Users can insert own picks" on daily_picks for insert with check (auth.uid() = user_id);
```

### `digests` table
```sql
create table digests (
  id uuid default gen_random_uuid() primary key,
  article_id uuid references articles(id) on delete cascade not null unique,
  user_id uuid references profiles(id) on delete cascade not null,
  takeaways text[] not null,
  why_it_matters text not null,
  verdict text check (verdict in ('Must Read', 'Digest Enough')) not null,
  created_at timestamptz default now()
);

alter table digests enable row level security;
create policy "Users can view own digests" on digests for select using (auth.uid() = user_id);
create policy "Users can insert own digests" on digests for insert with check (auth.uid() = user_id);
```

### Trigger: auto-create profile on signup
```sql
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
```

---

## API Routes

All routes under `app/api/`. Use Next.js Route Handlers.

### `POST /api/articles/fetch`
Triggers the AI agent to search and curate articles.

**Auth**: Required (read user's topics from profile)

**Flow**:
1. Get user's topics from `profiles`
2. Call Claude API with web search tool enabled
3. Claude searches the web for recent articles matching the topics
4. Parse the JSON response (array of articles with title, url, source, summary, score, topic)
5. Deduplicate against existing articles (by url + user_id)
6. Insert new articles into `articles` table
7. Return the new articles

**Claude System Prompt for fetching**:
```
You are an article curation agent. Given a list of topics the user is interested in, search the web for the most interesting, recent, and high-quality articles, blog posts, and Twitter/X threads on those topics.

For each article found, return a JSON array of objects with these fields:
- title: The article title
- url: The URL
- source: The publication or author name (just the domain or author, keep it short)
- summary: A 1-2 sentence summary of the key insight
- score: A relevance/quality score from 1-10
- topic: Which user topic this matches

Return ONLY valid JSON. No markdown, no backticks, no preamble. Just the JSON array.
Find 8-12 articles total, prioritizing:
1. Recency (last 48 hours preferred)
2. Quality of insight (not clickbait)
3. Diversity across the requested topics
4. Original sources over aggregators
```

**Claude API call shape**:
```typescript
const response = await anthropic.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 4000,
  system: FETCH_SYSTEM_PROMPT,
  messages: [{ role: "user", content: userPrompt }],
  tools: [{ type: "web_search_20250305", name: "web_search" }],
});
```

### `POST /api/articles/digest`
Generates detailed digests for specific articles (typically today's picks).

**Auth**: Required

**Body**: `{ articleIds: string[] }`

**Flow**:
1. Fetch the articles by ID (verify they belong to the user)
2. Skip articles that already have a digest
3. Call Claude API with web search to read and analyze each article
4. Parse the JSON response
5. Insert digests into `digests` table
6. Return the digests

**Claude System Prompt for digesting**:
```
You are a reading digest assistant. You will be given articles (title, source, summary, url). Your job is to read each article via web search and produce a detailed digest for the reader.

For EACH article, produce:
1. A list of 3-5 key takeaways (the most important and interesting points)
2. A "why it matters" explanation (1-2 sentences on why this is relevant)
3. A verdict: "Must Read" if the full article is worth reading in full, or "Digest Enough" if the summary covers the essentials

Return ONLY valid JSON. No markdown, no backticks. Format:
[
  {
    "articleId": "the article uuid",
    "takeaways": ["point 1", "point 2", "point 3"],
    "whyItMatters": "explanation",
    "verdict": "Must Read" or "Digest Enough"
  }
]
```

### `GET /api/articles/today`
Returns today's daily picks for the user.

**Auth**: Required

**Flow**:
1. Check if picks already exist for today in `daily_picks`
2. If yes, return those articles with their digests
3. If no, select 2 articles: sort unread by score desc, take top 6, deterministically shuffle using date as seed, pick first 2
4. Insert into `daily_picks`
5. Return articles with any existing digests

### `GET /api/articles`
Returns articles for the user with filtering.

**Auth**: Required

**Query params**: `?view=unread|read|all&limit=50&offset=0`

### `PATCH /api/articles/[id]`
Update an article (mark read/unread).

**Auth**: Required

**Body**: `{ read: boolean }`

### `DELETE /api/articles/[id]`
Remove an article.

**Auth**: Required

### `GET /api/profile`
Get user profile.

### `PATCH /api/profile`
Update user profile (topics, display_name, daily_pick_count).

**Body**: `{ topics?: string[], displayName?: string, dailyPickCount?: number }`

---

## Pages

### `/` — Landing page
Simple, dark, minimal. Explain what the app does. CTA to sign up. Show a preview of the daily reads UI.

### `/login` — Auth page
Supabase Auth UI or custom form. Support email/password and Google OAuth. After login, redirect to `/reads`.

### `/signup` — Registration
Email + password. After signup, redirect to `/onboarding`.

### `/onboarding` — Topic setup
First-time flow after signup. Show default topics, let user customize. Big "Start Reading" button that triggers the first fetch.

### `/reads` — Main app (protected)
The core experience. This is the redesigned Daily Reads UI:

**Header**: Logo left, settings icon + "Fetch Articles" button right.

**Decorative input bar**: Cosmetic bar matching the Minimal app style. Shows tagline: "Your curated reading list, powered by AI"

**Tab navigation**:
- Today's Reads — the 2 daily picks with full card layout + digest sections
- Queue (N) — unread articles in table list format
- All (N) — all articles in table list format
- Done (N) — read articles in table list format

**Today's Reads view**:
- Each article rendered as a card with: source, topic tag, score badge, title (linked), summary paragraph
- "Summarize Articles" button in tab bar triggers digest generation
- After digests load: Key Takeaways list (3-5 dashed items), Why It Matters (italic), Verdict badge (Must Read = green, Digest Enough = blue)
- "Read Full Article →" primary button + "Done Reading" text button

**List views** (Queue/All/Done):
- Table format: favicon initial circle | title + domain | date added
- Actions on hover: checkmark (toggle read), X (remove)
- Column headers: "Title" and "Created At"

**Settings panel** (toggled by gear icon):
- Textarea for topics (one per line)
- Save / Cancel / Clear All Articles buttons

**Footer**: Topic chips showing current interests

### `/reads/settings` (optional, could be inline panel)
Full settings page if needed: topics, notification preferences, account management.

---

## Auth Flow

Use Supabase Auth with the `@supabase/ssr` package for Next.js App Router.

### Middleware (`middleware.ts`)
- Refresh session on every request
- Protect `/reads` and `/api/*` routes (except `/api/auth/*`)
- Redirect unauthenticated users to `/login`
- Redirect authenticated users from `/login` to `/reads`

### Client Setup
```typescript
// lib/supabase/client.ts — browser client
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// lib/supabase/server.ts — server client
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options))
        },
      },
    }
  )
}
```

---

## Cron Jobs (Optional, Phase 2)

### Auto-fetch (daily at 6 AM user's timezone)
A Vercel cron job or Supabase Edge Function that:
1. Iterates all users
2. Calls the fetch endpoint for each
3. Generates daily picks
4. Optionally sends email digest

### Auto-digest (daily at 6:30 AM)
After picks are generated:
1. For each user's daily picks without digests
2. Generate digests
3. Optionally email the digest

Cron config in `vercel.json`:
```json
{
  "crons": [
    { "path": "/api/cron/fetch", "schedule": "0 6 * * *" },
    { "path": "/api/cron/digest", "schedule": "30 6 * * *" }
  ]
}
```

Secure cron routes with `CRON_SECRET` env var check.

---

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
CRON_SECRET=
```

---

## File Structure

```
daily-reads/
├── CLAUDE.md
├── app/
│   ├── layout.tsx              # Root layout, Switzer font, dark theme
│   ├── page.tsx                # Landing page
│   ├── login/
│   │   └── page.tsx            # Login form
│   ├── signup/
│   │   └── page.tsx            # Signup form
│   ├── onboarding/
│   │   └── page.tsx            # Topic setup (protected)
│   ├── reads/
│   │   ├── layout.tsx          # App shell (protected)
│   │   └── page.tsx            # Main reads view
│   └── api/
│       ├── auth/
│       │   ├── callback/route.ts
│       │   ├── login/route.ts
│       │   └── signup/route.ts
│       ├── articles/
│       │   ├── route.ts        # GET list, POST is unused
│       │   ├── fetch/route.ts  # POST trigger fetch
│       │   ├── digest/route.ts # POST generate digests
│       │   ├── today/route.ts  # GET today's picks
│       │   └── [id]/route.ts   # PATCH, DELETE single article
│       ├── profile/
│       │   └── route.ts        # GET, PATCH profile
│       └── cron/
│           ├── fetch/route.ts
│           └── digest/route.ts
├── components/
│   ├── ArticleCard.tsx         # Today's pick card with digest
│   ├── ArticleRow.tsx          # Table row for list views
│   ├── DigestSection.tsx       # Takeaways + verdict display
│   ├── Header.tsx              # App header
│   ├── SettingsPanel.tsx       # Topics editor
│   ├── TabNav.tsx              # View tabs
│   └── AuthForm.tsx            # Login/signup form
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── middleware.ts
│   ├── anthropic.ts            # Claude API client + prompts
│   ├── picks.ts                # Daily pick selection logic
│   └── types.ts                # TypeScript types
├── middleware.ts
├── tailwind.config.ts
├── package.json
└── .env.local
```

---

## Key Implementation Notes

1. **Claude API calls happen server-side only**. The Anthropic API key never reaches the client. All AI interactions go through Next.js API routes.

2. **Daily pick selection is deterministic**. Given the same set of unread articles and the same date, the same 2 articles are always picked. This uses a seeded shuffle based on the date string so picks stay consistent if the user refreshes.

3. **Deduplication by URL**. When fetching new articles, skip any URL the user already has. The `unique(user_id, url)` constraint handles this at the DB level too — use `on conflict do nothing`.

4. **Parse Claude's response defensively**. The response might include markdown fences or preamble text despite the prompt. Always try to extract JSON: strip backtick fences, look for `[...]` pattern, try/catch the parse.

5. **Digests are generated on-demand, not automatically**. The user clicks "Summarize Articles" on the today view. This keeps API costs predictable.

6. **RLS handles authorization**. Every table has row-level security tied to `auth.uid()`. API routes still validate auth but don't need manual user_id filtering in queries.

7. **The decorative input bar is not functional**. It's purely visual, matching the Minimal bookmarking app aesthetic. It shows the tagline and a ⌘F shortcut badge.

---

## Phase 1 (MVP — build this first)
- [x] Supabase project setup + schema
- [x] Auth (signup, login, session management)
- [x] Profile + topics management
- [x] Manual article fetching via Claude + web search
- [x] Article list views (today, queue, all, done)
- [x] Daily picks selection
- [x] On-demand digest generation
- [x] Mark read / remove articles

## Phase 2 (After MVP works)
- [x] Onboarding flow for new users
- [x] Cron-based auto-fetch + auto-digest
- [ ] Email digest delivery
- [x] Landing page
- [x] Google OAuth
- [x] Keyboard shortcuts (j/k navigation, m to mark read)
- [ ] Article search/filter
