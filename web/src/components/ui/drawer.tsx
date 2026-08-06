"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function Drawer({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="drawer" {...props} />;
}

function DrawerTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="drawer-trigger" {...props} />;
}

function DrawerPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="drawer-portal" {...props} />;
}

function DrawerOverlay({ className, ...props }: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="drawer-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/35 backdrop-blur-sm duration-200 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  );
}

function DrawerContent({ className, children, ...props }: DialogPrimitive.Popup.Props) {
  return (
    <DrawerPortal>
      <DrawerOverlay />
      <DialogPrimitive.Popup
        data-slot="drawer-content"
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 grid max-h-[88vh] gap-4 rounded-t-[var(--radius-3xl)] border border-border/70 bg-card p-5 text-sm text-card-foreground shadow-[var(--shadow-dialog)] outline-none duration-200 data-open:animate-in data-open:slide-in-from-bottom-8 data-closed:animate-out data-closed:slide-out-to-bottom-8",
          className
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          data-slot="drawer-close"
          render={
            <Button variant="ghost" size="icon-sm" className="absolute right-3 top-3 rounded-full" />
          }
        >
          <XIcon className="h-4 w-4" />
          <span className="sr-only">Close drawer</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Popup>
    </DrawerPortal>
  );
}

export { Drawer, DrawerContent, DrawerOverlay, DrawerPortal, DrawerTrigger };