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
  dark?: boolean; // recommended default mode for this preset
  varsLight: ThemeVars;
  varsDark: ThemeVars;
};

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "default",
    name: "Default",
    dark: false,
    varsLight: {},
    varsDark: {},
  },
  {
    id: "midnight",
    name: "Midnight",
    dark: true,
    varsLight: {
      background: "oklch(0.95 0.03 265)",
      foreground: "oklch(0.2 0.02 265)",
      primary: "oklch(0.6 0.1 280)",
      "primary-foreground": "oklch(0.98 0 0)",
      accent: "oklch(0.9 0.04 260)",
      border: "oklch(0.5 0.06 260)",
    },
    varsDark: {
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
    varsLight: {
      background: "oklch(0.95 0.03 210)",
      foreground: "oklch(0.2 0.02 220)",
      primary: "oklch(0.6 0.12 210)",
      "primary-foreground": "oklch(0.98 0.02 210)",
      secondary: "oklch(0.7 0.08 220)",
      accent: "oklch(0.92 0.03 210)",
      border: "oklch(0.5 0.06 210)",
    },
    varsDark: {
      background: "oklch(0.22 0.04 210)",
      foreground: "oklch(0.98 0 0)",
      primary: "oklch(0.65 0.12 210)",
      "primary-foreground": "oklch(0.98 0.02 210)",
      secondary: "oklch(0.35 0.06 220)",
      accent: "oklch(0.3 0.05 210)",
      border: "oklch(0.6 0.08 210)",
    },
  },
  {
    id: "sunset",
    name: "Sunset",
    dark: false,
    varsLight: {
      background: "oklch(0.97 0.1 20)",
      card: "oklch(0.98 0.02 20)",
      foreground: "oklch(0.2 0.02 40)",
      primary: "oklch(0.65 0.2 30)",
      "primary-foreground": "oklch(0.98 0.03 60)",
      secondary: "oklch(0.8 0.28 100)",
      accent: "oklch(0.98 0.04 50)",
      border: "oklch(0.4 0.07 50)",
    },
    varsDark: {
      background: "oklch(0.25 0.05 30)",
      card: "oklch(0.3 0.02 40)",
      foreground: "oklch(0.98 0 0)",
      primary: "oklch(0.62 0.2 30)",
      "primary-foreground": "oklch(0.98 0.04 60)",
      secondary: "oklch(0.8 0.28 100)",
      accent: "oklch(0.3 0.04 50)",
      border: "oklch(0.6 0.07 50)",
    },
  },
  {
    id: "minecraft",
    name: "Minecraft",
    dark: false,
    varsLight: {
      background: "oklch(0.6076 0.0881 58.5)",
      card: "oklch(0.4114 0.0607 51.77)",
      "card-foreground": "oklch(0.96 0.01 140)",
      foreground: "oklch(0.96 0.01 140)",
      primary: "oklch(0.5514 0.1032 134.15)",
      "primary-foreground": "oklch(0.98 0 0)",
      secondary: "oklch(0.3325 0.1391 265.62)",
      "secondary-foreground": "oklch(0.98 0.01 90)",
      accent: "oklch(0.5142 0.0064 274.88)",
      border: "oklch(0.5142 0.0064 274.88)",
    },
    varsDark: {
      background: "oklch(0.4114 0.0607 51.77)",
      foreground: "oklch(0.96 0.01 140)",
      card: "oklch(0.6076 0.0881 58.5)",
      primary: "oklch(0.5514 0.1032 134.15)",
      "primary-foreground": "oklch(0.98 0 0)",
      secondary: "oklch(0.4539 0.1475 263.19)",
      "secondary-foreground": "oklch(0.98 0.01 90)",
      accent: "oklch(0.5142 0.0064 274.88)",
      border: "oklch(0.5142 0.0064 274.88)",
    },
  },
  {
    id: "hextech",
    name: "Hextech",
    dark: true,
    varsLight: {
      background: "oklch(0.9 0.1 260)",
      card: "oklch(0.95 0.01 85)", // gold
      foreground: "oklch(0.25 0.03 250)",
      primary: "oklch(0.7 0.18 190)", // teal
      "primary-foreground": "oklch(0.98 0 0)",
      secondary: "oklch(0.75 0.12 85)", // gold
      "secondary-foreground": "oklch(0.25 0.03 250)",
      accent: "oklch(0.8 0.06 260)", // steel blue
      border: "oklch(0.75 0.12 85)",
    },
    varsDark: {
      background: "oklch(0.22 0.04 260)",
      card: "oklch(0.3 0.04 260)",
      foreground: "oklch(0.9 0.04 95)",
      primary: "oklch(0.85 0.12 85)",
      "primary-foreground": "oklch(0.1 0.02 260)",
      secondary: "oklch(0.7 0.18 190)",
      "secondary-foreground": "oklch(0.1 0.02 260)",
      accent: "oklch(0.38 0.06 260)",
      border: "oklch(0.65 0.12 85)",
    },
  },
  {
    id: "space",
    name: "Space",
    dark: true,
    varsLight: {
      background: "oklch(1 0 0)",
      card: "oklch(0.92 0 0)",
      foreground: "oklch(0.25 0.03 250)",
      primary: "oklch(0.7 0.18 190)",
    },
    varsDark: {
      background: "oklch(0.17 0.03 260)",
      card: "oklch(0.2 0.04 260)",
      foreground: "oklch(0.9 0.04 95)",
      primary: "oklch(0.7 0.18 190)",
      "primary-foreground": "oklch(0.1 0.02 260)",
    },
  },
];
