import { PixelButton, PixelInput } from "@/components/pixel";
import { useSettings } from "@/hooks/useData";
import { db } from "@/lib/db";
import { seedMockData } from "@/lib/seed";
import { useQueryClient } from "@tanstack/react-query";
import { THEME_KEYS, THEME_PRESETS } from "@/lib/utils";
import { applyTheme } from "@/lib/theme";

export default function Settings() {
  const { data } = useSettings();
  const qc = useQueryClient();
  if (!data) return null;
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
      <label className="flex items-center gap-3">
        <input
          aria-label="Inline value input"
          type="checkbox"
          checked={data.inlineValueInput}
          className="pixel-frame"
          onChange={(e) =>
            db.settings
              .put({ ...data, inlineValueInput: e.target.checked })
              .then(() => qc.invalidateQueries({ queryKey: ["settings"] }))
          }
        />
        <span>Inline value input</span>
      </label>
      <label className="flex items-center gap-3">
        <input
          aria-label="Show streaks"
          type="checkbox"
          checked={data.showStreaks}
          className="pixel-frame"
          onChange={(e) =>
            db.settings
              .put({ ...data, showStreaks: e.target.checked })
              .then(() => qc.invalidateQueries({ queryKey: ["settings"] }))
          }
        />
        <span>Show streaks</span>
      </label>

      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            className="pixel-frame"
            checked={Boolean(data.themeDark)}
            onChange={async (e) => {
              const next = { ...data, themeDark: e.target.checked };
              await db.settings.put(next);
              applyTheme(next);
              qc.invalidateQueries({ queryKey: ["settings"] });
            }}
          />
          <span className="text-sm">Dark mode</span>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm">Theme preset</span>
          <select
            className="pixel-frame bg-background p-2"
            value={data.themePreset ?? "default"}
            onChange={async (e) => {
              const next = { ...data, themePreset: e.target.value };
              await db.settings.put(next);
              applyTheme(next);
              qc.invalidateQueries({ queryKey: ["settings"] });
            }}
          >
            {THEME_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-3">
          <span className="text-sm">Custom colors</span>
          <div className="grid grid-cols-1 gap-3">
            {THEME_KEYS.map(({ key, label }) => {
              const value = data.themeVars?.[key] ?? "";
              return (
                <div key={key} className="flex items-center gap-2">
                  <label className="w-40 text-sm" htmlFor={`theme-${key}`}>
                    {label}
                  </label>
                  <input
                    id={`theme-${key}`}
                    className="pixel-frame flex-1 bg-background p-2"
                    placeholder={`CSS color, e.g. oklch(...) or #hex`}
                    value={value}
                    onChange={async (e) => {
                      const nextVars = { ...(data.themeVars ?? {}) };
                      nextVars[key] = e.target.value;
                      if (!e.target.value) delete nextVars[key];
                      const next = { ...data, themeVars: nextVars };
                      await db.settings.put(next);
                      applyTheme(next);
                      qc.invalidateQueries({ queryKey: ["settings"] });
                    }}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex gap-3 flex-col sm:flex-row">
            <PixelButton
              onClick={async () => {
                const next = { ...data, themeVars: {} };
                await db.settings.put(next);
                applyTheme(next);
                qc.invalidateQueries({ queryKey: ["settings"] });
              }}
            >
              Reset custom colors
            </PixelButton>
            <PixelButton
              onClick={async () => {
                // If preset implies dark, adjust toggle to preset's dark default
                const preset = THEME_PRESETS.find(
                  (p) => p.id === (data.themePreset ?? "default")
                );
                const next = {
                  ...data,
                  themeVars: preset?.vars ?? {},
                  themeDark: Boolean(preset?.dark ?? data.themeDark),
                };
                await db.settings.put(next);
                applyTheme(next);
                qc.invalidateQueries({ queryKey: ["settings"] });
              }}
            >
              Apply preset values
            </PixelButton>
          </div>
        </div>
      </div>
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
