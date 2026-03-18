import { Skeleton } from "@/components/ui/skeleton";
import { SettingsSectionSkeleton } from "@/components/settings/states/settings-section-skeleton";

export default function PaymentMethodsLoading() {
  return (
    <div className="p-4 md:p-6 space-y-5 md:space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-44 sm:w-60" />
        <Skeleton className="h-4 w-full max-w-[19rem] sm:max-w-[30rem]" />
      </div>

      <SettingsSectionSkeleton rows={2} showBadge showHeader={false} />
      <SettingsSectionSkeleton rows={3} showHeader={false} compact />
    </div>
  );
}
