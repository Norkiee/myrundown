import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const view = searchParams.get("view") || "unread";
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = parseInt(searchParams.get("offset") || "0");

  let query = supabase
    .from("articles")
    .select("*")
    .eq("user_id", user.id)
    .order("saved_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (view === "unread") {
    query = query.eq("read", false);
  } else if (view === "read") {
    query = query.eq("read", true);
  }
  // "all" returns everything without filter

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
