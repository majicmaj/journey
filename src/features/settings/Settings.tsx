import { PixelButton, PixelInput } from "@/components/pixel";
import { useSettings } from "@/hooks/useData";
import { db } from "@/lib/db";
import { seedMockData } from "@/lib/seed";
import { useQueryClient } from "@tanstack/react-query";

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
