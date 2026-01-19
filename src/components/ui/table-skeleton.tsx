import { Skeleton } from "./skeleton";
import { cn } from "@/lib/utils";

interface TableSkeletonProps {
  rows?: number;
  cols?: number;
  className?: string;
}

export function TableSkeleton({ rows = 5, cols = 4, className }: TableSkeletonProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {/* Header row */}
      <div className="flex gap-4 pb-2 border-b border-border">
        {Array.from({ length: cols }).map((_, j) => (
          <Skeleton key={`header-${j}`} className="h-4 flex-1" />
        ))}
      </div>
      
      {/* Data rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={`row-${i}`} className="flex gap-4 py-2">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton 
              key={`cell-${i}-${j}`} 
              className={cn(
                "h-8 flex-1",
                j === 0 && "max-w-[200px]" // First column usually narrower
              )} 
            />
          ))}
        </div>
      ))}
    </div>
  );
}

interface CardSkeletonProps {
  className?: string;
}

export function CardSkeleton({ className }: CardSkeletonProps) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-6 space-y-4", className)}>
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
      <Skeleton className="h-10 w-24" />
      <Skeleton className="h-4 w-48" />
    </div>
  );
}

interface PageSkeletonProps {
  variant?: 'table' | 'cards' | 'mixed';
}

export function PageSkeleton({ variant = 'table' }: PageSkeletonProps) {
  if (variant === 'cards') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'mixed') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
        <div className="rounded-xl border border-border bg-card p-6">
          <TableSkeleton rows={5} cols={6} />
        </div>
      </div>
    );
  }

  // Default: table
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="rounded-xl border border-border bg-card p-6">
        <TableSkeleton rows={8} cols={6} />
      </div>
    </div>
  );
}
