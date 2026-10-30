import type { DataCoverage } from "@/data";
import type { Client, ClientDataSource, ImportRecord } from "@/domain/types";
import type { WorkspaceContext } from "@/features/workspace/context";

export type OnboardingStepId = "client" | "import" | "findings" | "targets";
export type OnboardingStepStatus = "done" | "current" | "upcoming";

export interface OnboardingStep {
  id: OnboardingStepId;
  status: OnboardingStepStatus;
  optional: boolean;
}

/**
 * Where a new workspace is on the way to its first finding. Every step is
 * read from what the workspace holds (clients, imports, stored days, targets);
 * nothing is stored to remember progress (D-NEW-onboarding-2).
 */
export interface OnboardingProgress {
  steps: OnboardingStep[];
  /** Steps done, out of `steps.length`. */
  done: number;
  /** A client, an import and stored days: findings can be read. */
  ready: boolean;
  /** Every step, including the optional targets. */
  complete: boolean;
  /** The imported client the remaining steps refer to, or null before the first import. */
  client: Client | null;
  /** That client's newest import. */
  latestImport: ImportRecord | null;
  coverage: DataCoverage | null;
}

export interface OnboardingInput {
  clients: readonly Client[];
  sources: readonly ClientDataSource[];
  coverage: (clientId: string) => DataCoverage | null;
  /** The selected client; preferred when it is one of the imported clients. */
  selectedClientId: string | null;
}

const ORDER: readonly OnboardingStepId[] = ["client", "import", "findings", "targets"];

export const hasTarget = (client: Client) =>
  client.targetCpa !== null || client.targetRoas !== null;

export function onboardingProgress(input: OnboardingInput): OnboardingProgress {
  const imported = input.clients.filter((client) =>
    input.sources.some(
      (s) => s.clientId === client.id && s.kind === "meta_csv" && s.imports.length > 0,
    ),
  );
  const withDays = imported.filter((c) => (input.coverage(c.id)?.days ?? 0) > 0);
  const done: Record<OnboardingStepId, boolean> = {
    client: input.clients.length > 0,
    import: imported.length > 0,
    findings: withDays.length > 0,
    targets: imported.some(hasTarget),
  };

  // The selected client when it was imported, otherwise the first imported one
  // with days (the one Insights can show), otherwise the first imported one.
  const client =
    imported.find((c) => c.id === input.selectedClientId) ?? withDays[0] ?? imported[0] ?? null;
  const source = client ? input.sources.find((s) => s.clientId === client.id) : undefined;

  const current = ORDER.find((id) => !done[id]);
  const steps = ORDER.map((id) => ({
    id,
    optional: id === "targets",
    status: done[id] ? "done" : id === current ? "current" : "upcoming",
  })) satisfies OnboardingStep[];

  return {
    steps,
    done: steps.filter((s) => s.status === "done").length,
    ready: done.client && done.import && done.findings,
    complete: ORDER.every((id) => done[id]),
    client,
    latestImport: source?.imports[0] ?? null,
    coverage: client ? input.coverage(client.id) : null,
  };
}

/**
 * Progress for a signed-in workspace. Null in demo mode, which never shows
 * onboarding: its clients are seeded and imports are off.
 */
export function workspaceProgress(context: WorkspaceContext): OnboardingProgress | null {
  if (context.mode !== "supabase" || !context.canImport) return null;
  const { repository } = context;
  return onboardingProgress({
    clients: context.clients,
    sources: context.clients.map((c) => repository.getDataSource(c.id)),
    coverage: (id) => repository.getCoverage(id),
    selectedClientId: context.client?.id ?? null,
  });
}
