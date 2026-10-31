"use client";

import { Link2, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useActionState, useRef, useState } from "react";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { DEFAULT_SHARE_EXPIRY_DAYS, SHARE_EXPIRY_DAYS, type ShareLinkView } from "./share";
import { createShareLink, type ShareFormState } from "./share-actions";
import { ShareLinksList } from "./share-links-list";

/**
 * "Share link" on the client report: creates a read-only link to this
 * client's report for the period on screen, shows it once to copy, and lists
 * the client's links that still open, each with Revoke (D-NEW-share-1).
 */
export function ShareDialog({
  clientId,
  clientName,
  preset,
  periodStart,
  periodEnd,
  periodLabel,
  links,
  unavailable,
}: {
  clientId: string;
  clientName: string;
  preset: string;
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  /** The client's active links; null where there are none to list (the demo). */
  links: ShareLinkView[] | null;
  /** Why this person can't create a link here (demo, not the owner); null when they can. */
  unavailable: string | null;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger className={buttonClasses("secondary")}>
        <Link2 aria-hidden size={14} strokeWidth={1.75} />
        Share link
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/30 data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in motion-reduce:animate-none" />
        <Dialog.Content className="fixed top-[12vh] left-1/2 z-50 max-h-[80vh] w-[calc(100vw-32px)] max-w-[480px] -translate-x-1/2 overflow-y-auto rounded-lg border border-border bg-surface p-5 shadow-md focus:outline-none data-[state=closed]:animate-menu-out data-[state=open]:animate-menu-in motion-reduce:animate-none">
          <Dialog.Title className="pr-8 text-base font-semibold tracking-[-0.01em] text-ink">
            Share this report
          </Dialog.Title>
          <Dialog.Description className="mt-1.5 text-sm text-ink-secondary">
            Anyone with the link can read {clientName}&apos;s report for{" "}
            <span className="font-medium whitespace-nowrap text-ink">{periodLabel}</span>{" "}
            without signing in. Nothing from other clients or periods is shown.
          </Dialog.Description>
          <Dialog.Close
            aria-label="Close"
            className={buttonClasses("ghost", "md", "absolute top-3 right-3 size-8 px-0")}
          >
            <X aria-hidden size={16} />
          </Dialog.Close>

          {unavailable ? (
            <p className="mt-4 rounded-md border border-dashed border-border-strong bg-surface-subtle px-3 py-2 text-xs text-ink-secondary">
              {unavailable}
            </p>
          ) : (
            <CreateLink
              // A fresh form for each client and period.
              key={`${clientId}-${periodStart}-${periodEnd}`}
              clientId={clientId}
              preset={preset}
              periodStart={periodStart}
              periodEnd={periodEnd}
            />
          )}

          {links ? (
            <section
              aria-labelledby="share-active"
              className="mt-5 border-t border-border pt-4"
            >
              <h3 id="share-active" className="text-sm font-semibold text-ink">
                Active links for {clientName}
              </h3>
              <ShareLinksList
                links={links}
                showClient={false}
                empty="No active links for this client."
              />
              <p className="mt-2 text-xs text-ink-muted">
                A revoked or expired link shows &ldquo;This link has expired&rdquo;. Every link
                is also listed in Settings.
              </p>
            </section>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function CreateLink({
  clientId,
  preset,
  periodStart,
  periodEnd,
}: {
  clientId: string;
  preset: string;
  periodStart: string;
  periodEnd: string;
}) {
  const [state, action, pending] = useActionState<ShareFormState, FormData>(
    createShareLink.bind(null, clientId, preset, periodStart, periodEnd),
    { ok: false, message: null, path: null, expiresAt: null },
  );
  const [copied, setCopied] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const url =
    state.path && typeof window !== "undefined"
      ? new URL(state.path, window.location.origin).toString()
      : null;

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // No clipboard permission: select the text so it can be copied by hand.
      input.current?.select();
    }
  };

  if (state.ok && url)
    return (
      <div className="mt-4" role="status">
        <label htmlFor="share-url" className="text-xs font-medium text-ink-muted">
          Link, read only
        </label>
        <div className="mt-1 flex gap-2">
          <input
            ref={input}
            id="share-url"
            readOnly
            value={url}
            onFocus={(event) => event.currentTarget.select()}
            className="h-8 min-w-0 flex-1 rounded-md border border-border bg-surface-subtle px-3 text-sm text-ink focus-visible:border-accent-border focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent"
          />
          <button type="button" onClick={copy} className={buttonClasses("primary")}>
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
        <p className="mt-2 text-xs text-ink-muted">
          Copy it now: only a fingerprint of the link is kept, so it can&apos;t be shown again.
        </p>
      </div>
    );

  return (
    <form action={action} className="mt-4">
      <label htmlFor="share-days" className="text-xs font-medium text-ink-muted">
        Link expires after
      </label>
      <div className="mt-1 flex flex-wrap gap-2">
        <select
          id="share-days"
          name="days"
          defaultValue={DEFAULT_SHARE_EXPIRY_DAYS}
          className="h-8 rounded-md border border-border-strong bg-surface px-2.5 text-sm text-ink transition-[color,background-color,border-color] hover:border-ink-faint focus-visible:border-accent-border focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent"
        >
          {SHARE_EXPIRY_DAYS.map((days) => (
            <option key={days} value={days}>
              {days} days
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className={buttonClasses("primary", "md", cn(pending && "opacity-70"))}
        >
          {pending ? "Creating link…" : "Create link"}
        </button>
      </div>
      {state.message ? (
        <p role="alert" className="mt-2 text-xs text-negative">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
