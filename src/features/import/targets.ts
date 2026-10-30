// Target validation shared by Settings, the import and the browser audit; no server code.

export const MAX_TARGET_CPA = 1_000_000;
export const MAX_TARGET_ROAS = 1_000;

export const positiveOrNull = (value: unknown, max: number): number | null | "invalid" => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > max)
    return "invalid";
  return value;
};

/** Optional targets from a form: positive numbers or blank; ROAS needs conversion value. */
export function readTargets(
  input: { targetCpa: unknown; targetRoas: unknown },
  revenueTracked: boolean,
):
  | { ok: true; targetCpa: number | null; targetRoas: number | null }
  | { ok: false; message: string } {
  const targetCpa = positiveOrNull(input.targetCpa, MAX_TARGET_CPA);
  const targetRoas = positiveOrNull(input.targetRoas, MAX_TARGET_ROAS);
  if (targetCpa === "invalid")
    return { ok: false, message: "Target CPA must be a positive amount." };
  if (targetRoas === "invalid")
    return { ok: false, message: "Target ROAS must be a positive multiple." };
  if (targetRoas !== null && !revenueTracked)
    return {
      ok: false,
      message:
        "A ROAS target needs conversion value, which this client's imports do not include.",
    };
  return { ok: true, targetCpa, targetRoas };
}
