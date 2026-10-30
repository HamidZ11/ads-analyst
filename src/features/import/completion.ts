import { FIRST_IMPORT_LANDING } from "@/features/onboarding/imported-note";
import { OVERVIEW_PATH } from "@/lib/routes";

/**
 * Where a completed import leads. The workspace's first import opens Insights
 * on the findings it produced; later imports offer the Overview, as before
 * (D-NEW-onboarding-3).
 */
export function importDestination(firstImport: boolean) {
  return firstImport
    ? { href: FIRST_IMPORT_LANDING, label: "View findings" }
    : { href: OVERVIEW_PATH, label: "View Overview" };
}

/** After an import completes: select the imported client, then open `href`. */
export async function openImportedClient(
  clientId: string,
  select: (clientId: string) => Promise<unknown>,
  navigate: (href: string) => void,
  href: string = OVERVIEW_PATH,
): Promise<void> {
  await select(clientId);
  navigate(href);
}
