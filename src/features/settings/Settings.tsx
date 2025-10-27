import { useSettings } from "@/hooks/useData";
import { db, type Settings as AppSettings } from "@/lib/db";
import { useQueryClient } from "@tanstack/react-query";
import { THEME_KEYS, THEME_PRESETS } from "@/lib/utils";
import { applyTheme } from "@/lib/theme";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
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
import React, { useMemo, useState } from "react";
import { CloseIcon, TrashIcon } from "@/components/pixel/icons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";

export default function Settings() {
  const { data } = useSettings();
  const qc = useQueryClient();
  if (!data) return null;

  function parseOklch(
    input: string
  ): { l: number; c: number; h: number } | null {
    const s = (input || "").trim();
    if (!s.toLowerCase().startsWith("oklch(")) return null;
    const inner = s.slice(s.indexOf("(") + 1, s.lastIndexOf(")"));
    const parts = inner
      .split(/[\s,]+/)
      .map((x) => x.trim())
      .filter(Boolean);
    if (parts.length < 3) return null;
    const l = Number(parts[0]);
    const c = Number(parts[1]);
    // hue may include deg, turn, rad; we only expect numbers here
    const hRaw = parts[2].replace(/deg|grad|rad|turn/i, "");
    const h = Number(hRaw);
    if ([l, c, h].some((n) => Number.isNaN(n))) return null;
    return {
      l: Math.max(0, Math.min(1, l)),
      c: Math.max(0, Math.min(1, c)),
      h: ((h % 360) + 360) % 360,
    };
  }

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

  function ThemeColorRow({
    keyName,
    label,
    dark,
    presetId,
    value,
    onChange,
  }: {
    keyName: string;
    label: string;
    dark: boolean;
    presetId?: string;
    value: string | undefined;
    onChange: (next: string | undefined) => void;
  }) {
    const computed =
      typeof window !== "undefined"
        ? getComputedStyle(document.documentElement)
            .getPropertyValue(`--${keyName}`)
            .trim()
        : "";

    const baseGrid = useMemo(() => generateOKLCHGrid(), []);
    const preset = THEME_PRESETS.find((p) => p.id === (presetId ?? "default"));
    const baseline = dark
      ? preset?.varsDark[keyName]
      : preset?.varsLight[keyName];
    const presetValues = useMemo(
      () =>
        Array.from(
          new Set([
            computed,
            ...(dark
              ? THEME_PRESETS.map((p) => p.varsDark[keyName])
              : THEME_PRESETS.map((p) => p.varsLight[keyName])
            ).filter(Boolean),
            dark ? preset?.varsDark[keyName] : preset?.varsLight[keyName],
            ...baseGrid,
          ] as string[])
        ).filter(Boolean),
      [computed, dark, keyName, baseGrid, preset]
    );

    const [l, setL] = useState(0.6);
    const [c, setC] = useState(0.1);
    const [h, setH] = useState(220);
    const oklchValue = `oklch(${l} ${c} ${h})`;

    const [open, setOpen] = useState(false);
    return (
      <div className="flex sm:items-center flex-col sm:flex-row gap-3">
        <label className="w-40 text-sm" htmlFor={`theme-edit-${keyName}`}>
          {label}
        </label>
        <Dialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (o) {
              const src = (value || computed || "").toString();
              const parsed = parseOklch(src);
              if (parsed) {
                setL(parsed.l);
                setC(parsed.c);
                setH(parsed.h);
              }
            }
          }}
        >
          <DialogTrigger asChild>
            <button
              id={`theme-edit-${keyName}`}
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
                    onClick={() =>
                      onChange(baseline && v === baseline ? undefined : v)
                    }
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
                    onValueChange={(v: number[]) => setL(v[0])}
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
                    onValueChange={(v: number[]) => setC(v[0])}
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
                    onValueChange={(v) => setH(v[0])}
                    className="w-full"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 flex-col sm:flex-row">
                <span className="text-sm w-16">Manual</span>
                <Input
                  defaultValue={value || computed}
                  placeholder={computed || `CSS color, oklch(...) or #hex`}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    const next = v || undefined;
                    if (next && baseline && next === baseline)
                      onChange(undefined);
                    else onChange(next);
                  }}
                />
                <Button
                  onClick={() =>
                    onChange(
                      baseline && oklchValue === baseline
                        ? undefined
                        : oklchValue
                    )
                  }
                >
                  Use color
                </Button>
                <Button onClick={() => onChange(undefined)}>Reset</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  function SavedThemesEditor({ settings }: { settings: AppSettings }) {
    const [selectedId, setSelectedId] = useState<string | null>(
      settings.savedThemes?.[0]?.id ?? null
    );
    const selected =
      (settings.savedThemes ?? []).find((t) => t.id === selectedId) ?? null;
    const [draftVars, setDraftVars] = useState<Record<string, string>>({
      ...(selected?.vars ?? {}),
    });

    // keep in sync if selection changes
    React.useEffect(() => {
      setDraftVars({ ...(selected?.vars ?? {}) });
    }, [selectedId, selected?.vars]);

    if ((settings.savedThemes ?? []).length === 0) {
      return (
        <div className="text-sm text-muted-foreground">
          No custom themes saved yet.
        </div>
      );
    }
    return (
      <div className="grid gap-3">
        <div className="pixel-frame">
          <Select
            {...(selectedId ? { value: selectedId } : {})}
            onValueChange={(v: string) => setSelectedId(v)}
          >
            <SelectTrigger className="w-full bg-card">
              <SelectValue placeholder="Select a theme" />
            </SelectTrigger>
            <SelectContent className="pixel-frame">
              {(settings.savedThemes ?? []).map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {selected ? (
          <>
            <div className="text-sm">
              Base:{" "}
              {THEME_PRESETS.find(
                (p) => p.id === (selected.presetId ?? "default")
              )?.name ?? "Default"}{" "}
              · {selected.dark ? "Dark" : "Light"}
            </div>
            <div className="grid grid-cols-1 gap-3">
              {THEME_KEYS.map(({ key, label }) => (
                <ThemeColorRow
                  key={key}
                  keyName={key}
                  label={label}
                  dark={selected.dark}
                  {...(selected.presetId !== undefined
                    ? { presetId: selected.presetId }
                    : {})}
                  value={draftVars[key]}
                  onChange={(next) => {
                    setDraftVars((prev) => {
                      const copy = { ...prev } as Record<string, string>;
                      if (!next) delete copy[key];
                      else copy[key] = next;
                      return copy;
                    });
                  }}
                />
              ))}
            </div>
            <div className="flex items-center justify-between gap-3">
              <Button
                variant="destructive"
                onClick={async () => {
                  if (!selected) return;
                  if (!confirm(`Delete theme "${selected.name}"?`)) return;
                  const next: AppSettings = {
                    ...settings,
                    savedThemes: (settings.savedThemes ?? []).filter(
                      (x) => x.id !== selected.id
                    ),
                  };
                  await db.settings.put(next);
                  qc.invalidateQueries({ queryKey: ["settings"] });
                  setSelectedId(next.savedThemes?.[0]?.id ?? null);
                }}
              >
                Delete theme
              </Button>
              <Button
                onClick={async () => {
                  if (!selected) return;
                  const next: AppSettings = {
                    ...settings,
                    savedThemes: (settings.savedThemes ?? []).map((t) =>
                      t.id === selected.id ? { ...t, vars: draftVars } : t
                    ),
                  };
                  await db.settings.put(next);
                  qc.invalidateQueries({ queryKey: ["settings"] });
                }}
              >
                Save changes
              </Button>
            </div>
          </>
        ) : null}
      </div>
    );
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

    const [open, setOpen] = useState(false);
    return (
      <div className="flex sm:items-center flex-col sm:flex-row gap-3">
        <label className="w-40 text-sm" htmlFor={`theme-${keyName}`}>
          {label}
        </label>
        <Dialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (o) {
              const src = (value || computed || "").toString();
              const parsed = parseOklch(src);
              if (parsed) {
                setL(parsed.l);
                setC(parsed.c);
                setH(parsed.h);
              }
            }
          }}
        >
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
                      const preset = THEME_PRESETS.find(
                        (p) => p.id === (settings.themePreset ?? "default")
                      );
                      const baseline = (
                        settings.themeDark
                          ? preset?.varsDark[keyName]
                          : preset?.varsLight[keyName]
                      ) as string | undefined;
                      if (baseline && v === baseline) delete nextVars[keyName];
                      else nextVars[keyName] = v;
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
                    if (v) {
                      const preset = THEME_PRESETS.find(
                        (p) => p.id === (settings.themePreset ?? "default")
                      );
                      const baseline = (
                        settings.themeDark
                          ? preset?.varsDark[keyName]
                          : preset?.varsLight[keyName]
                      ) as string | undefined;
                      if (baseline && v === baseline) delete nextVars[keyName];
                      else nextVars[keyName] = v;
                    } else delete nextVars[keyName];
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
                    const preset = THEME_PRESETS.find(
                      (p) => p.id === (settings.themePreset ?? "default")
                    );
                    const baseline = (
                      settings.themeDark
                        ? preset?.varsDark[keyName]
                        : preset?.varsLight[keyName]
                    ) as string | undefined;
                    if (baseline && oklchValue === baseline)
                      delete nextVars[keyName];
                    else nextVars[keyName] = oklchValue;
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
          <span className="text-sm">Theme</span>
          <div className="pixel-frame flex">
            <Select
              value={
                Object.keys(data.themeVars ?? {}).length > 0
                  ? "custom"
                  : data.themePreset ?? "default"
              }
              onValueChange={async (value) => {
                if (value === "custom") return; // reflect unsaved custom, no-op
                if (value.startsWith("custom:")) {
                  const id = value.slice("custom:".length);
                  const t = (data.savedThemes ?? []).find((x) => x.id === id);
                  if (!t) return;
                  const next = {
                    ...data,
                    themeDark: t.dark,
                    themePreset: t.presetId ?? "default",
                    themeVars: t.vars ?? {},
                  } as AppSettings;
                  await db.settings.put(next);
                  applyTheme(next);
                  qc.invalidateQueries({ queryKey: ["settings"] });
                } else {
                  // Selecting a preset. If returning to the currently-selected preset while
                  // there are overrides, clear overrides to load original values
                  const isReturningToSamePreset =
                    value === (data.themePreset ?? "default");
                  const hasOverrides =
                    Object.keys(data.themeVars ?? {}).length > 0;
                  const next: AppSettings = {
                    ...data,
                    themePreset: value,
                    ...(isReturningToSamePreset && hasOverrides
                      ? { themeVars: {} }
                      : {}),
                  } as AppSettings;
                  await db.settings.put(next);
                  applyTheme(next);
                  qc.invalidateQueries({ queryKey: ["settings"] });
                }
              }}
            >
              <SelectTrigger className="w-full bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="pixel-frame">
                {Object.keys(data.themeVars ?? {}).length > 0 && (
                  <>
                    <SelectGroup>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectGroup>
                    <SelectSeparator />
                  </>
                )}
                <SelectGroup>
                  <SelectLabel>Presets</SelectLabel>
                  {THEME_PRESETS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
                {(data.savedThemes ?? []).length > 0 && (
                  <>
                    <SelectSeparator />
                    <SelectGroup>
                      <SelectLabel>Custom</SelectLabel>
                      {(data.savedThemes ?? []).map((t) => (
                        <SelectItem key={t.id} value={`custom:${t.id}`}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </>
                )}
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

        {/* Save Theme */}
        <div className="pixel-frame bg-card text-card-foreground p-3 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm">Custom theme actions</span>
            <div className="flex gap-3">
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    disabled={
                      Object.keys(data.themeVars ?? {}).length === 0 &&
                      Number(data.pixelFrameWidth ?? 4) === 4
                    }
                    title={
                      Object.keys(data.themeVars ?? {}).length === 0 &&
                      Number(data.pixelFrameWidth ?? 4) === 4
                        ? "Customize theme or change pixel frame width to enable"
                        : undefined
                    }
                  >
                    Save Theme
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[min(30rem,95vw)]">
                  <DialogHeader>
                    <DialogTitle>Save custom theme</DialogTitle>
                    <DialogDescription>
                      This will save your current theme selection and custom
                      colors.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-3">
                    <div className="text-sm">
                      Base theme:{" "}
                      {THEME_PRESETS.find(
                        (p) => p.id === (data.themePreset ?? "default")
                      )?.name ?? "Default"}
                    </div>
                    <div className="text-sm">Customized variables:</div>
                    <div className="grid grid-cols-1 gap-4 py-2 max-h-60 overflow-auto pr-1">
                      {Number(data.pixelFrameWidth ?? 4) !== 4 && (
                        <div className="flex items-center gap-3">
                          <span className="w-40 text-xs">
                            pixel-frame-width
                          </span>
                          <span className="text-xs truncate">
                            {Number(data.pixelFrameWidth ?? 4)}px
                          </span>
                        </div>
                      )}
                      {Object.entries(data.themeVars ?? {}).map(([k, v]) => (
                        <div key={k} className="flex items-center gap-3">
                          <span className="w-40 text-xs">{k}</span>
                          <span
                            className="inline-block size-4 pixel-frame"
                            style={{ background: v }}
                          />
                          <span className="text-xs truncate">{v}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm w-24">Name</span>
                      <div className="pixel-frame flex-1">
                        <Input
                          id="save-theme-name"
                          className="bg-card w-full"
                          placeholder="My theme"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <DialogClose asChild>
                        <Button
                          onClick={async () => {
                            const input = document.getElementById(
                              "save-theme-name"
                            ) as HTMLInputElement | null;
                            const name = input?.value?.trim() ?? "";
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
                            applyTheme(next);
                            if (input) input.value = "";
                            qc.invalidateQueries({ queryKey: ["settings"] });
                            toast.success("Theme saved");
                          }}
                        >
                          Save
                        </Button>
                      </DialogClose>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Configure custom themes */}
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline">Configure custom themes</Button>
                </DialogTrigger>
                <DialogContent className="w-[min(42rem,95vw)] max-h-[85vh] overflow-auto">
                  <DialogHeader>
                    <DialogTitle>Configure custom themes</DialogTitle>
                  </DialogHeader>
                  <SavedThemesEditor settings={data} />
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        <div className="pixel-frame bg-card text-card-foreground p-3 flex flex-col gap-3">
          <span className="text-sm">Danger zone</span>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="destructive">Reset Theme</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Reset theme to defaults?</DialogTitle>
                <DialogDescription>
                  This will revert the theme preset, colors, pixel frame and
                  font settings to their defaults.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button
                    variant="destructive"
                    onClick={async () => {
                      const next: AppSettings = {
                        ...data,
                        themePreset: "default",
                        themeDark: false,
                        themeVars: {},
                        pixelFrameEnabled: true,
                        pixelFrameWidth: 4,
                        pixelFontEnabled: true,
                      };
                      await db.settings.put(next);
                      applyTheme(next);
                      qc.invalidateQueries({ queryKey: ["settings"] });
                    }}
                  >
                    Confirm Reset
                  </Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <hr className="my-4 w-full border-2" />

      <Dialog>
        <DialogTrigger asChild>
          <Button variant="destructive">
            <TrashIcon className="size-8" />
            Delete All Data
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete all data?</DialogTitle>
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
