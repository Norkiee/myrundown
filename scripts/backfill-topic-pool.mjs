#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { config } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "..", ".env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing Supabase env vars in .env.local");
  process.exit(1);
}

function normalizeTopic(input) {
  return input
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.,!?;:]+$/, "")
    .toLowerCase();
}

const supabase = createClient(url, key);

const { data: profiles, error } = await supabase
  .from("profiles")
  .select("topics");

if (error) {
  console.error("Failed to read profiles:", error.message);
  process.exit(1);
}

const counts = new Map();
for (const profile of profiles || []) {
  for (const topic of profile.topics || []) {
    if (typeof topic !== "string") continue;
    const display = topic.trim().replace(/\s+/g, " ");
    const normalized = normalizeTopic(display);
    if (!normalized || normalized.length > 200) continue;
    const entry = counts.get(normalized) || { display, count: 0 };
    entry.count += 1;
    counts.set(normalized, entry);
  }
}

let inserted = 0;
let bumped = 0;

for (const [normalized, { display, count }] of counts) {
  const { data: existing } = await supabase
    .from("topic_pool")
    .select("count")
    .eq("normalized", normalized)
    .maybeSingle();

  if (existing) {
    const { error: updErr } = await supabase
      .from("topic_pool")
      .update({ count: existing.count + count })
      .eq("normalized", normalized);
    if (!updErr) bumped += 1;
  } else {
    const { error: insErr } = await supabase
      .from("topic_pool")
      .insert({ normalized, display, count, source: "user" });
    if (!insErr) inserted += 1;
  }
}

console.log(`Inserted ${inserted}, bumped ${bumped}.`);
