"use client";

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-shimmer bg-gradient-to-r from-surface via-border to-surface bg-[length:200%_100%] rounded ${className}`}
    />
  );
}

export function ArticleCardSkeleton() {
  return (
    <div className="p-6 bg-surface border border-border rounded-xl">
      {/* Meta row */}
      <div className="flex items-center gap-2 mb-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-12 rounded-full ml-auto" />
      </div>

      {/* Title */}
      <Skeleton className="h-7 w-3/4 mb-3" />

      {/* Summary */}
      <div className="space-y-2 mb-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>

      {/* Digest section */}
      <div className="mt-4 p-4 bg-surface-dark rounded-xl border border-border">
        <div className="flex items-center justify-between mb-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <div className="space-y-2 mb-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-4/5" />
        </div>
        <div className="pt-3 border-t border-border">
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4 mt-6 pt-4 border-t border-border">
        <Skeleton className="h-10 w-36 rounded-lg" />
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
  );
}

export function ArticleRowSkeleton() {
  return (
    <div className="flex items-center gap-3 py-3 px-2">
      <Skeleton className="w-8 h-8 rounded-full shrink-0" />
      <div className="flex-1 min-w-0">
        <Skeleton className="h-4 w-3/4 mb-1" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-3 w-16 shrink-0" />
    </div>
  );
}

export function SettingsSkeleton() {
  return (
    <div className="mb-6 p-5 bg-surface border border-border rounded-xl">
      <Skeleton className="h-3 w-24 mb-2" />
      <Skeleton className="h-4 w-48 mb-3" />
      <Skeleton className="h-24 w-full rounded-lg mb-6" />
      <Skeleton className="h-3 w-32 mb-2" />
      <Skeleton className="h-4 w-56 mb-3" />
      <Skeleton className="h-10 w-32 rounded-lg" />
    </div>
  );
}
