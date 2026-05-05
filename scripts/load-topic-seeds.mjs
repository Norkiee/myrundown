#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { config } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "..", ".env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key);

const seeds = JSON.parse(
  readFileSync(resolve(__dirname, "topic-seeds.json"), "utf8")
);

let inserted = 0;
let skipped = 0;

for (const { normalized, display } of seeds) {
  const { data: existing } = await supabase
    .from("topic_pool")
    .select("normalized")
    .eq("normalized", normalized)
    .maybeSingle();

  if (existing) {
    skipped += 1;
    continue;
  }

  const { error } = await supabase.from("topic_pool").insert({
    normalized,
    display,
    count: 1,
    source: "seed",
  });

  if (error) {
    console.error(`Failed to insert "${normalized}":`, error.message);
    continue;
  }
  inserted += 1;
}

console.log(`Inserted ${inserted} new seeds, skipped ${skipped} existing.`);
