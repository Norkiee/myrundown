"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function AuthCallbackHandler() {
  const [status, setStatus] = useState("Signing you in...");
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
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
  }, [router, searchParams]);

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
