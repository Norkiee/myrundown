"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function AuthCallbackHandler() {
  const [status, setStatus] = useState("Signing you in...");
  const [showPwaPrompt, setShowPwaPrompt] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Check if running in standalone mode (PWA)
  const isStandalone = typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
     (window.navigator as Navigator & { standalone?: boolean }).standalone === true);

  useEffect(() => {
    // If not in PWA, show prompt to open in PWA
    if (typeof window !== "undefined" && !isStandalone) {
      setShowPwaPrompt(true);
      return;
    }

    const handleCallback = async () => {
      try {
        const supabase = createClient();

        // Get params from URL (query string)
        const code = searchParams.get("code");
        const token_hash = searchParams.get("token_hash");
        const type = searchParams.get("type");
        const error_description = searchParams.get("error_description");

        // Check for error from Supabase
        if (error_description) {
          console.error("Auth error:", error_description);
          router.push("/login?error=auth_callback_failed");
          return;
        }

        // Also check URL hash for tokens (implicit flow)
        const hash = window.location.hash;
        if (hash) {
          const hashParams = new URLSearchParams(hash.substring(1));
          const accessToken = hashParams.get("access_token");
          const refreshToken = hashParams.get("refresh_token");

          if (accessToken && refreshToken) {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (error) {
              console.error("Session error:", error);
              router.push("/login?error=auth_callback_failed");
              return;
            }
          }
        }

        // Handle PKCE code exchange
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            console.error("Code exchange error:", error);
            router.push("/login?error=auth_callback_failed");
            return;
          }
        }

        // Handle token_hash verification
        if (token_hash && type) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash,
            type: type as "email" | "magiclink",
          });
          if (error) {
            console.error("Token verify error:", error);
            router.push("/login?error=auth_callback_failed");
            return;
          }
        }

        // Check if we have a session now
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          // Ensure profile exists (calls server-side API that can bypass RLS)
          const profileRes = await fetch("/api/auth/ensure-profile", { method: "POST" });
          const profileData = await profileRes.json();

          if (profileData.created) {
            // New user - go to onboarding
            router.push("/onboarding");
            return;
          }

          // Check if user has articles using the client we already have
          const { count, error: countError } = await supabase
            .from("articles")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user.id);

          // If query fails or no articles, go to onboarding
          if (countError || !count || count === 0) {
            router.push("/onboarding");
          } else {
            router.push("/reads");
          }
        } else {
          setStatus("Authentication failed");
          setTimeout(() => router.push("/login?error=auth_callback_failed"), 1500);
        }
      } catch (err) {
        console.error("Auth callback error:", err);
        setStatus("Something went wrong");
        setTimeout(() => router.push("/login?error=auth_callback_failed"), 1500);
      }
    };

    handleCallback();
  }, [router, searchParams, isStandalone]);

  // Show prompt to open in PWA
  if (showPwaPrompt) {
    const currentUrl = typeof window !== "undefined" ? window.location.href : "";

    const copyLink = async () => {
      await navigator.clipboard.writeText(currentUrl);
      setStatus("Link copied! Now open My Rundown app and paste in browser.");
    };

    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <img src="/icon.svg" alt="My Rundown" width={32} height={32} />
            <span className="text-xl font-semibold text-text-primary">My Rundown</span>
          </div>

          <div className="bg-surface border border-border rounded-xl p-6">
            <h2 className="text-lg font-medium text-text-primary mb-2">
              Open in App
            </h2>
            <p className="text-text-secondary text-sm mb-6">
              To complete sign in, open this link in the My Rundown app.
            </p>

            <button
              onClick={copyLink}
              className="w-full py-3 bg-text-primary text-background font-medium rounded-lg hover:bg-text-secondary transition-colors mb-3"
            >
              Copy Link
            </button>

            <p className="text-text-muted text-xs">
              {status !== "Signing you in..." ? status : "Then paste it in the app's browser."}
            </p>

            <div className="mt-6 pt-4 border-t border-border">
              <button
                onClick={() => {
                  setShowPwaPrompt(false);
                  setStatus("Signing you in...");
                }}
                className="text-text-secondary text-sm hover:text-text-primary transition-colors"
              >
                Continue in browser instead
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-pulse-soft text-text-primary">{status}</div>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse-soft text-text-primary">Loading...</div>
        </div>
      </div>
    }>
      <AuthCallbackHandler />
    </Suspense>
  );
}
