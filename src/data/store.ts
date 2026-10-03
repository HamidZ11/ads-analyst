import { mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ClientDataBundle } from "./import/normalize";

/**
 * Persistence boundary for imported data. The product reads through the
 * repository; only the import service writes here. Seeded demo data is never
 * stored, so imports can never modify it.
 *
 * Two implementations: in memory (tests) and a local JSON file (single-user,
 * self-hosted MVP). A hosted, multi-user deployment needs a database behind
 * this same interface; that decision is recorded as open in DECISIONS.md.
 */
export interface ImportedState {
  version: 1;
  clients: ClientDataBundle[];
}

export interface ImportStore {
  read(): ImportedState;
  write(state: ImportedState): void;
  /** Changes whenever the stored data changes; used to rebuild the repository. */
  revision(): string;
}

export const EMPTY_STATE: ImportedState = { version: 1, clients: [] };

export class StoreReadError extends Error {}

function checkState(value: unknown): ImportedState {
  if (
    typeof value !== "object" ||
    value === null ||
    (value as { version?: unknown }).version !== 1 ||
    !Array.isArray((value as { clients?: unknown }).clients)
  )
    throw new StoreReadError("Stored import data has an unexpected shape.");
  return value as ImportedState;
}

export class MemoryImportStore implements ImportStore {
  private state: ImportedState;
  private counter = 0;
  constructor(initial: ImportedState = EMPTY_STATE) {
    this.state = structuredClone(initial);
  }
  read() {
    return structuredClone(this.state);
  }
  write(state: ImportedState) {
    this.state = structuredClone(checkState(state));
    this.counter += 1;
  }
  revision() {
    return String(this.counter);
  }
}

/** One JSON file, written atomically (temp file then rename). */
export class FileImportStore implements ImportStore {
  readonly file: string;
  constructor(private readonly dir: string) {
    this.file = join(dir, "imports.json");
  }
  read(): ImportedState {
    let text: string;
    try {
      text = readFileSync(this.file, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        return structuredClone(EMPTY_STATE);
      throw new StoreReadError(
        `Stored import data could not be read (${(error as Error).message}).`,
      );
    }
    try {
      return checkState(JSON.parse(text));
    } catch (error) {
      if (error instanceof StoreReadError) throw error;
      throw new StoreReadError("Stored import data is not valid JSON.");
    }
  }
  write(state: ImportedState) {
    checkState(state);
    mkdirSync(this.dir, { recursive: true });
    const temp = `${this.file}.${process.pid}.tmp`;
    writeFileSync(temp, JSON.stringify(state), "utf8");
    renameSync(temp, this.file);
  }
  revision() {
    try {
      const stat = statSync(this.file);
      return `${stat.mtimeMs}:${stat.size}`;
    } catch {
      return "none";
    }
  }
}

let store: ImportStore | null = null;

/** The process-wide store: `AD_ANALYST_DATA_DIR`, or `.data/` in the project. */
export function getImportStore(): ImportStore {
  store ??= new FileImportStore(
    process.env.AD_ANALYST_DATA_DIR ?? join(process.cwd(), ".data"),
  );
  return store;
}

/** Tests and scripts can swap the store. */
export function setImportStore(next: ImportStore | null) {
  store = next;
}
