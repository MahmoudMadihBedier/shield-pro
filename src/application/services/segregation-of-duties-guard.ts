// Phase 2.1 of SHIELD_PRO_REFACTOR_MASTER_PLAN.md — "the person who requests
// something is never the same person who approves or confirms it." This is
// the single reusable check every approval-type service call should run
// (Open/Closed: new movement types plug into the same guard instead of each
// one hand-rolling its own comparison).
//
// This is a FRONT-LINE check only — it exists to give the UI a clean,
// immediate Arabic error instead of a raw Postgres exception. The actual,
// unbypassable enforcement lives server-side in each table's own trigger
// (enforce_closeout_segregation_of_duties, enforce_production_request_
// segregation_of_duties, enforce_distribution_order_segregation_of_duties)
// — even a direct API call that skips this guard is still blocked by RLS +
// trigger. Never remove the DB-side trigger in favor of relying on this
// alone.
export class SegregationOfDutiesViolation extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SegregationOfDutiesViolation';
  }
}

export interface SegregationCheck {
  requestedBy: string;
  actingUserId: string;
  action: string; // human-readable, used in the error message
}

export function assertSegregationOfDuties({ requestedBy, actingUserId, action }: SegregationCheck): void {
  if (requestedBy === actingUserId) {
    throw new SegregationOfDutiesViolation(
      `لا يمكن لنفس الشخص الذي قدّم الطلب أن يقوم بـ"${action}" — يجب أن يتم ذلك بواسطة شخص آخر (فصل المهام)`
    );
  }
}
