import { Skeleton } from "@/components/ui/skeleton";
import { SettingsSectionSkeleton } from "@/components/settings/states/settings-section-skeleton";

export default function ProfileSettingsLoading() {
  return (
    <div className="p-4 md:p-6 space-y-5 md:space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-36 sm:w-44" />
        <Skeleton className="h-4 w-full max-w-[18rem] sm:max-w-[28rem]" />
      </div>

      <SettingsSectionSkeleton
        rows={2}
        showActions
        compact
        buttonFullOnMobile
        showHeader={false}
      />
    </div>
  );
}
