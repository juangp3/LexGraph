"use client";

import type { LucideIcon } from "lucide-react";
import { LaptopMinimal, MoonStar, SunMedium } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type ThemeMode, useTheme } from "./ThemeProvider";

const OPTIONS: Array<{
  mode: ThemeMode;
  label: string;
  icon: LucideIcon;
}> = [
  { mode: "light", label: "Light", icon: SunMedium },
  { mode: "dark", label: "Dark", icon: MoonStar },
  { mode: "system", label: "System", icon: LaptopMinimal },
];

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();

  return (
    <div
      className="inline-flex items-center rounded-[var(--radius-xl)] border border-border/70 bg-background/80 p-1 shadow-[var(--shadow-flat)] backdrop-blur"
      role="group"
      aria-label="Theme switcher"
    >
      {OPTIONS.map((option) => {
        const Icon = option.icon;
        const isActive = theme === option.mode;
        const stateLabel = option.mode === "system" ? `System (${resolvedTheme})` : option.label;

        return (
          <Button
            key={option.mode}
            type="button"
            size="icon-sm"
            variant={isActive ? "secondary" : "ghost"}
            aria-pressed={isActive}
            aria-label={stateLabel}
            title={stateLabel}
            onClick={() => setTheme(option.mode)}
            className={cn("rounded-[calc(var(--radius-xl)-0.35rem)]", isActive && "shadow-[var(--shadow-flat)]")}
          >
            <Icon className="h-4 w-4" />
          </Button>
        );
      })}
    </div>
  );
}