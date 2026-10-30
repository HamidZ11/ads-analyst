"use client";

import { useActionState } from "react";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { ShareLinkView } from "./share";
import { revokeShareLink, type RevokeState } from "./share-actions";

function RevokeButton({ link, showClient }: { link: ShareLinkView; showClient: boolean }) {
  const [state, action, pending] = useActionState<RevokeState, FormData>(
    revokeShareLink.bind(null, link.id),
    { ok: false, message: null },
  );
  return (
    <form action={action} className="flex shrink-0 items-center gap-2">
      {state.message && !state.ok ? (
        <span role="alert" className="text-xs text-negative">
          {state.message}
        </span>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        aria-label={`Revoke the link to ${showClient ? `${link.clientName}'s report for ` : ""}${link.periodLabel}`}
        className={buttonClasses("secondary", "sm", pending ? "opacity-70" : undefined)}
      >
        Revoke
      </button>
    </form>
  );
}

/** The links that still open, each with Revoke. Used in the share dialog and in Settings. */
export function ShareLinksList({
  links,
  showClient,
  empty,
}: {
  links: ShareLinkView[];
  showClient: boolean;
  empty: string;
}) {
  if (links.length === 0) return <p className="py-2.5 text-sm text-ink-muted">{empty}</p>;
  return (
    <ul className="divide-y divide-border">
      {links.map((link) => (
        <li key={link.id} className="flex items-center justify-between gap-3 py-2.5">
          <div className="min-w-0">
            <p className={cn("truncate text-sm text-ink", showClient && "font-medium")}>
              {showClient ? `${link.clientName} · ${link.periodLabel}` : link.periodLabel}
            </p>
            <p className="mt-0.5 text-xs text-ink-muted">
              Expires {link.expiresLabel} · created {link.createdLabel}
            </p>
          </div>
          <RevokeButton link={link} showClient={showClient} />
        </li>
      ))}
    </ul>
  );
}
