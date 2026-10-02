"use client";

import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { Dialog } from "radix-ui";
import { useState, type ReactNode } from "react";
import { buttonClasses } from "@/components/ui/button";

/**
 * Off-canvas navigation for narrow viewports. Receives the sidebar as children.
 * Keyed by pathname so the sheet remounts closed after every navigation.
 */
export function MobileNav({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return <MobileNavSheet key={pathname}>{children}</MobileNavSheet>;
}

function MobileNavSheet({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        aria-label="Open navigation"
        className={buttonClasses("ghost", "md", "size-8 px-0")}
      >
        <Menu aria-hidden size={18} />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/30 data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in motion-reduce:animate-none" />
        <Dialog.Content className="fixed inset-y-0 left-0 z-50 flex w-[280px] max-w-[85vw] flex-col border-r border-border bg-canvas shadow-md focus:outline-none data-[state=closed]:animate-sheet-out data-[state=open]:animate-sheet-in motion-reduce:animate-none">
          <Dialog.Title className="sr-only">Navigation</Dialog.Title>
          <Dialog.Description className="sr-only">
            Switch client and move between sections.
          </Dialog.Description>
          <Dialog.Close
            aria-label="Close navigation"
            className={buttonClasses("ghost", "md", "absolute top-2 right-2 size-8 px-0")}
          >
            <X aria-hidden size={16} />
          </Dialog.Close>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
