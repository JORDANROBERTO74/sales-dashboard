"use client";

import { AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

type SettingsErrorStateProps = {
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
};

export function SettingsErrorState({
  message = "No pudimos cargar esta seccion. Intenta nuevamente.",
  onRetry,
  retryLabel = "Reintentar",
}: SettingsErrorStateProps) {
  return (
    <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4">
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" />
        <div className="space-y-3">
          <p className="text-sm text-destructive">{message}</p>
          {onRetry ? (
            <Button variant="outline" size="sm" onClick={onRetry}>
              <RotateCcw />
              {retryLabel}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
