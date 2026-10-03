import type { ColumnMapping, CsvTable, ImportField, ImportFieldKey } from "@/data/import";
import { cn } from "@/lib/cn";

const SELECT =
  "h-8 w-full min-w-0 rounded-md border border-border bg-surface px-2 text-sm text-ink transition-colors hover:border-border-strong aria-[invalid=true]:border-negative";

export function sampleOf(table: CsvTable, index: number | undefined) {
  if (index === undefined) return "";
  for (const row of table.rows.slice(0, 50)) {
    const value = (row[index] ?? "").trim();
    if (value) return value.length > 36 ? `${value.slice(0, 35)}…` : value;
  }
  return "";
}

/**
 * Advanced column mapping: field → column, with the first value as a check.
 * Each field offers only columns that can hold it (numbers for metrics, dates
 * for dates); "Required" and "ID or name required" are stated in words.
 */
export function MappingTable({
  table,
  fields,
  mapping,
  optionsFor,
  onChange,
  invalid,
  notes,
}: {
  table: CsvTable;
  fields: readonly ImportField[];
  mapping: ColumnMapping;
  optionsFor: (field: ImportFieldKey) => number[];
  onChange: (field: ImportFieldKey, column: number | undefined) => void;
  invalid: ReadonlySet<ImportFieldKey>;
  notes: Partial<Record<ImportFieldKey, string>>;
}) {
  return (
    <div className="overflow-x-auto [contain:paint]">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <caption className="sr-only">Column mapping</caption>
        <thead>
          <tr className="border-b border-border text-xs text-ink-muted">
            <th scope="col" className="h-8 w-[38%] pr-4 text-left font-medium">
              Field
            </th>
            <th scope="col" className="h-8 w-[34%] pr-4 text-left font-medium">
              Column in the file
            </th>
            <th scope="col" className="h-8 text-left font-medium">
              First value
            </th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field) => {
            const id = `map-${field.key}`;
            const noteId = `${id}-note`;
            const note = notes[field.key];
            const isInvalid = invalid.has(field.key);
            return (
              <tr key={field.key} className="border-b border-border align-top last:border-b-0">
                <td className="py-2 pr-4">
                  <label htmlFor={id} className="block text-sm text-ink">
                    {field.label}
                  </label>
                  <span className="block text-xs text-ink-muted">
                    {field.requirement === "required"
                      ? "Required"
                      : field.requirement === "identity"
                        ? "ID or name required"
                        : "Optional"}
                  </span>
                </td>
                <td className="py-2 pr-4">
                  <select
                    id={id}
                    value={mapping[field.key] ?? ""}
                    aria-invalid={isInvalid || undefined}
                    aria-describedby={note ? noteId : undefined}
                    onChange={(e) =>
                      onChange(
                        field.key,
                        e.target.value === "" ? undefined : Number(e.target.value),
                      )
                    }
                    className={SELECT}
                  >
                    <option value="">Not used</option>
                    {optionsFor(field.key).map((index) => (
                      <option key={index} value={index}>
                        {table.headers[index]}
                      </option>
                    ))}
                  </select>
                  {note ? (
                    <p
                      id={noteId}
                      className={cn(
                        "mt-1 text-xs leading-4",
                        isInvalid ? "text-negative" : "text-ink-muted",
                      )}
                    >
                      {note}
                    </p>
                  ) : null}
                </td>
                <td className="max-w-0 py-2 text-xs leading-8 text-ink-muted">
                  <span
                    className="block truncate tabular"
                    title={sampleOf(table, mapping[field.key])}
                  >
                    {sampleOf(table, mapping[field.key]) || "—"}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
