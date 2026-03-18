import { Skeleton } from "@/components/ui/skeleton";
import { SettingsSectionSkeleton } from "@/components/settings/states/settings-section-skeleton";

export default function TeamSettingsLoading() {
  return (
    <div className="p-4 md:p-6 space-y-5 md:space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-28 sm:w-36" />
        <Skeleton className="h-4 w-full max-w-[18rem] sm:max-w-[28rem]" />
      </div>

      <SettingsSectionSkeleton
        rows={3}
        showActions
        showBadge
        showHeader={false}
      />
      <SettingsSectionSkeleton rows={2} compact showHeader={false} />
    </div>
  );
}
