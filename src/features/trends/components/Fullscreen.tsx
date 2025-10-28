import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { FullScreenIcon } from "@/components/pixel/icons";
import { Button } from "@/components/ui/button";

export default function Fullscreen({
  children,
  affordance,
}: {
  children: (opts: { close: () => void }) => React.ReactNode;
  affordance: (opts: { open: () => void }) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {affordance({ open: () => setOpen(true) })}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          noPadding={true}
          showCloseButton={true}
          className="h-[calc(100vh-1rem)] sm:max-w-none max-w-none w-[calc(100vw-1rem)]"
        >
          {children({ close: () => setOpen(false) })}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function FullScreenButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="flex-1 flex justify-end mb-1">
      <Button size="icon" onClick={onClick}>
        <FullScreenIcon className="size-8" />
      </Button>
    </div>
  );
}
