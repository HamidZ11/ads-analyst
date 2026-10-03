import type { AskInterpretation } from "./model";

export function normalizeQuestion(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9%]+/g, " ")
    .trim();
}

/** Deliberately bounded language interpretation. It never produces factual claims. */
export function interpretQuestion(question: string): AskInterpretation {
  const q = normalizeQuestion(question);
  const days = q.match(/\b(\d+)\s*(?:days?|d)\b/);
  const requestedDays = days
    ? Number(days[1])
    : /\b(?:this|last) week\b/.test(q)
      ? 7
      : undefined;
  const answer = (intent: AskInterpretation["intent"]): AskInterpretation => ({
    intent,
    ...(requestedDays !== undefined ? { requestedDays } : {}),
  });
  if (
    /\b(?:competitor|competitors|benchmark|benchmarks|weather|forecast|predict|prediction|tomorrow|next week|write|generate|ignore|budget change|pause|delete|another client|other client)\b/.test(
      q,
    )
  )
    return {
      intent: "unsupported",
      reason: "That request is outside the available read-only performance analysis.",
    };
  if (
    /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|yesterday|today|month|months|quarter|year|years)\b/.test(
      q,
    )
  )
    return {
      intent: "unsupported",
      reason:
        "Use the date controls to select the period first, then ask about the selected period.",
    };
  const cpa =
    /\b(?:cpa|cpl|cpt|cost per (?:purchase|lead|trial|conversion|acquisition))\b/.test(q);
  const roas = /\b(?:roas|return on (?:ad |advertising )?spend)\b/.test(q);
  const ctr = /\b(?:ctr|click through rate|clickthrough)\b/.test(q);
  if ([cpa, roas, ctr].filter(Boolean).length > 1)
    return {
      intent: "unsupported",
      reason:
        "Ask about one efficiency metric at a time, or request a comparison of the whole period.",
    };
  if (/\b(?:fatigue|fatigued|bored|saturation|saturated)\b/.test(q)) return answer("fatigue");
  if (
    /\bcreatives?\b/.test(q) &&
    /\bcampaign\b/.test(q) &&
    /\b(?:show|list|which|in|inside|within|used|belong)\b/.test(q)
  )
    return answer("campaign_creatives");
  if (/\b(?:concentrat\w*|share of spend|top (?:three|3)|spend split)\b/.test(q))
    return answer("concentration");
  if (
    /\b(?:wast\w*|zero|no (?:purchases?|leads?|trials?|conversions?|results?)|without (?:purchases?|leads?|trials?|conversions?|results?))\b/.test(
      q,
    )
  )
    return answer("waste");
  if (roas) return answer("roas");
  if (cpa) return answer("cpa");
  if (ctr) return answer("ctr");
  if (/\bcreatives?\b/.test(q)) {
    if (
      /\b(?:best|strongest|winner|winning|performing well|performing best|efficient|efficiency)\b/.test(
        q,
      )
    )
      return answer("strongest_creative");
    if (/\b(?:investigate|inspect|attention|worst|weakest|review|monitor)\b/.test(q))
      return answer("investigate_creative");
  }
  if (/\b(?:improv\w*|better|recovered|recovery)\b/.test(q)) return answer("improvement");
  if (
    /\b(?:deteriorat\w*|declined most|worsen\w*|biggest decline|biggest drop|losing .*while spend)\b/.test(
      q,
    )
  )
    return answer("deterioration");
  if (/\b(?:campaign|campaigns)\b/.test(q)) {
    if (/\b(?:best|strongest|winner|winning|more budget|scale|performing best)\b/.test(q))
      return answer("strongest_campaign");
    if (/\b(?:worst|weakest|least efficient)\b/.test(q)) return answer("weakest_campaign");
  }
  if (/\b(?:investigate|inspect|attention|review|monitor|contributed most)\b/.test(q))
    return answer("investigate_campaign");
  if (
    /\bspend\b/.test(q) &&
    /\b(?:higher|lower|increas\w*|decreas\w*|rose|rise|fell|change\w*|also)\b/.test(q)
  )
    return answer("spend");
  if (
    /\b(?:what changed|compare|comparison|performance|previous period|last period|last week)\b/.test(
      q,
    )
  )
    return answer("comparison");
  return {
    intent: "unsupported",
    reason: "I can’t answer that reliably from the available analysis yet.",
  };
}
