import type { Settings } from "@/lib/db";
import { THEME_PRESETS, type ThemeVars } from "@/lib/utils";

export function getPresetById(id?: string) {
  return THEME_PRESETS.find((p) => p.id === id) ?? THEME_PRESETS[0];
}

function applyCssVars(vars: ThemeVars) {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(`--${key}`, value);
  }
}

function clearCssVars(keys: string[]) {
  const root = document.documentElement;
  for (const key of keys) {
    root.style.removeProperty(`--${key}`);
  }
}

export function applyTheme(settings: Settings) {
  const root = document.documentElement;
  // Dark mode class
  if (settings.themeDark) root.classList.add("dark");
  else root.classList.remove("dark");

  const preset = getPresetById(settings.themePreset);
  // First clear previously applied override keys to avoid accumulation
  const keysToClear = new Set<string>();
  for (const p of THEME_PRESETS)
    for (const k of Object.keys(p.vars)) keysToClear.add(k);
  if (settings.themeVars)
    for (const k of Object.keys(settings.themeVars)) keysToClear.add(k);
  clearCssVars([...keysToClear]);

  // Apply preset then user overrides
  if (preset?.vars) applyCssVars(preset.vars);
  if (settings.themeVars) applyCssVars(settings.themeVars);
}
