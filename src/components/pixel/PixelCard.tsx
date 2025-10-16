import { cn } from "@/lib/utils";
import type { PropsWithChildren, HTMLAttributes } from "react";

export function PixelCard({
  className,
  children,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return (
    <div
      className={cn("pixel-frame bg-card text-card-foreground p-3", className)}
      {...props}
    >
      {children}
    </div>
  );
}
