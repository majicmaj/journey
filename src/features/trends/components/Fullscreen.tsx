import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

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
          className="h-[calc(100vh-1rem)] max-w-none w-[calc(100vw-1rem)]"
          // className="max-w-none w-screen h-screen p-0"
        >
          {children({ close: () => setOpen(false) })}
        </DialogContent>
      </Dialog>
    </>
  );
}
