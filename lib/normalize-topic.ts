export function normalizeTopic(input: string): string {
  return input
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.,!?;:]+$/, "")
    .toLowerCase();
}

export const MAX_TOPIC_LENGTH = 200;
