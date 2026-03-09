import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
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
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
