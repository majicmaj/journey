import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// List of app CSS custom properties that represent theme colors.
// Keys are without leading `--`, values are human labels.
export const THEME_KEYS: Array<{
  key: string;
  label: string;
  type?: "color" | "other";
}> = [
  { key: "background", label: "Background", type: "color" },
  { key: "foreground", label: "Foreground", type: "color" },
  { key: "card", label: "Card", type: "color" },
  { key: "card-foreground", label: "Card Foreground", type: "color" },
  { key: "primary", label: "Primary", type: "color" },
  { key: "primary-foreground", label: "Primary Foreground", type: "color" },
  { key: "secondary", label: "Secondary", type: "color" },
  { key: "secondary-foreground", label: "Secondary Foreground", type: "color" },
  { key: "accent", label: "Accent", type: "color" },
  { key: "accent-foreground", label: "Accent Foreground", type: "color" },
  { key: "muted", label: "Muted", type: "color" },
  { key: "muted-foreground", label: "Muted Foreground", type: "color" },
  { key: "destructive", label: "Destructive", type: "color" },
  { key: "border", label: "Border", type: "color" },
  { key: "input", label: "Input", type: "color" },
  { key: "ring", label: "Ring", type: "color" },
  { key: "chart-1", label: "Chart 1", type: "color" },
  { key: "chart-2", label: "Chart 2", type: "color" },
  { key: "chart-3", label: "Chart 3", type: "color" },
  { key: "chart-4", label: "Chart 4", type: "color" },
  { key: "chart-5", label: "Chart 5", type: "color" },
];

export type ThemeVars = Record<string, string>;

export type ThemePreset = {
  id: string;
  name: string;
  dark?: boolean;
  vars: ThemeVars;
};

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "default",
    name: "Default",
    dark: false,
    vars: {},
  },
  {
    id: "midnight",
    name: "Midnight",
    dark: true,
    vars: {
      background: "oklch(0.2 0.03 265)",
      foreground: "oklch(0.98 0 0)",
      primary: "oklch(0.6 0.1 280)",
      "primary-foreground": "oklch(0.98 0 0)",
      accent: "oklch(0.35 0.08 260)",
      border: "oklch(0.6 0.08 260)",
    },
  },
  {
    id: "ocean",
    name: "Ocean",
    dark: false,
    vars: {
      background: "oklch(0.95 0.03 210)",
      foreground: "oklch(0.2 0.02 220)",
      primary: "oklch(0.6 0.12 210)",
      "primary-foreground": "oklch(0.98 0.02 210)",
      secondary: "oklch(0.7 0.08 220)",
      accent: "oklch(0.92 0.03 210)",
      border: "oklch(0.5 0.06 210)",
    },
  },
  {
    id: "sunset",
    name: "Sunset",
    dark: false,
    vars: {
      background: "oklch(0.97 0.05 60)",
      foreground: "oklch(0.2 0.02 40)",
      primary: "oklch(0.65 0.2 30)",
      "primary-foreground": "oklch(0.98 0.03 60)",
      secondary: "oklch(0.7 0.18 50)",
      accent: "oklch(0.98 0.04 50)",
      border: "oklch(0.4 0.07 50)",
    },
  },
];
