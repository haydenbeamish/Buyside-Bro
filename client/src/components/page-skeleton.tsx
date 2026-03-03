import { Skeleton } from "@/components/ui/skeleton";

export function PageSkeleton() {
  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-5xl mx-auto px-2 sm:px-4 py-4 sm:py-6">
        <Skeleton className="h-8 w-48 bg-zinc-800 mb-6" />
        <div className="space-y-4">
          <Skeleton className="h-32 w-full bg-zinc-800 rounded-lg" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full bg-zinc-800 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-64 w-full bg-zinc-800 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
