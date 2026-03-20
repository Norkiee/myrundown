import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/admin";
import { fetchArticlesForUser } from "@/lib/article-fetch";

export async function POST() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get user's topics
  const { data: profile } = await supabase
    .from("profiles")
    .select("topics")
    .eq("id", user.id)
    .single();

  if (!profile?.topics || profile.topics.length === 0) {
    return NextResponse.json(
      { error: "No topics configured. Please add topics in settings." },
      { status: 400 }
    );
  }

  try {
    const result = await fetchArticlesForUser({
      userId: user.id,
      topics: profile.topics,
      supabase: createAdminClient(),
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Fetch articles error:", error);
    return NextResponse.json(
      { error: "Failed to fetch articles from AI" },
      { status: 500 }
    );
  }
}
