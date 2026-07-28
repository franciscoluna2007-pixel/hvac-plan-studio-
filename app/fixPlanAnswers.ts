export const FIX_PLAN_ANSWER_VERSION = "fix-plan-answers-v130.0" as const;

export type FixPlanAnswerStatus =
  | "accepted"
  | "rfi"
  | "punch"
  | "handled-elsewhere";

export type FixPlanHandledReason =
  | "already-resolved"
  | "tracked-in-rfi"
  | "tracked-in-punch"
  | "different-system"
  | "field-verification"
  | "other";

export const FIX_PLAN_HANDLED_REASON_OPTIONS = [
  { value: "already-resolved", label: "Already resolved elsewhere" },
  { value: "tracked-in-rfi", label: "Tracked in an RFI" },
  { value: "tracked-in-punch", label: "Tracked in a punch item" },
  { value: "different-system", label: "Belongs to a different system" },
  { value: "field-verification", label: "Needs field verification" },
  { value: "other", label: "Other documented workflow" },
] as const satisfies ReadonlyArray<{
  value: FixPlanHandledReason;
  label: string;
}>;

export type FixPlanAnswerBinding = {
  issueId: string;
  evidenceFingerprint: string;
  sourceFingerprint: string;
};

export type FixPlanAnswerCompletionInput = {
  severity: "critical" | "warning" | "info";
  status?: FixPlanAnswerStatus | null;
  stale: boolean;
  rfiStatus?: "draft" | "submitted" | "answered" | "approved" | "closed" | null;
  punchStatus?: "open" | "resolved" | null;
};

/**
 * Answers are valid only for the exact issue, issue evidence, and loaded plan
 * source that a person reviewed. Missing bindings are stale rather than
 * reusable.
 */
export function isFixPlanAnswerStale(
  answer: FixPlanAnswerBinding,
  current: FixPlanAnswerBinding,
) {
  const answerIsBound = Boolean(
    answer.issueId.trim() &&
    answer.evidenceFingerprint.trim() &&
    answer.sourceFingerprint.trim(),
  );
  const currentIsBound = Boolean(
    current.issueId.trim() &&
    current.evidenceFingerprint.trim() &&
    current.sourceFingerprint.trim(),
  );

  return (
    !answerIsBound ||
    !currentIsBound ||
    answer.issueId !== current.issueId ||
    answer.evidenceFingerprint !== current.evidenceFingerprint ||
    answer.sourceFingerprint !== current.sourceFingerprint
  );
}

/**
 * Mirrors the existing review-closeout contract. A handled-elsewhere answer is
 * an audit note only and never clears the issue or a release gate.
 */
export function fixPlanAnswerCompletesReview(
  input: FixPlanAnswerCompletionInput,
) {
  if (input.severity === "critical" || input.stale || !input.status) return false;
  if (input.status === "handled-elsewhere") return false;
  if (input.status === "accepted") return true;
  if (input.status === "rfi") {
    return input.rfiStatus === "approved" || input.rfiStatus === "closed";
  }
  return input.status === "punch" && input.punchStatus === "resolved";
}
