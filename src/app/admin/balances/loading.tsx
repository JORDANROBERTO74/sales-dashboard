import { Skeleton } from "@/components/ui/skeleton";

export default function AdminBalancesLoading() {
  return (
    <div className="p-4 md:p-6 space-y-5 md:space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-40 sm:w-52" />
        <Skeleton className="h-4 w-full max-w-[18rem] sm:max-w-[28rem]" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-md border p-4 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-44" />
          </div>
        ))}
      </div>
      <div className="rounded-md border p-4 space-y-3">
        <Skeleton className="h-5 w-64" />
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
