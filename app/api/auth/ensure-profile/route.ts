import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";

export async function POST() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Use admin client for all operations to bypass RLS
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

  // Check if profile exists using admin client
  const { data: profile } = await adminClient
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .single();

  if (profile) {
    const { count } = await adminClient
      .from("articles")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    return NextResponse.json({
      exists: true,
      needsOnboarding: !count || count === 0,
    });
  }

  // Create profile
  const { error } = await adminClient
    .from("profiles")
    .insert({ id: user.id, email: user.email });

  if (error) {
    console.error("Profile creation error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    created: true,
    needsOnboarding: true,
  });
}
