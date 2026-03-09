import type { Digest } from "@/lib/types";

interface DigestSectionProps {
  digest: Digest;
}

export function DigestSection({ digest }: DigestSectionProps) {
  const isMustRead = digest.verdict === "Must Read";

  return (
    <div className="mt-4 p-4 bg-surface-dark rounded-xl border border-border transition-all duration-200 hover:border-border-hover">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-text-muted tracking-wide uppercase">
          Key Takeaways
        </span>
        <span
          className={`text-xs px-2.5 py-1 rounded-full transition-transform duration-200 hover:scale-105 ${
            isMustRead
              ? "bg-accent-green-bg text-accent-green"
              : "bg-accent-blue-bg text-accent-blue"
          }`}
        >
          {digest.verdict}
        </span>
      </div>

      <ul className="space-y-2.5 mb-4">
        {digest.takeaways.map((takeaway, i) => (
          <li
            key={i}
            className="text-sm text-text-secondary flex gap-2 animate-fade-up group"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <span className="text-text-muted transition-colors duration-200 group-hover:text-accent-blue">—</span>
            <span className="transition-colors duration-200 group-hover:text-text-primary">{takeaway}</span>
          </li>
        ))}
      </ul>

      <div className="pt-3 border-t border-border">
        <p className="text-sm text-text-muted italic leading-relaxed">
          {digest.why_it_matters}
        </p>
      </div>
    </div>
  );
}
