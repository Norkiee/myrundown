import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="max-w-md text-center">
        <div className="flex items-center justify-center gap-2 mb-6">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            className="text-text-primary"
          >
            <rect
              x="3"
              y="3"
              width="18"
              height="18"
              rx="4"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <line
              x1="7"
              y1="8"
              x2="17"
              y2="8"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <line
              x1="7"
              y1="12"
              x2="17"
              y2="12"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <line
              x1="7"
              y1="16"
              x2="13"
              y2="16"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <h1 className="text-2xl font-semibold text-text-primary">
            Daily Reads
          </h1>
        </div>

        <p className="text-text-secondary mb-8 leading-relaxed">
          Your curated reading list, powered by AI. Get 2 hand-picked articles
          every day with detailed digests so you can decide what&apos;s worth
          your time.
        </p>

        <Link
          href="/login"
          className="inline-block px-8 py-3 bg-text-primary text-background font-medium rounded-lg hover:bg-text-secondary transition-colors"
        >
          Get Started
        </Link>
      </div>
    </div>
  );
}
