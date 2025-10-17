import { PixelButton, PixelInput } from "@/components/pixel";
import { useSettings } from "@/hooks/useData";
import { db, type Settings as AppSettings } from "@/lib/db";
import { seedMockData } from "@/lib/seed";
import { useQueryClient } from "@tanstack/react-query";
import { THEME_KEYS, THEME_PRESETS } from "@/lib/utils";
import { applyTheme } from "@/lib/theme";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useMemo, useState } from "react";

export default function Settings() {
  const { data } = useSettings();
  const qc = useQueryClient();
  if (!data) return null;

  function generateOKLCHGrid(): string[] {
    const lightness = [0.95, 0.85, 0.75]; // 3 rows
    const hues = [0, 30, 60, 120, 180, 220, 260, 300]; // 8 cols
    const chroma = 0.12;
    const out: string[] = [];
    for (const l of lightness) {
      for (const h of hues) out.push(`oklch(${l} ${chroma} ${h})`);
    }
    return out;
  }

  function ColorRow({
    keyName,
    label,
    settings,
  }: {
    keyName: string;
    label: string;
    settings: AppSettings;
  }) {
    const value = settings.themeVars?.[keyName] ?? "";
    const computed =
      typeof window !== "undefined"
        ? getComputedStyle(document.documentElement)
            .getPropertyValue(`--${keyName}`)
            .trim()
        : "";

    const baseGrid = useMemo(() => generateOKLCHGrid(), []);
    const presetValues = useMemo(
      () =>
        Array.from(
          new Set([
            computed,
            ...(settings.themeDark
              ? THEME_PRESETS.map((p) => p.varsDark[keyName])
              : THEME_PRESETS.map((p) => p.varsLight[keyName])
            ).filter(Boolean),
            ...baseGrid,
          ] as string[])
        ).filter(Boolean),
      [computed, settings.themeDark, keyName, baseGrid]
    );

    const [l, setL] = useState(0.6);
    const [c, setC] = useState(0.1);
    const [h, setH] = useState(220);
    const oklchValue = `oklch(${l} ${c} ${h})`;

    return (
      <div className="flex sm:items-center flex-col sm:flex-row gap-2">
        <label className="w-40 text-sm" htmlFor={`theme-${keyName}`}>
          {label}
        </label>
        <Popover>
          <PopoverTrigger asChild>
            <button
              id={`theme-${keyName}`}
              className="pixel-frame flex-1 bg-background p-2 text-left flex items-center gap-2"
              aria-label={`Pick color for ${label}`}
            >
              <span
                className="inline-block size-4 pixel-frame"
                style={{ background: value || computed || undefined }}
              />
              <span className="truncate">
                {value || computed || "Choose color"}
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="pixel-frame w-[min(28rem,95vw)]"
          >
            <div className="grid grid-cols-8 gap-2">
              {presetValues.slice(0, 24).map((v) => (
                <button
                  key={v}
                  className="pixel-frame size-8"
                  style={{ background: v }}
                  title={v}
                  onClick={async () => {
                    const nextVars = { ...(settings.themeVars ?? {}) };
                    nextVars[keyName] = v;
                    const next: AppSettings = {
                      ...settings,
                      themeVars: nextVars,
                    };
                    await db.settings.put(next);
                    applyTheme(next);
                    qc.invalidateQueries({ queryKey: ["settings"] });
                  }}
                />
              ))}
            </div>
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm w-16">OKLCH</span>
                <span
                  className="inline-block size-6 pixel-frame"
                  style={{ background: oklchValue }}
                />
                <span className="text-xs text-muted-foreground truncate">
                  {oklchValue}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 items-center">
                <div className="flex items-center gap-2">
                  <span className="text-xs w-8">L</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={l}
                    onChange={(e) => setL(parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs w-8">C</span>
                  <input
                    type="range"
                    min={0}
                    max={0.4}
                    step={0.005}
                    value={c}
                    onChange={(e) => setC(parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs w-8">H</span>
                  <input
                    type="range"
                    min={0}
                    max={360}
                    step={1}
                    value={h}
                    onChange={(e) => setH(parseInt(e.target.value, 10))}
                    className="w-full"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm w-16">Manual</span>
                <PixelInput
                  defaultValue={value || computed}
                  placeholder={computed || `CSS color, oklch(...) or #hex`}
                  onBlur={async (e) => {
                    const nextVars = { ...(settings.themeVars ?? {}) };
                    const v = e.target.value.trim();
                    if (v) nextVars[keyName] = v;
                    else delete nextVars[keyName];
                    const next: AppSettings = {
                      ...settings,
                      themeVars: nextVars,
                    };
                    await db.settings.put(next);
                    applyTheme(next);
                    qc.invalidateQueries({ queryKey: ["settings"] });
                  }}
                />
                <PixelButton
                  onClick={async () => {
                    const nextVars = { ...(settings.themeVars ?? {}) };
                    nextVars[keyName] = oklchValue;
                    const next: AppSettings = {
                      ...settings,
                      themeVars: nextVars,
                    };
                    await db.settings.put(next);
                    applyTheme(next);
                    qc.invalidateQueries({ queryKey: ["settings"] });
                  }}
                >
                  Use color
                </PixelButton>
                <PixelButton
                  onClick={async () => {
                    const nextVars = { ...(settings.themeVars ?? {}) };
                    delete nextVars[keyName];
                    const next: AppSettings = {
                      ...settings,
                      themeVars: nextVars,
                    };
                    await db.settings.put(next);
                    applyTheme(next);
                    qc.invalidateQueries({ queryKey: ["settings"] });
                  }}
                >
                  Reset
                </PixelButton>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 max-w-sm">
      <label className="flex flex-col gap-1">
        <span className="text-sm">Day start (HH:mm)</span>
        <PixelInput
          value={data.dayStart}
          onChange={(e) =>
            db.settings
              .put({ ...data, dayStart: e.target.value })
              .then(() => qc.invalidateQueries({ queryKey: ["settings"] }))
          }
        />
      </label>

      <hr className="my-4 w-full border-2" />

      <label className="flex items-center gap-3">
        <PixelInput
          aria-label="Inline value input"
          type="checkbox"
          checked={data.inlineValueInput}
          onChange={(e) =>
            db.settings
              .put({ ...data, inlineValueInput: e.target.checked })
              .then(() => qc.invalidateQueries({ queryKey: ["settings"] }))
          }
        />
        <span>Inline value input</span>
      </label>
      <label className="flex items-center gap-3">
        <PixelInput
          aria-label="Show streaks"
          type="checkbox"
          checked={data.showStreaks}
          onChange={(e) =>
            db.settings
              .put({ ...data, showStreaks: e.target.checked })
              .then(() => qc.invalidateQueries({ queryKey: ["settings"] }))
          }
        />
        <span>Show streaks</span>
      </label>

      <hr className="my-4 w-full border-2" />

      <div className="flex flex-col gap-3">
        <label className="flex items-center gap-3">
          <PixelInput
            type="checkbox"
            checked={Boolean(data.themeDark)}
            onChange={async (e) => {
              const next = {
                ...data,
                themeDark: e.target.checked,
              } as AppSettings;
              await db.settings.put(next);
              applyTheme(next);
              qc.invalidateQueries({ queryKey: ["settings"] });
            }}
          />
          <span className="text-sm">Dark mode</span>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm">Theme preset</span>
          <div className="pixel-frame flex">
            <Select
              value={data.themePreset ?? "default"}
              onValueChange={async (value) => {
                const next = { ...data, themePreset: value } as AppSettings;
                await db.settings.put(next);
                applyTheme(next);
                qc.invalidateQueries({ queryKey: ["settings"] });
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="pixel-frame">
                {THEME_PRESETS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </label>

        <details className="flex flex-col bg-card pixel-frame">
          <summary className="cursor-pointer select-none bg-background p-2 text-sm">
            Custom colors
          </summary>
          <div className="grid grid-cols-1 px-2  pt-2 gap-3">
            {THEME_KEYS.map(({ key, label }) => (
              <ColorRow key={key} keyName={key} label={label} settings={data} />
            ))}
          </div>
          <div className="flex gap-3 flex-col sm:flex-row">
            <PixelButton
              onClick={async () => {
                const next = { ...data, themeVars: {} } as AppSettings;
                await db.settings.put(next);
                applyTheme(next);
                qc.invalidateQueries({ queryKey: ["settings"] });
              }}
            >
              Reset custom colors
            </PixelButton>
            <PixelButton
              onClick={async () => {
                const preset = THEME_PRESETS.find(
                  (p) => p.id === (data.themePreset ?? "default")
                );
                const next = {
                  ...data,
                  themeVars:
                    (data.themeDark ? preset?.varsDark : preset?.varsLight) ??
                    {},
                  themeDark: Boolean(preset?.dark ?? data.themeDark),
                } as AppSettings;
                await db.settings.put(next);
                applyTheme(next);
                qc.invalidateQueries({ queryKey: ["settings"] });
              }}
            >
              Apply preset values
            </PixelButton>
          </div>
        </details>

        <div className="pixel-frame bg-card text-card-foreground p-3 flex flex-col gap-3">
          <span className="text-sm">Saved themes</span>
          <div className="flex gap-2">
            <PixelInput
              placeholder="Theme name"
              onKeyDown={async (e) => {
                if (e.key !== "Enter") return;
                const name = (e.target as HTMLInputElement).value.trim();
                if (!name) return;
                const theme = {
                  id:
                    crypto.randomUUID?.() ??
                    Math.random().toString(36).slice(2),
                  name,
                  dark: Boolean(data.themeDark),
                  presetId: data.themePreset,
                  vars: data.themeVars ?? {},
                };
                const next: AppSettings = {
                  ...data,
                  savedThemes: [...(data.savedThemes ?? []), theme],
                };
                await db.settings.put(next);
                (e.target as HTMLInputElement).value = "";
                qc.invalidateQueries({ queryKey: ["settings"] });
              }}
            />
            <PixelButton
              onClick={async () => {
                const input =
                  (document.activeElement as HTMLInputElement) ?? undefined;
                const name = input?.value?.trim?.() ?? "";
                if (!name) return;
                const theme = {
                  id:
                    crypto.randomUUID?.() ??
                    Math.random().toString(36).slice(2),
                  name,
                  dark: Boolean(data.themeDark),
                  presetId: data.themePreset,
                  vars: data.themeVars ?? {},
                };
                const next: AppSettings = {
                  ...data,
                  savedThemes: [...(data.savedThemes ?? []), theme],
                };
                await db.settings.put(next);
                if (input) input.value = "";
                qc.invalidateQueries({ queryKey: ["settings"] });
              }}
            >
              Save theme
            </PixelButton>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {(data.savedThemes ?? []).map((t) => (
              <div key={t.id} className="flex items-center gap-2">
                <div className="flex-1">
                  <div className="text-sm">{t.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {t.dark ? "Dark" : "Light"} · {t.presetId ?? "custom"}
                  </div>
                </div>
                <PixelButton
                  onClick={async () => {
                    const next: AppSettings = {
                      ...data,
                      themeDark: t.dark,
                      themePreset: t.presetId ?? "default",
                      themeVars: t.vars,
                    };
                    await db.settings.put(next);
                    applyTheme(next);
                    qc.invalidateQueries({ queryKey: ["settings"] });
                  }}
                >
                  Apply
                </PixelButton>
                <PixelButton
                  onClick={async () => {
                    const next: AppSettings = {
                      ...data,
                      savedThemes: (data.savedThemes ?? []).filter(
                        (x) => x.id !== t.id
                      ),
                    };
                    await db.settings.put(next);
                    qc.invalidateQueries({ queryKey: ["settings"] });
                  }}
                >
                  Delete
                </PixelButton>
              </div>
            ))}
          </div>
        </div>
      </div>

      <hr className="my-4 w-full border-2" />

      <PixelButton onClick={() => db.delete().then(() => location.reload())}>
        Reset DB
      </PixelButton>
      <PixelButton
        onClick={async () => {
          await seedMockData({ days: 120, dayStart: data.dayStart });
          qc.invalidateQueries({ queryKey: ["habits"] });
          qc.invalidateQueries({ queryKey: ["entries"] });
        }}
      >
        Seed Mock Data
      </PixelButton>
    </div>
  );
}
