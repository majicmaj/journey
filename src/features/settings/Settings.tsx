import { useSettings } from "@/hooks/useData";
import { db, type Settings as AppSettings } from "@/lib/db";
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
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogClose,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useMemo, useState } from "react";
import { CloseIcon } from "@/components/pixel/icons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";

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
      <div className="flex sm:items-center flex-col sm:flex-row gap-3">
        <label className="w-40 text-sm" htmlFor={`theme-${keyName}`}>
          {label}
        </label>
        <Dialog>
          <DialogTrigger asChild>
            <button
              id={`theme-${keyName}`}
              className="pixel-frame flex-1 bg-background p-2 text-left flex items-center gap-3"
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
          </DialogTrigger>
          <DialogContent className="w-[min(28rem,95vw)]">
            <div className="grid grid-cols-8 gap-3">
              {presetValues.slice(0, 24).map((v) => (
                <DialogClose key={v} asChild>
                  <button
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
                </DialogClose>
              ))}
            </div>
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-sm w-16">OKLCH</span>
                <span
                  className="inline-block size-6 pixel-frame"
                  style={{ background: oklchValue }}
                />
                <span className="text-xs text-muted-foreground truncate">
                  {oklchValue}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 items-center">
                <div className="flex items-center gap-3">
                  <span className="text-xs w-8">L</span>
                  <Slider
                    min={0}
                    max={1}
                    step={0.01}
                    value={[Number(l)]}
                    onValueChange={(value: number[]) => setL(value[0])}
                    className="w-full"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs w-8">C</span>
                  <Slider
                    min={0}
                    max={0.4}
                    step={0.005}
                    value={[Number(c)]}
                    onValueChange={(value: number[]) => setC(value[0])}
                    className="w-full"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs w-8">H</span>
                  <Slider
                    min={0}
                    max={360}
                    step={1}
                    value={[h]}
                    onValueChange={(value) => setH(value[0])}
                    className="w-full"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 flex-col sm:flex-row">
                <span className="text-sm w-16">Manual</span>
                <Input
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
                <Button
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
                </Button>
                <Button
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
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      <label className="flex flex-col gap-1">
        <span className="text-sm">Day start (HH:mm)</span>
        <div className="pixel-frame">
          <Input
            value={data.dayStart}
            className="bg-card"
            onChange={(e) =>
              db.settings
                .put({ ...data, dayStart: e.target.value })
                .then(() => qc.invalidateQueries({ queryKey: ["settings"] }))
            }
          />
        </div>
      </label>

      <hr className="my-4 w-full border-2" />
      <label className="flex items-center gap-3">
        <Checkbox aria-label="Show streaks" checked={true} disabled />
        <span>Show streaks (always on)</span>
      </label>

      <hr className="my-4 w-full border-2" />

      <div className="flex flex-col gap-3">
        <label className="flex items-center gap-3">
          <Checkbox
            checked={Boolean(data.themeDark)}
            onCheckedChange={async (checked: boolean) => {
              const next = {
                ...data,
                themeDark: checked,
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
              <SelectTrigger className="w-full bg-card">
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
          <summary className="cursor-pointer select-none bg-card p-2 text-sm">
            Custom colors
          </summary>
          <div className="grid grid-cols-1 px-2 py-3 gap-3">
            {THEME_KEYS.map(({ key, label }) => (
              <ColorRow key={key} keyName={key} label={label} settings={data} />
            ))}
          </div>
          <div className="flex gap-3 p-3 flex-col sm:flex-row">
            <Button
              variant="destructive"
              onClick={async () => {
                const next = { ...data, themeVars: {} } as AppSettings;
                await db.settings.put(next);
                applyTheme(next);
                qc.invalidateQueries({ queryKey: ["settings"] });
              }}
            >
              <CloseIcon className="size-8" />
              Reset custom colors
            </Button>
            <Button
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
            </Button>
          </div>
        </details>

        <div className="pixel-frame bg-card text-card-foreground p-3 flex flex-col gap-3">
          <span className="text-sm">Frame and corners</span>
          <label className="flex items-center gap-3">
            <Checkbox
              checked={data.pixelFrameEnabled !== false}
              onCheckedChange={async (checked: boolean) => {
                const next = {
                  ...data,
                  pixelFrameEnabled: checked,
                } as AppSettings;
                await db.settings.put(next);
                applyTheme(next);
                qc.invalidateQueries({ queryKey: ["settings"] });
              }}
            />
            <span className="text-sm">Enable pixel frame</span>
          </label>

          <div className="flex items-center gap-3">
            <span className="text-sm w-40">Pixel frame width</span>
            <Slider
              min={0}
              max={16}
              step={1}
              value={[Number(data.pixelFrameWidth ?? 4)]}
              onValueChange={async (value: number[]) => {
                const width = Math.max(0, Math.min(16, Number(value[0])));
                const next = { ...data, pixelFrameWidth: width } as AppSettings;
                await db.settings.put(next);
                applyTheme(next);
                qc.invalidateQueries({ queryKey: ["settings"] });
              }}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground w-10 text-right">
              {data.pixelFrameWidth ?? 4}px
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm w-40">Corner radius</span>
            <Slider
              min={0}
              max={16}
              step={1}
              value={[
                Number(
                  data.themeVars?.["radius"]
                    ? parseInt(data.themeVars["radius"], 10)
                    : typeof window !== "undefined"
                    ? parseInt(
                        getComputedStyle(document.documentElement)
                          .getPropertyValue("--radius")
                          .trim() || "0",
                        10
                      )
                    : 0
                ),
              ]}
              onValueChange={async (value: number[]) => {
                const r = `${Math.max(0, Math.min(32, Number(value[0])))}px`;
                const nextVars = { ...(data.themeVars ?? {}) };
                nextVars["radius"] = r;
                const next = { ...data, themeVars: nextVars } as AppSettings;
                await db.settings.put(next);
                applyTheme(next);
                qc.invalidateQueries({ queryKey: ["settings"] });
              }}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground w-10 text-right">
              {data.themeVars?.["radius"] ?? "0px"}
            </span>
          </div>
        </div>

        <div className="pixel-frame bg-card text-card-foreground p-3 flex flex-col gap-3">
          <span className="text-sm">Typography</span>
          <label className="flex items-center gap-3">
            <Checkbox
              checked={data.pixelFontEnabled !== false}
              onCheckedChange={async (checked: boolean) => {
                const next = {
                  ...data,
                  pixelFontEnabled: checked,
                } as AppSettings;
                await db.settings.put(next);
                applyTheme(next);
                qc.invalidateQueries({ queryKey: ["settings"] });
              }}
            />
            <span className="text-sm">Enable pixel art font</span>
          </label>
        </div>
      </div>

      <hr className="my-4 w-full border-2" />

      <Dialog>
        <DialogTrigger asChild>
          <Button variant="destructive">Reset DB</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset database?</DialogTitle>
            <DialogDescription>
              This will delete all habits and entries stored locally. This
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => db.delete().then(() => location.reload())}
            >
              Confirm Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
