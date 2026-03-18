import { Skeleton } from "@/components/ui/skeleton";
import { SettingsSectionSkeleton } from "@/components/settings/states/settings-section-skeleton";

export function TransactionDetailPageLoading() {
  return (
    <div className="p-4 md:p-6 space-y-5 md:space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-52 sm:w-64" />
        <Skeleton className="h-4 w-full max-w-[20rem] sm:max-w-[30rem]" />
      </div>
      <SettingsSectionSkeleton rows={3} showHeader compact showBadge />
    </div>
  );
}
