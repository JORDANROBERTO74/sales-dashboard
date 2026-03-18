"use client";

import { Skeleton } from "@/components/ui/skeleton";

type SettingsSectionSkeletonProps = {
  rows?: number;
  showHeader?: boolean;
  showActions?: boolean;
  showBadge?: boolean;
  compact?: boolean;
  buttonFullOnMobile?: boolean;
};

export function SettingsSectionSkeleton({
  rows = 3,
  showHeader = true,
  showActions = false,
  showBadge = false,
  compact = false,
  buttonFullOnMobile = true,
}: SettingsSectionSkeletonProps) {
  return (
    <div className="space-y-4">
      {showHeader ? (
        <div className="space-y-2">
          <Skeleton className="h-5 w-36 sm:w-52" />
          <Skeleton className="h-4 w-full max-w-[20rem] sm:max-w-[28rem]" />
        </div>
      ) : null}

      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={index}
            className={`rounded-md border ${compact ? "space-y-2 p-3" : "space-y-3 p-4"}`}
          >
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-4 w-32 sm:w-40" />
              {showBadge ? (
                <Skeleton className="h-5 w-14 rounded-full" />
              ) : null}
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full max-w-[18rem] sm:max-w-[85%]" />
            {showActions ? (
              <Skeleton
                className={`h-9 ${buttonFullOnMobile ? "w-full sm:w-32" : "w-32"}`}
              />
            ) : null}
          </div>
        ))}
      </div>

      {showActions ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Skeleton
            className={`h-9 ${buttonFullOnMobile ? "w-full sm:w-36" : "w-36"}`}
          />
          <Skeleton
            className={`h-9 ${buttonFullOnMobile ? "w-full sm:w-28" : "w-28"}`}
          />
        </div>
      ) : null}
    </div>
  );
}
