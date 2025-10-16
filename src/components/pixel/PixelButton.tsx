import { forwardRef } from "react";
import { Button } from "../ui/button";

export interface PixelButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
}

export const PixelButton = forwardRef<HTMLButtonElement, PixelButtonProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <Button ref={ref} className={className} {...props}>
        {children}
      </Button>
    );
  }
);
PixelButton.displayName = "PixelButton";
