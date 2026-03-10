# My Rundown — AI Article Curation Agent

## What This Is

My Rundown is a web app that uses AI to curate a personalized reading list. Every day at 6 AM, it picks 2 articles for the user and generates detailed digests (key takeaways, why it matters, read/skip verdict) so they can decide if the full article is worth their time.

Users sign up via magic link, define their interests, and the system handles the rest: fetching, scoring, picking, summarizing, and emailing.

**Live URL**: https://myrundown.xyz
**Repository**: https://github.com/Norkiee/myrundown

---

## Tech Stack

- **Framework**: Next.js 16+ (App Router)
- **Language**: TypeScript
- **Database**: Supabase (Postgres + Auth)
- **AI**:
  - Article fetching: Claude Sonnet with web search tool
  - Digest generation: Claude Haiku (cost-efficient, no web search)
- **Styling**: Tailwind CSS with Switzer font (from CDN Fonts)
- **Email**: Resend (SMTP for magic links + API for notifications)
- **Deployment**: Vercel
- **Cron**: Vercel Cron Jobs (daily at 6 AM)

---

## Current Features

### Authentication
- **Magic link only** — no passwords, no Google OAuth
- Users enter email, receive magic link via Resend SMTP
- Supabase handles session management
- Custom branded email template matching dark theme

### Article Fetching (Automated)
- Runs daily at 6 AM via Vercel cron
- Uses Claude Sonnet with web search to find 5-8 articles per user
- Scores articles 1-10 based on relevance and quality
- Deduplicates by URL

### Daily Picks
- Selects 2 top articles per day using deterministic seeded shuffle
- Ensures consistent picks if user refreshes
- Stored in `daily_picks` table

### Digest Generation (Automated)
- Generated immediately after fetch (non-blocking)
- Uses Claude Haiku for cost efficiency
- Creates: key takeaways, why it matters, verdict (Must Read / Digest Enough)
- No web search — uses existing article summary

### Email Notifications
- Sent as part of the 6 AM fetch cron
- All users receive email at 6 AM with their daily picks
- Styled HTML email matching app theme
- Via Resend API

### Push Notifications
- Web Push API with VAPID keys
- Toggle in settings panel (switch UI with optimistic updates)
- Sent alongside emails in the 6 AM cron
- Service worker handles incoming pushes and notification clicks
- Auto-removes invalid subscriptions (410 status)
- Test endpoint at `/api/push/test` for manual testing

### PWA (Progressive Web App)
- Installable on iOS, Android, and desktop
- Standalone display mode (no browser chrome)
- Custom icons (192px, 512px, maskable, apple-touch-icon)
- Offline fallback page
- Service worker with network-first strategy
- Safe area insets for iOS notch/home indicator

### UI/UX
- Dark, minimal design inspired by Minimal bookmarking app
- Custom app icon (`app/icon.svg`)
- Article carousel with navigation dots and arrows below
- "Read Full Article" and "Done Reading" buttons on cards
- Hover-based actions on desktop, always-visible on mobile
- Tab pills horizontally scrollable on mobile
- Settings panel with: topics editor, push notification toggle, logout button
- Save button disabled when no changes made

---

## Design System

### Visual Direction
Dark, minimal, content-centered. Not generic SaaS — a reading tool for one person.

### Colors
- **Background**: `#080808`
- **Text primary**: `#ddd8d0`
- **Text secondary**: `#b5b0a8`
- **Text muted**: `#444`
- **Surface**: `#0e0e0e`
- **Border**: `#191919`
- **Accent (CTA)**: `#ddd8d0` on dark (inverted)
- **Success/Green**: `#48a870` on `#0a1f12`
- **Error/Red**: `#ef4444` on `#1f0a0a`

### Typography
- **Font**: Switzer (from `https://fonts.cdnfonts.com/css/switzer`)
- **Content max-width**: `640px`, centered

### Components
- **Border radius**: `8px` for buttons, `10-12px` for cards/panels
- **No heavy shadows, no gradients** — flat, bordered surfaces
- **Animations**: Subtle fade-ups (200-400ms), no bouncing

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
  notify_time text default '08:00',  -- kept for future use
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
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
```

### `push_subscriptions` table
```sql
create table push_subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now(),
  unique(user_id, endpoint)
);
```

---

## API Routes

### Articles
- `GET /api/articles` — List articles with filtering (`?view=queue|all|done`)
- `GET /api/articles/today` — Today's picks with digests (generates digests in background if missing)
- `POST /api/articles/fetch` — Manual fetch trigger (used by onboarding)
- `PATCH /api/articles/[id]` — Update article (mark read/unread)
- `DELETE /api/articles/[id]` — Remove article

### Profile
- `GET /api/profile` — Get user profile
- `PATCH /api/profile` — Update topics

### Auth
- `GET /api/auth/callback` — Server-side magic link handler (legacy, kept for compatibility)
- `GET /auth/callback` — Client-side auth callback page (handles PKCE, token_hash, hash fragments)
- `POST /api/auth/ensure-profile` — Creates profile if missing (uses service role to bypass RLS)

### Push Notifications
- `POST /api/push/subscribe` — Save push subscription
- `DELETE /api/push/subscribe` — Remove push subscription
- `POST /api/push/test` — Send test notification to all subscribers (requires CRON_SECRET)

### Cron
- `GET /api/cron/fetch` — Daily fetch + picks + digests + email + push (runs at 6 AM)
- `GET /api/cron/notify` — **DISABLED** (code commented out, kept for reference)

---

## Pages

### `/` — Landing page
Simple CTA to sign up with custom icon.

### `/login` — Auth page
Magic link email input only. No password, no Google OAuth.

### `/onboarding` — Topic setup
First-time flow after signup. Default topics provided, user can customize. Triggers first article fetch.

### `/reads` — Main app (protected)
- **Header**: Custom icon + "My Rundown" text, settings gear
- **Tabs**: Today's Reads, Queue (N), All (N), Done (N)
- **Today view**: Article carousel with digest sections, navigation arrows below
- **List views**: Table with hover actions (checkmark, X)
- **Settings panel**: Topics editor only (notification time removed)

---

## Cron Configuration

**`vercel.json`**:
```json
{
  "crons": [
    {
      "path": "/api/cron/fetch",
      "schedule": "0 6 * * *"
    }
  ]
}
```

The fetch cron does everything:
1. Fetches new articles for all users (Claude Sonnet + web search)
2. Creates daily picks
3. Generates digests (Claude Haiku)
4. Sends email notifications (Resend API)

---

## Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Anthropic
ANTHROPIC_API_KEY=

# Resend (for email notifications)
RESEND_API_KEY=
RESEND_FROM_EMAIL=My Rundown <noreply@myrundown.xyz>

# Vercel Cron
CRON_SECRET=

# Push Notifications (VAPID keys)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=

# App URL
NEXT_PUBLIC_APP_URL=https://myrundown.xyz
```

To generate new VAPID keys: `npx web-push generate-vapid-keys`

### Supabase Auth Settings
- **Site URL**: `https://myrundown.xyz`
- **Redirect URLs**: `https://myrundown.xyz/**`, `https://myrundown.xyz/auth/callback`
- **SMTP**: Configured via Resend (smtp.resend.com, port 465)

---

## File Structure

```
myrundown/
├── CLAUDE.md
├── app/
│   ├── icon.svg                # Custom app icon
│   ├── layout.tsx              # Root layout, Switzer font, dark theme, PWA meta
│   ├── page.tsx                # Landing page
│   ├── login/page.tsx          # Magic link auth
│   ├── onboarding/page.tsx     # Topic setup
│   ├── offline/page.tsx        # PWA offline fallback
│   ├── auth/callback/page.tsx  # Client-side auth callback
│   ├── reads/
│   │   ├── layout.tsx          # App shell
│   │   └── page.tsx            # Main reads view
│   └── api/
│       ├── auth/
│       │   ├── callback/route.ts    # Server-side auth (legacy)
│       │   └── ensure-profile/route.ts
│       ├── articles/
│       │   ├── route.ts
│       │   ├── fetch/route.ts
│       │   ├── today/route.ts
│       │   └── [id]/route.ts
│       ├── profile/route.ts
│       ├── push/
│       │   ├── subscribe/route.ts   # Save/delete push subscriptions
│       │   └── test/route.ts        # Test push endpoint
│       └── cron/
│           ├── fetch/route.ts   # Main cron (fetch + digest + email + push)
│           └── notify/route.ts  # Disabled
├── components/
│   ├── ArticleCarousel.tsx     # Today's picks carousel
│   ├── ArticleRow.tsx          # List row with hover/touch actions
│   ├── AuthForm.tsx            # Magic link form
│   ├── DigestSection.tsx       # Takeaways + verdict
│   ├── Header.tsx              # App header with icon
│   ├── PushNotificationToggle.tsx  # Push notification switch
│   ├── ServiceWorkerRegistration.tsx  # SW registration
│   ├── SettingsPanel.tsx       # Topics, push toggle, logout
│   ├── Skeleton.tsx            # Loading skeletons
│   └── TabNav.tsx              # View tabs (horizontally scrollable)
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── middleware.ts
│   ├── anthropic.ts            # Claude API + prompts
│   ├── picks.ts                # Daily pick selection
│   └── types.ts                # TypeScript types
├── public/
│   ├── manifest.json           # PWA manifest
│   ├── sw.js                   # Service worker
│   └── icons/
│       ├── icon-192.png
│       ├── icon-512.png
│       ├── icon-maskable-512.png
│       └── apple-touch-icon.png
├── scripts/
│   └── generate-icons.mjs      # Icon generation script
├── middleware.ts
├── vercel.json
└── package.json
```

---

## Key Implementation Notes

1. **Magic link auth only** — No passwords stored, no OAuth complexity. Users receive branded emails via Resend SMTP.

2. **Cost optimization** — Article fetching uses Sonnet (needs web search), but digest generation uses Haiku (cheaper, no web search needed).

3. **Non-blocking digests** — `/api/articles/today` triggers digest generation in background and returns immediately. User sees loading state, refreshes to see digests.

4. **Single daily cron** — Everything happens at 6 AM: fetch → picks → digests → email. No frequent crons (Vercel Hobby limitation).

5. **Deterministic picks** — Same articles + same date = same picks. Uses seeded shuffle based on date string.

6. **Custom icon** — SVG icon at `app/icon.svg` used as favicon and throughout the app.

7. **No keyboard shortcuts** — Removed due to complexity. Hover-based actions only.

---

## Removed Features

- **Google OAuth** — Removed, magic link only
- **Keyboard shortcuts** — Removed (j/k navigation, m to mark read)
- **User-specific notification times** — Removed (requires Vercel Pro for frequent crons)
- **Manual fetch button** — Removed (auto-fetch only)
- **Score badge on cards** — Removed for cleaner UI

---

## Completed Work

### Phase 1 (MVP)
- [x] Supabase project setup + schema
- [x] Auth (magic link via Supabase OTP)
- [x] Profile + topics management
- [x] Article fetching via Claude + web search
- [x] Article list views (today, queue, all, done)
- [x] Daily picks selection
- [x] Digest generation
- [x] Mark read / remove articles

### Phase 2
- [x] Onboarding flow for new users
- [x] Cron-based auto-fetch + auto-digest
- [x] Email notifications (via Resend, sent with fetch cron)
- [x] Landing page
- [x] Custom app icon
- [x] Renamed to "My Rundown"
- [x] Domain: myrundown.xyz

### Phase 3 (PWA + Push)
- [x] PWA manifest and service worker
- [x] Offline fallback page
- [x] PWA icons (192, 512, maskable, apple-touch)
- [x] iOS safe area support
- [x] Push notifications (VAPID, subscribe/unsubscribe)
- [x] Push notification toggle in settings (switch UI)
- [x] Push notifications in daily cron
- [x] Test endpoint for push notifications
- [x] Logout button in settings
- [x] Mobile-friendly touch targets
- [x] Horizontally scrollable tab pills
- [x] Auth callback fixes (client-side handling)
- [x] RLS bypass with service role for profile operations

### Not Implemented
- [ ] Article search/filter
- [ ] User-specific notification times (needs Vercel Pro)
- [ ] Google OAuth (removed by choice)

---

## Current Status (March 2026)

**Where we left off:**
- PWA fully implemented and working
- Push notifications implemented and tested
- All core features complete

**Known issues to watch:**
- API routes use admin client (service role) to bypass RLS — this works but means RLS policies aren't enforced server-side
- VAPID key encoding was tricky — ensure no extra whitespace in env vars

**To test push notifications:**
```bash
curl -X POST "https://myrundown.xyz/api/push/test" -H "Authorization: Bearer YOUR_CRON_SECRET"
```
