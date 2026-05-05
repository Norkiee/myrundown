#!/usr/bin/env node
import Anthropic from "@anthropic-ai/sdk";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { config } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "..", ".env.local") });

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error("ANTHROPIC_API_KEY missing. Set it in .env.local.");
  process.exit(1);
}

const client = new Anthropic({ apiKey });

const SYSTEM = `You produce a curated list of high-quality reading topics for a personal news/article curation app. Topics should be:
- Concrete enough that an AI agent can search the web for relevant articles
- Phrased as noun phrases (not questions or sentences)
- Between 3 and 80 characters
- Spread across many domains: AI, software engineering, indie hacking, product/UX, fundraising, economics, climate, science, geopolitics, design, philosophy, sports, food, etc.

Return ONLY valid JSON: an array of 150 strings. No markdown, no preamble, no commentary.`;

const USER = `Generate a JSON array of exactly 150 reading topics. Diverse, well-phrased, no near-duplicates.`;

function normalizeTopic(input) {
  return input
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.,!?;:]+$/, "")
    .toLowerCase();
}

const response = await client.messages.create({
  model: "claude-haiku-4-5-20251001",
  max_tokens: 4000,
  system: SYSTEM,
  messages: [{ role: "user", content: USER }],
});

const text = response.content
  .filter((b) => b.type === "text")
  .map((b) => b.text)
  .join("\n")
  .replace(/```json\s*/g, "")
  .replace(/```\s*/g, "")
  .trim();

let topics;
try {
  topics = JSON.parse(text);
} catch (err) {
  console.error("Failed to parse JSON from Claude:");
  console.error(text);
  process.exit(1);
}

if (!Array.isArray(topics)) {
  console.error("Expected a JSON array, got:", typeof topics);
  process.exit(1);
}

const seen = new Set();
const cleaned = [];
for (const t of topics) {
  if (typeof t !== "string") continue;
  const display = t.trim().replace(/\s+/g, " ");
  if (display.length < 3 || display.length > 200) continue;
  const norm = normalizeTopic(display);
  if (seen.has(norm)) continue;
  seen.add(norm);
  cleaned.push({ normalized: norm, display });
}

const out = resolve(__dirname, "topic-seeds.json");
writeFileSync(out, JSON.stringify(cleaned, null, 2) + "\n");
console.log(`Wrote ${cleaned.length} topics to ${out}`);
