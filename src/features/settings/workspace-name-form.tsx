"use client";

import { useActionState } from "react";
import { buttonClasses } from "@/components/ui/button";
import { renameWorkspace, type WorkspaceNameState } from "./actions";

const INPUT =
  "mt-1 h-8 w-full rounded-md border border-border bg-surface px-2.5 text-sm text-ink transition-[color,background-color,border-color] hover:border-border-strong";

/** The workspace's name, which heads every client report it sends. */
export function WorkspaceNameForm({ name }: { name: string }) {
  const [state, action, pending] = useActionState<WorkspaceNameState, FormData>(
    renameWorkspace,
    { ok: false, message: null },
  );
  return (
    <form action={action} className="grid gap-x-4 gap-y-2 sm:grid-cols-[1fr_auto] sm:items-end">
      <div>
        <label htmlFor="workspace-name" className="text-xs font-medium text-ink-muted">
          Workspace name
        </label>
        <input
          id="workspace-name"
          name="workspaceName"
          type="text"
          required
          maxLength={120}
          defaultValue={name}
          aria-describedby="workspace-name-hint"
          className={INPUT}
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className={buttonClasses("secondary", "md", pending ? "opacity-70" : undefined)}
      >
        {pending ? "Saving…" : "Save name"}
      </button>
      <p id="workspace-name-hint" className="text-xs text-ink-muted sm:col-span-2">
        Your agency&apos;s name as clients see it at the top of every client report.
      </p>
      <p
        role="status"
        className={`text-xs sm:col-span-2 ${state.ok ? "text-ink-muted" : "text-negative"}`}
      >
        {state.message}
      </p>
    </form>
  );
}
