import { OVERVIEW_PATH } from "@/lib/routes";

/** After an import completes: select the imported client, then open its Overview. */
export async function openImportedClient(
  clientId: string,
  select: (clientId: string) => Promise<unknown>,
  navigate: (href: string) => void,
): Promise<void> {
  await select(clientId);
  navigate(OVERVIEW_PATH);
}
