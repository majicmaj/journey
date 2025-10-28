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
  root.classList.add("font-display");
  // Dark mode class
  if (settings.themeDark) root.classList.add("dark");
  else root.classList.remove("dark");

  // Pixel frame toggle class
  if (settings.pixelFrameEnabled === false)
    root.classList.add("no-pixel-frame");
  else root.classList.remove("no-pixel-frame");

  // Pixel font toggle class
  if (settings.pixelFontEnabled === false) root.classList.add("no-pixel-font");
  else {
    root.classList.remove("no-pixel-font");
    root.classList.add("font-display");
  }

  // Pixel frame width variable
  const pixelSize =
    typeof settings.pixelFrameWidth === "number"
      ? `${Math.max(0, Math.min(16, settings.pixelFrameWidth))}px`
      : undefined;
  if (pixelSize) root.style.setProperty("--pixel-frame-size", pixelSize);
  else root.style.removeProperty("--pixel-frame-size");

  const preset = getPresetById(settings.themePreset);
  // First clear previously applied override keys to avoid accumulation
  const keysToClear = new Set<string>();
  for (const p of THEME_PRESETS) {
    for (const k of Object.keys(p.varsLight)) keysToClear.add(k);
    for (const k of Object.keys(p.varsDark)) keysToClear.add(k);
  }
  if (settings.themeVars)
    for (const k of Object.keys(settings.themeVars)) keysToClear.add(k);
  clearCssVars([...keysToClear]);

  // Apply preset variant then user overrides
  const variantVars = settings.themeDark ? preset?.varsDark : preset?.varsLight;
  if (variantVars) applyCssVars(variantVars);
  if (settings.themeVars) applyCssVars(settings.themeVars);
}
