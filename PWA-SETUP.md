# My Rundown — PWA Setup Guide

## Overview

Turn My Rundown into an installable app on iPad, iPhone, and Android. No App Store needed. Users tap "Add to Home Screen" and it launches fullscreen with your custom icon, splash screen, and offline support.

This is the fastest path to a native-feeling experience with zero changes to your backend.

---

## What You Get

- Fullscreen app (no Safari chrome) on iPad and iPhone
- Custom splash screen with your icon on launch
- Offline page when there's no connection (graceful fallback)
- "Install app" prompt on Android Chrome
- App icon on home screen using your existing `app/icon.svg`
- Works with your existing magic link auth flow

---

## Files to Create

### 1. Web App Manifest

Create `public/manifest.json`:

```json
{
  "name": "My Rundown",
  "short_name": "Rundown",
  "description": "Your AI-curated daily reading list",
  "start_url": "/reads",
  "display": "standalone",
  "background_color": "#080808",
  "theme_color": "#080808",
  "orientation": "any",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-maskable-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ]
}
```

### 2. Service Worker

Create `public/sw.js`:

```javascript
const CACHE_NAME = "rundown-v1";
const OFFLINE_URL = "/offline";

// Cache the offline page on install
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        OFFLINE_URL,
        "/icons/icon-192.png",
        "/icons/icon-512.png",
      ]);
    })
  );
  self.skipWaiting();
});

// Clean old caches on activate
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Network-first strategy: try network, fall back to offline page
self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(OFFLINE_URL);
      })
    );
  }
});
```

**Note**: This is intentionally minimal — network-first for all navigation requests, offline fallback only when there's no connection. Don't cache API responses or article content (it changes daily). Don't cache auth routes (breaks magic link flow).

### 3. Offline Page

Create `app/offline/page.tsx`:

```tsx
export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <div className="mb-6 opacity-40">
          {/* Your icon SVG inline */}
          <svg width="48" height="48" viewBox="0 0 40 40" fill="none" className="mx-auto">
            <line x1="8" y1="12" x2="32" y2="12" stroke="#ddd8d0" strokeWidth="3" strokeLinecap="round"/>
            <line x1="8" y1="20" x2="26" y2="20" stroke="#ddd8d0" strokeWidth="3" strokeLinecap="round"/>
            <line x1="8" y1="28" x2="18" y2="28" stroke="#ddd8d0" strokeWidth="3" strokeLinecap="round"/>
          </svg>
        </div>
        <h1 className="text-[#ddd8d0] text-lg font-semibold mb-2">You're offline</h1>
        <p className="text-[#555] text-sm leading-relaxed">
          My Rundown needs an internet connection to fetch your daily reads. Reconnect and try again.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-8 bg-[#ddd8d0] text-[#080808] px-6 py-2 rounded-lg text-sm font-semibold"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
```

### 4. Icon Assets

Generate PNG icons from your existing `app/icon.svg`. Create these in `public/icons/`:

```
public/icons/
├── icon-192.png          # 192x192, transparent background
├── icon-512.png          # 512x512, transparent background
├── icon-maskable-512.png # 512x512, with #080808 background + padding
├── apple-touch-icon.png  # 180x180, with #080808 background (no transparency)
```

Generate them with sharp or any image tool:

```bash
npm install sharp --save-dev
```

Create `scripts/generate-icons.ts`:

```typescript
import sharp from "sharp";
import { readFileSync } from "fs";

const svg = readFileSync("app/icon.svg");

async function generate() {
  // Standard icons (transparent bg)
  await sharp(svg).resize(192, 192).png().toFile("public/icons/icon-192.png");
  await sharp(svg).resize(512, 512).png().toFile("public/icons/icon-512.png");

  // Maskable icon (needs padding + solid bg for adaptive icons)
  await sharp(svg)
    .resize(384, 384) // icon at 75% of canvas
    .extend({
      top: 64, bottom: 64, left: 64, right: 64,
      background: { r: 8, g: 8, b: 8, alpha: 1 },
    })
    .png()
    .toFile("public/icons/icon-maskable-512.png");

  // Apple touch icon (solid bg, no transparency)
  await sharp(svg)
    .resize(140, 140)
    .extend({
      top: 20, bottom: 20, left: 20, right: 20,
      background: { r: 8, g: 8, b: 8, alpha: 1 },
    })
    .png()
    .toFile("public/icons/apple-touch-icon.png");
}

generate();
```

Run with `npx tsx scripts/generate-icons.ts`.

---

## Files to Modify

### 5. Root Layout (`app/layout.tsx`)

Add these to the `<head>`:

```tsx
// Inside <head> of app/layout.tsx, add after existing <link> tags:

{/* PWA Manifest */}
<link rel="manifest" href="/manifest.json" />

{/* iOS/iPadOS meta tags */}
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="My Rundown" />
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />

{/* Theme color (matches your bg) */}
<meta name="theme-color" content="#080808" />

{/* Viewport for iPad (prevent zoom, proper scaling) */}
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
```

### 6. Service Worker Registration

Create `components/ServiceWorkerRegistration.tsx`:

```tsx
"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.error("SW registration failed:", err);
      });
    }
  }, []);

  return null;
}
```

Add it to your root layout body:

```tsx
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";

// Inside <body>:
<ServiceWorkerRegistration />
{children}
```

---

## iPad-Specific Considerations

### Safe Areas

iOS standalone mode has safe area insets (notch, home indicator). Add to your globals or layout:

```css
/* In your global CSS or tailwind layer */
body {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}
```

Or use Tailwind's arbitrary values on your main container:

```tsx
<main className="pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
```

### Touch Targets

Your existing hover-based actions on `ArticleRow` won't work on iPad (no hover). Add tap-to-reveal or always-visible actions for touch:

```tsx
// In ArticleRow.tsx, detect touch device and show actions differently
// Option A: Always show actions on touch devices
// Option B: Add swipe-to-reveal (more complex)
// Option C: Long-press context menu

// Simplest approach — always show on mobile:
<div className="flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
  {/* action buttons */}
</div>
```

### Magic Link on iPad

Magic links open in the default browser (Safari). If the user installed the PWA, the callback redirect needs to open back in the PWA, not Safari. This is a known iOS limitation.

**Workaround**: In your auth callback route (`app/api/auth/callback/route.ts`), after exchanging the code, redirect to the app URL. iOS will open it in the PWA if it's installed:

```typescript
// In your callback, the existing redirect should work:
return NextResponse.redirect(new URL("/reads", request.url));
```

If users report it opening in Safari instead of the PWA, add a small interstitial page that says "Open in My Rundown" with a link using your app URL. But test first — recent iOS versions handle this better.

### Pull-to-Refresh

Consider adding a pull-to-refresh gesture on the Today view to manually trigger article refresh. CSS `overscroll-behavior` can help:

```css
/* Prevent bounce scroll on the shell, allow it on content */
html, body {
  overscroll-behavior: none;
}
```

---

## Updated File Structure

```
myrundown/
├── public/
│   ├── manifest.json              # NEW
│   ├── sw.js                      # NEW
│   ├── icons/                     # NEW
│   │   ├── icon-192.png
│   │   ├── icon-512.png
│   │   ├── icon-maskable-512.png
│   │   └── apple-touch-icon.png
├── app/
│   ├── icon.svg                   # Existing
│   ├── layout.tsx                 # MODIFIED (add meta tags)
│   ├── offline/
│   │   └── page.tsx               # NEW
│   └── ...existing routes
├── components/
│   ├── ServiceWorkerRegistration.tsx  # NEW
│   └── ...existing components
├── scripts/
│   └── generate-icons.ts          # NEW (one-time use)
└── ...existing files
```

---

## Testing Checklist

### Desktop Chrome
- [ ] Manifest detected (DevTools → Application → Manifest)
- [ ] Service worker registered (DevTools → Application → Service Workers)
- [ ] Install prompt appears in address bar

### iPad Safari
- [ ] "Add to Home Screen" available in share sheet
- [ ] Launches fullscreen (no Safari UI)
- [ ] Status bar matches theme (#080808)
- [ ] Icon appears correctly on home screen
- [ ] Offline page shows when disconnected
- [ ] Magic link auth completes and returns to PWA
- [ ] Touch targets are large enough (min 44x44px)
- [ ] Article actions visible without hover
- [ ] Safe areas don't clip content
- [ ] Carousel swipe works smoothly

### Android Chrome
- [ ] Install banner/prompt appears
- [ ] Launches in standalone mode
- [ ] Theme color shows in task switcher

---

## What This Does NOT Cover

- Push notifications (requires a push service + VAPID keys + user permission flow — add later if email notifications aren't enough)
- Background sync (auto-fetch when back online — your 6 AM cron handles this server-side already)
- Full offline reading (caching article content for offline — significant complexity, low value since digests are the main feature)

These are Phase 3 features. The PWA setup above gets you 90% of the native feel with minimal code.
