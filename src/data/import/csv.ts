/**
 * A small, strict CSV reader for untrusted uploads. Source-agnostic: it knows
 * nothing about Meta. Handles UTF-8 (with or without BOM) and UTF-16 with a
 * BOM, comma / semicolon / tab delimiters, quoted fields with embedded
 * delimiters, quotes and newlines, and CRLF, LF or CR line endings. Every
 * limit is enforced while reading so a hostile file cannot grow without bound.
 */

export const CSV_LIMITS = {
  /** 10 MB: comfortably above a year of daily ad-level rows for a typical account. */
  maxBytes: 10 * 1024 * 1024,
  maxRows: 100_000,
  maxColumns: 200,
  maxCellLength: 2_000,
} as const;

export type CsvLimits = { [K in keyof typeof CSV_LIMITS]: number };

export type CsvErrorCode =
  | "too_large"
  | "empty"
  | "binary"
  | "encoding"
  | "unterminated_quote"
  | "too_many_rows"
  | "too_many_columns"
  | "cell_too_long"
  | "no_rows";

export interface CsvError {
  code: CsvErrorCode;
  message: string;
}

export type Delimiter = "," | ";" | "\t";

export interface CsvTable {
  headers: string[];
  /** Data rows as read; widths may differ from the header (validation reports that). */
  rows: string[][];
  /** The 1-based line on which each data row starts, for messages. */
  lines: number[];
  delimiter: Delimiter;
}

export type CsvResult = { ok: true; table: CsvTable } | { ok: false; error: CsvError };
export type DecodeResult = { ok: true; text: string } | { ok: false; error: CsvError };

const MB = 1024 * 1024;

function sizeLabel(bytes: number) {
  return bytes >= MB ? `${(bytes / MB).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
}

/** Decodes uploaded bytes to text, refusing anything that is not text. */
export function decodeCsvBytes(
  bytes: Uint8Array,
  limits: CsvLimits = CSV_LIMITS,
): DecodeResult {
  if (bytes.length === 0)
    return { ok: false, error: { code: "empty", message: "The file is empty." } };
  if (bytes.length > limits.maxBytes)
    return {
      ok: false,
      error: {
        code: "too_large",
        message: `The file is ${sizeLabel(bytes.length)}; the limit is ${sizeLabel(limits.maxBytes)}. Export a shorter date range or fewer columns.`,
      },
    };
  try {
    if (bytes[0] === 0xff && bytes[1] === 0xfe)
      return {
        ok: true,
        text: new TextDecoder("utf-16le", { fatal: true }).decode(bytes.subarray(2)),
      };
    if (bytes[0] === 0xfe && bytes[1] === 0xff)
      return {
        ok: true,
        text: new TextDecoder("utf-16be", { fatal: true }).decode(bytes.subarray(2)),
      };
    const start = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0;
    return {
      ok: true,
      text: new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(start)),
    };
  } catch {
    return {
      ok: false,
      error: {
        code: "encoding",
        message: "The file is not readable text. Export it again as CSV (UTF-8).",
      },
    };
  }
}

/** Picks the delimiter that splits the header line into the most fields. */
function sniffDelimiter(text: string): Delimiter {
  const counts: Record<Delimiter, number> = { ",": 0, ";": 0, "\t": 0 };
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '"') quoted = !quoted;
    else if (!quoted && (ch === "\n" || ch === "\r")) break;
    else if (!quoted && (ch === "," || ch === ";" || ch === "\t")) counts[ch] += 1;
  }
  if (counts["\t"] > counts[","] && counts["\t"] >= counts[";"]) return "\t";
  if (counts[";"] > counts[","]) return ";";
  return ",";
}

export function parseCsv(input: string, limits: CsvLimits = CSV_LIMITS): CsvResult {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  if (text.trim().length === 0)
    return { ok: false, error: { code: "empty", message: "The file is empty." } };
  if (text.length > limits.maxBytes)
    return {
      ok: false,
      error: {
        code: "too_large",
        message: `The file is larger than ${sizeLabel(limits.maxBytes)}. Export a shorter date range or fewer columns.`,
      },
    };
  if (text.includes("\u0000"))
    return {
      ok: false,
      error: {
        code: "binary",
        message: "The file contains binary data and is not a CSV export.",
      },
    };

  const delimiter = sniffDelimiter(text);
  const records: string[][] = [];
  const lines: number[] = [];
  let field = "";
  let record: string[] = [];
  let quoted = false;
  let line = 1;
  let recordLine = 1;
  let fieldStarted = false;

  const pushField = (): CsvError | null => {
    if (field.length > limits.maxCellLength)
      return {
        code: "cell_too_long",
        message: `A value on line ${recordLine} is longer than ${limits.maxCellLength.toLocaleString("en-GB")} characters.`,
      };
    record.push(field);
    field = "";
    fieldStarted = false;
    if (record.length > limits.maxColumns)
      return {
        code: "too_many_columns",
        message: `Line ${recordLine} has more than ${limits.maxColumns} columns.`,
      };
    return null;
  };
  const pushRecord = (): CsvError | null => {
    const blank = record.every((cell) => cell.trim() === "");
    if (!blank) {
      records.push(record);
      lines.push(recordLine);
      if (records.length > limits.maxRows + 1)
        return {
          code: "too_many_rows",
          message: `The file has more than ${limits.maxRows.toLocaleString("en-GB")} rows. Export a shorter date range.`,
        };
    }
    record = [];
    return null;
  };

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else {
        if (ch === "\n" || (ch === "\r" && text[i + 1] !== "\n")) line += 1;
        field += ch;
      }
      continue;
    }
    if (ch === '"' && !fieldStarted) {
      quoted = true;
      fieldStarted = true;
    } else if (ch === delimiter) {
      const error = pushField();
      if (error) return { ok: false, error };
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      const error = pushField() ?? pushRecord();
      if (error) return { ok: false, error };
      line += 1;
      recordLine = line;
    } else {
      field += ch;
      fieldStarted = true;
    }
  }
  if (quoted)
    return {
      ok: false,
      error: {
        code: "unterminated_quote",
        message: `A quoted value that starts on line ${recordLine} is never closed. The file may be cut short.`,
      },
    };
  if (field.length > 0 || record.length > 0) {
    const error = pushField() ?? pushRecord();
    if (error) return { ok: false, error };
  }

  if (records.length === 0)
    return { ok: false, error: { code: "empty", message: "The file is empty." } };
  const headers = records[0].map((h, i) => h.trim() || `Column ${i + 1}`);
  if (records.length === 1)
    return {
      ok: false,
      error: { code: "no_rows", message: "The file has a header row but no data rows." },
    };
  return {
    ok: true,
    table: { headers, rows: records.slice(1), lines: lines.slice(1), delimiter },
  };
}
