"use client";

import { cn } from "@/lib/utils";

interface DaySelectorProps {
  selectedDays: number[];
  onChange: (days: number[]) => void;
  className?: string;
}

const DAYS = [
  { value: 1, label: "Mon", fullLabel: "Monday" },
  { value: 2, label: "Tue", fullLabel: "Tuesday" },
  { value: 3, label: "Wed", fullLabel: "Wednesday" },
  { value: 4, label: "Thu", fullLabel: "Thursday" },
  { value: 5, label: "Fri", fullLabel: "Friday" },
  { value: 6, label: "Sat", fullLabel: "Saturday" },
  { value: 7, label: "Sun", fullLabel: "Sunday" },
];

export function DaySelector({ selectedDays, onChange, className }: DaySelectorProps) {
  const toggleDay = (dayValue: number) => {
    if (selectedDays.includes(dayValue)) {
      onChange(selectedDays.filter((d) => d !== dayValue));
    } else {
      onChange([...selectedDays, dayValue].sort());
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <label className="text-sm font-medium text-foreground">Days of Week</label>
      <div className="flex flex-wrap gap-2">
        {DAYS.map((day) => {
          const isSelected = selectedDays.includes(day.value);
          return (
            <button
              key={day.value}
              type="button"
              onClick={() => toggleDay(day.value)}
              className={cn(
                "flex h-10 w-14 items-center justify-center rounded-lg border-2 text-sm font-medium transition-all",
                isSelected
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:bg-muted"
              )}
              title={day.fullLabel}
            >
              {day.label}
            </button>
          );
        })}
      </div>
      {selectedDays.length === 0 && (
        <p className="text-xs text-muted-foreground">Select at least one day</p>
      )}
    </div>
  );
}
