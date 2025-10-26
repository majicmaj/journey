import { useMemo, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  // Allow creating a new option inline. When provided, an input row will appear.
  creatable?: boolean;
  createPlaceholder?: string;
  // Return the created option value to be selected (and optionally added to options upstream)
  onCreate?: (input: string) => Value | null | undefined;
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
  creatable = false,
  createPlaceholder = "Add new",
  onCreate,
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

  const [createInput, setCreateInput] = useState("");

  function handleCreate() {
    const raw = createInput.trim();
    if (!creatable || !raw) return;
    // Prevent duplicates by value string match
    const exists = options.some(
      (o) => String(o.value) === raw || o.label === raw
    );
    const alreadySelected = value.some((v) => String(v) === raw);
    let createdValue: Value | null | undefined = undefined;
    if (!exists && onCreate) {
      createdValue = onCreate(raw);
    } else if (exists) {
      // If it already exists, find its value
      const found = options.find(
        (o) => o.label === raw || String(o.value) === raw
      );
      createdValue = found?.value as Value | undefined;
    }
    // If we have a value to select, add it
    if (createdValue != null && !alreadySelected) {
      onChange([...value, createdValue]);
    }
    setCreateInput("");
  }

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
          {creatable && (
            <div className="flex gap-2 mb-2">
              <div className="pixel-frame flex-1">
                <Input
                  placeholder={createPlaceholder}
                  value={createInput}
                  className="bg-background flex-1"
                  onChange={(e) => setCreateInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate();
                  }}
                />
              </div>
              <Button
                size="icon"
                disabled={!createInput.trim()}
                onClick={handleCreate}
              >
                +
              </Button>
            </div>
          )}
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
