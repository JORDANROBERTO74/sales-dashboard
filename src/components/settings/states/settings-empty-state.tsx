"use client";

type SettingsEmptyStateProps = {
  title: string;
  description?: string;
};

export function SettingsEmptyState({ title, description }: SettingsEmptyStateProps) {
  return (
    <div className="rounded-md border border-dashed p-4">
      <p className="text-sm font-medium">{title}</p>
      {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
}
