import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="max-w-md text-center">
        <div className="flex items-center justify-center gap-2 mb-6">
          <img src="/icon.svg" alt="My Rundown" width={32} height={32} />
          <h1 className="text-2xl font-semibold text-text-primary">
            My Rundown
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
