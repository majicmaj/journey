import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface PixelButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

export const PixelButton = forwardRef<HTMLButtonElement, PixelButtonProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "pixel-frame select-none uppercase tracking-wide px-3 py-2 bg-primary text-primary-foreground hover:bg-primary/90 active:translate-y-0.5",
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
PixelButton.displayName = "PixelButton";
