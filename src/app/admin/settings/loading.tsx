import { Skeleton } from "@/components/ui/skeleton";

export default function AdminSettingsLoading() {
  return (
    <div className="p-4 md:p-6 space-y-5 md:space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-40 sm:w-52" />
        <Skeleton className="h-4 w-full max-w-[18rem] sm:max-w-[28rem]" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="rounded-md border p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-5 w-28 sm:w-32" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full max-w-[16rem] sm:max-w-[90%]" />
            </div>
            <Skeleton className="h-9 w-full sm:w-32" />
          </div>
        ))}
      </div>
    </div>
  );
}
