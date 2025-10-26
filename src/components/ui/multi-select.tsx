import { useMemo } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export type MultiSelectOption<Value extends string | number> = {
  value: Value;
  label: string;
  disabled?: boolean;
};

type MultiSelectProps<Value extends string | number> = {
  options: Array<MultiSelectOption<Value>>;
  value: Value[];
  onChange: (next: Value[]) => void;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  placeholder?: string;
  showSelectAllNone?: boolean;
  renderTriggerLabel?: (selectedCount: number, totalCount: number) => string;
  modal?: boolean;
};

export function MultiSelect<Value extends string | number>({
  options,
  value,
  onChange,
  className,
  triggerClassName,
  contentClassName,
  placeholder = "Select",
  showSelectAllNone = true,
  modal = false,
  renderTriggerLabel,
}: MultiSelectProps<Value>) {
  const enabledOptions = useMemo(
    () => options.filter((o) => !o.disabled),
    [options]
  );

  const selectedCount = value.length;
  const totalCount = enabledOptions.length;
  const allSelected = selectedCount === totalCount && totalCount > 0;
  const noneSelected = selectedCount === 0;

  function toggleOne(v: Value, checked: boolean) {
    onChange(checked ? [...value, v] : value.filter((x) => x !== v));
  }

  function setAll() {
    onChange(enabledOptions.map((o) => o.value));
  }

  function setNone() {
    onChange([]);
  }

  const label = renderTriggerLabel
    ? renderTriggerLabel(selectedCount, totalCount)
    : noneSelected
    ? placeholder
    : `${selectedCount} selected`;

  return (
    <Popover modal={modal}>
      <PopoverTrigger asChild>
        <div
          className={cn(
            "pixel-frame px-3 py-1.5 cursor-pointer bg-card",
            triggerClassName
          )}
        >
          {label}
        </div>
      </PopoverTrigger>
      <PopoverContent
        className={cn("pixel-frame w-64 bg-card", contentClassName)}
      >
        <div
          className={cn(
            "flex flex-col gap-1 max-h-64 overflow-auto p-2",
            className
          )}
        >
          {showSelectAllNone && (
            <>
              <label className="flex items-center gap-2 py-1">
                <Checkbox
                  checked={noneSelected}
                  onCheckedChange={(val) => {
                    if (val) setNone();
                    else setAll();
                  }}
                />
                <span className="text-sm">Select None</span>
              </label>
              <label className="flex items-center gap-2 py-1">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(val) => {
                    if (val) setAll();
                    else setNone();
                  }}
                />
                <span className="text-sm">Select All</span>
              </label>
              <hr className="my-2 border-2" />
            </>
          )}

          {options.map((o) => {
            const checked = value.includes(o.value);
            return (
              <label
                key={String(o.value)}
                className={cn(
                  "flex items-center gap-2 py-1",
                  o.disabled && "opacity-60"
                )}
              >
                <Checkbox
                  checked={checked}
                  disabled={o.disabled}
                  onCheckedChange={(val) => {
                    toggleOne(o.value, Boolean(val));
                  }}
                />
                <span className="text-sm line-clamp-2">{o.label}</span>
              </label>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default MultiSelect;
