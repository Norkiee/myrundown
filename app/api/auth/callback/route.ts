import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  // Debug logging
  console.log("Auth callback params:", {
    code: code ? "present" : "missing",
    token_hash: token_hash ? "present" : "missing",
    type,
    fullUrl: request.url,
  });

  const supabase = await createClient();
  let authError: Error | null = null;

  // Handle PKCE flow (code parameter)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    authError = error;
    if (error) console.log("PKCE exchange error:", error.message);
  }
  // Handle token hash flow (magic link email confirmation)
  else if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as "email" | "magiclink",
    });
    authError = error;
    if (error) console.log("Token hash verify error:", error.message);
  } else {
    console.log("No code or token_hash found in callback");
  }

  if (!authError && (code || token_hash)) {
    // Get the user
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      // Check if profile exists
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .single();

      // Create profile if it doesn't exist (new user)
      if (!profile) {
        const adminClient = createServerClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          {
            cookies: {
              getAll() { return []; },
              setAll() {},
            },
          }
        );

        await adminClient
          .from("profiles")
          .insert({ id: user.id, email: user.email });

        // New user - go to onboarding
        return NextResponse.redirect(`${origin}/onboarding`);
      }

      // Existing user - check if they have articles
      const { count } = await supabase
        .from("articles")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      // No articles yet - go to onboarding
      if (count === 0) {
        return NextResponse.redirect(`${origin}/onboarding`);
      }
    }

    return NextResponse.redirect(`${origin}/reads`);
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
