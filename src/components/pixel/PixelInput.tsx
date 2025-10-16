import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface PixelInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  children?: React.ReactNode;
}

export const PixelInput = forwardRef<HTMLInputElement, PixelInputProps>(
  ({ className, ...props }, ref) => {
    return (
      <div className="pixel-frame w-full flex">
        <input
          ref={ref}
          className={cn(
            "bg-card flex-1 text-foreground p-3 placeholder:text-muted-foreground outline-none",
            className
          )}
          {...props}
        />
      </div>
    );
  }
);
PixelInput.displayName = "PixelInput";
