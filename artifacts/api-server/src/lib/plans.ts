// Pricing plans and per-plan limits.
//
// UNLIMITED is represented as null (not Infinity or a large number) to keep
// this serializable as JSON.

export const UNLIMITED = null;

export interface PlanLimits {
  key: "free" | "starter" | "growth" | "agency";
  name: string;
  priceMonthly: number; // USD
  // Max events the org can have in a non-archived state (any status).
  events: number | null;
  // Max attendees (guest rows) per event.
  attendeesPerEvent: number | null;
  // Max team members (active + invited) on the org.
  users: number | null;
}

export const PLANS: Record<string, PlanLimits> = {
  free: {
    key: "free",
    name: "Free",
    priceMonthly: 0,
    events: 1,
    attendeesPerEvent: 20,
    users: 1,
  },
  starter: {
    key: "starter",
    name: "Starter",
    priceMonthly: 49,
    events: 3,
    attendeesPerEvent: 100,
    users: 3,
  },
  growth: {
    key: "growth",
    name: "Growth",
    priceMonthly: 149,
    events: 15,
    attendeesPerEvent: 500,
    users: 10,
  },
  agency: {
    key: "agency",
    name: "Agency",
    priceMonthly: 399,
    events: UNLIMITED,
    attendeesPerEvent: 2000,
    users: UNLIMITED,
  },
};

export const PLAN_ORDER: PlanLimits["key"][] = ["free", "starter", "growth", "agency"];

export function getPlan(planKey: string | null | undefined): PlanLimits {
  if (!planKey) return PLANS.free;
  return PLANS[planKey] ?? PLANS.free;
}

/**
 * Describes why a limit was hit. Thrown as 402 by routes.
 */
export class PlanLimitError extends Error {
  readonly code = "PLAN_LIMIT_EXCEEDED";
  readonly limit: string;
  readonly plan: string;
  readonly current: number;
  readonly max: number | null;
  readonly suggestedPlan?: string;

  constructor(opts: { limit: string; plan: string; current: number; max: number | null; suggestedPlan?: string }) {
    super(`Plan limit exceeded: ${opts.limit} (plan=${opts.plan}, current=${opts.current}, max=${opts.max ?? "∞"})`);
    this.limit = opts.limit;
    this.plan = opts.plan;
    this.current = opts.current;
    this.max = opts.max;
    this.suggestedPlan = opts.suggestedPlan;
  }
}

/**
 * Returns the next plan up that would accommodate `needed` for a given limit,
 * or undefined when already on the top tier.
 */
export function suggestUpgrade(fromPlan: string, limitKey: keyof PlanLimits, needed: number): string | undefined {
  const idx = PLAN_ORDER.indexOf(fromPlan as PlanLimits["key"]);
  for (let i = idx + 1; i < PLAN_ORDER.length; i++) {
    const candidate = PLANS[PLAN_ORDER[i]];
    const cap = candidate[limitKey] as number | null;
    if (cap === null || cap >= needed) return candidate.key;
  }
  return undefined;
}

/**
 * Throws PlanLimitError when the requested total exceeds the plan's cap.
 * When max is null the check is a no-op (unlimited).
 */
export function assertWithinLimit(
  plan: string,
  limitKey: "events" | "attendeesPerEvent" | "users",
  current: number,
  max: number | null,
  prettyLabel: string,
): void {
  if (max === null) return;
  if (current <= max) return;
  throw new PlanLimitError({
    limit: prettyLabel,
    plan,
    current,
    max,
    suggestedPlan: suggestUpgrade(plan, limitKey, current),
  });
}
