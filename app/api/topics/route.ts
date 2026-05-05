import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/admin";
import type { TopicPoolEntry } from "@/lib/types";
import { normalizeTopic, MAX_TOPIC_LENGTH } from "@/lib/normalize-topic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("topic_pool")
    .select("normalized, display, count")
    .order("count", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const response = NextResponse.json(data as TopicPoolEntry[]);
  response.headers.set("Cache-Control", "private, max-age=60, must-revalidate");
  return response;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { topic?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw = typeof body.topic === "string" ? body.topic : "";
  const display = raw.trim().replace(/\s+/g, " ");
  const normalized = normalizeTopic(raw);

  if (!normalized) {
    return NextResponse.json({ error: "Topic is empty" }, { status: 400 });
  }
  if (normalized.length > MAX_TOPIC_LENGTH) {
    return NextResponse.json({ error: "Topic too long" }, { status: 400 });
  }

  const adminClient = createAdminClient();

  const { data: existing, error: lookupError } = await adminClient
    .from("topic_pool")
    .select("normalized, display, count")
    .eq("normalized", normalized)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json({ error: lookupError.message }, { status: 500 });
  }

  if (existing) {
    const { data: updated, error: updateError } = await adminClient
      .from("topic_pool")
      .update({ count: existing.count + 1 })
      .eq("normalized", normalized)
      .select("normalized, display, count")
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
    return NextResponse.json(updated);
  }

  const { data: inserted, error: insertError } = await adminClient
    .from("topic_pool")
    .insert({
      normalized,
      display,
      source: "user",
      count: 1,
    })
    .select("normalized, display, count")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json(inserted, { status: 201 });
}
