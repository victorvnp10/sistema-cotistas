import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-2xl bg-secondary", className)} />;
}

export function LoadingSkeleton({ linhas = 3 }: { linhas?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: linhas }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}
