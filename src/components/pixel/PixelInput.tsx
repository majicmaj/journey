import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { Input } from "../ui/input";

export interface PixelInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  children?: React.ReactNode;
}

export const PixelInput = forwardRef<HTMLInputElement, PixelInputProps>(
  ({ className, disabled, ...props }, ref) => {
    return (
      <div className={cn("pixel-frame w-full flex", disabled && "opacity-50")}>
        <Input
          ref={ref}
          disabled={disabled}
          className={cn(
            "bg-card flex-1 text-foreground px-2 py-1.5 placeholder:text-muted-foreground outline-none",
            className
          )}
          {...props}
        />
      </div>
    );
  }
);
PixelInput.displayName = "PixelInput";
