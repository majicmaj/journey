import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { Input } from "../ui/input";

export interface PixelInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  children?: React.ReactNode;
}

export const PixelInput = forwardRef<HTMLInputElement, PixelInputProps>(
  ({ className, disabled, type, ...props }, ref) => {
    return (
      <div
        className={cn(
          "pixel-frame w-full flex",
          disabled && "opacity-50",
          type === "checkbox" && "size-8"
        )}
      >
        <Input
          ref={ref}
          disabled={disabled}
          type={type}
          className={cn(
            "bg-card flex-1 text-foreground px-2 py-1.5 placeholder:text-muted-foreground outline-none",
            type === "checkbox" && "p-0 size-8",
            className
          )}
          {...props}
        />
      </div>
    );
  }
);
PixelInput.displayName = "PixelInput";
