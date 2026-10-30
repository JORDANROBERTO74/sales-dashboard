"use client";

import { CalendarIcon } from "lucide-react";
type DateRange = { from: Date | undefined; to: Date | undefined };
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

function formatDateRangeLabel(
  range?: DateRange,
  selectedPreset?: DateRangeShortcutPreset | "",
): string {
  if (selectedPreset === "always") return "Siempre";
  if (!range?.from && !range?.to) return "Selecciona rango";

  const formatDate = (value: Date) =>
    value.toLocaleDateString("es-BO", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  if (range.from && range.to) return `${formatDate(range.from)} - ${formatDate(range.to)}`;
  if (range.from) return `Desde ${formatDate(range.from)}`;
  return "Selecciona rango";
}

type DateRangeFilterProps = {
  id: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  range?: DateRange;
  onSelectRange: (nextRange: DateRange | undefined) => void;
  onClear: () => void;
  onSelectPreset?: (preset: DateRangeShortcutPreset, nextRange: DateRange | undefined) => void;
  selectedPreset?: DateRangeShortcutPreset | "";
  buttonClassName?: string;
  ariaLabel?: string;
  monthsToShow?: number;
};

export type DateRangeShortcutPreset =
  | "today"
  | "last_7_days"
  | "last_4_weeks"
  | "month_to_date"
  | "always";

function toLocalDateAtNoon(value: Date): Date {
  return new Date(
    value.getFullYear(),
    value.getMonth(),
    value.getDate(),
    12,
    0,
    0,
    0,
  );
}

function getShortcutRange(preset: DateRangeShortcutPreset): DateRange | undefined {
  const now = new Date();
  const today = toLocalDateAtNoon(now);

  if (preset === "always") return undefined;
  if (preset === "today") return { from: today, to: today };
  if (preset === "last_7_days") {
    const from = new Date(today);
    from.setDate(from.getDate() - 6);
    return { from, to: today };
  }
  if (preset === "last_4_weeks") {
    const from = new Date(today);
    from.setDate(from.getDate() - 27);
    return { from, to: today };
  }

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1, 12, 0, 0, 0);
  return { from: monthStart, to: today };
}

export function DateRangeFilter({
  id,
  open,
  onOpenChange,
  range,
  onSelectRange,
  onClear,
  onSelectPreset,
  selectedPreset = "",
  buttonClassName,
  ariaLabel,
  monthsToShow = 2,
}: DateRangeFilterProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !range?.from && selectedPreset !== "always" && "text-muted-foreground",
            buttonClassName,
          )}
          aria-label={ariaLabel}
        >
          <CalendarIcon className="mr-2 size-4" />
          {formatDateRangeLabel(range, selectedPreset)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <div className="p-2">
          <Label className="mb-2 block text-xs text-muted-foreground" htmlFor={`${id}-period-preset`}>
            Periodo
          </Label>
          <Select
            value={selectedPreset || undefined}
            onValueChange={(value) => {
              if (!onSelectPreset) return;
              const preset = value as DateRangeShortcutPreset;
              onSelectPreset(preset, getShortcutRange(preset));
            }}
          >
            <SelectTrigger
              id={`${id}-period-preset`}
              className="w-full"
              aria-label="Atajos de periodo"
            >
              <SelectValue placeholder="Atajos de periodo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoy</SelectItem>
              <SelectItem value="last_7_days">Ultimos 7 dias</SelectItem>
              <SelectItem value="last_4_weeks">Ultimas 4 semanas</SelectItem>
              <SelectItem value="month_to_date">Acumulado del mes</SelectItem>
              <SelectItem value="always">Siempre</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="border-b px-2 pb-2">
          <Button type="button" variant="ghost" size="sm" className="w-full" onClick={onClear}>
            Limpiar rango
          </Button>
        </div>
        <Calendar
          mode="range"
          selected={range}
          onSelect={onSelectRange}
          defaultMonth={range?.from}
          numberOfMonths={monthsToShow}
        />
      </PopoverContent>
    </Popover>
  );
}

