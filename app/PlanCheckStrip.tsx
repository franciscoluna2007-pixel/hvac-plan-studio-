"use client";

import { CheckCircle2, Crosshair, ShieldCheck } from "lucide-react";

type PlanCheckStripProps = {
  count: number;
  ignored: boolean;
  canShowOnPlan: boolean;
  onReview: () => void;
  onShowOnPlan: () => void;
  onIgnore: () => void;
  onRestore: () => void;
};

export default function PlanCheckStrip({
  count,
  ignored,
  canShowOnPlan,
  onReview,
  onShowOnPlan,
  onIgnore,
  onRestore,
}: PlanCheckStripProps) {
  const itemLabel = `${count} item${count === 1 ? "" : "s"} to review`;

  if (ignored) {
    return (
      <section className="plan-check-strip ignored" aria-label="Plan Check" aria-live="polite">
        <span><ShieldCheck size={16} aria-hidden="true" /><strong>Plan Check</strong><small>{itemLabel}</small></span>
        <button type="button" onClick={onRestore}>Show</button>
      </section>
    );
  }

  return (
    <section className={`plan-check-strip ${count ? "attention" : "clear"}`} aria-label="Plan Check" aria-live="polite">
      <span>
        {count ? <ShieldCheck size={17} aria-hidden="true" /> : <CheckCircle2 size={17} aria-hidden="true" />}
        <strong>Plan Check</strong>
        <small>{count ? itemLabel : "No items to review"}</small>
      </span>
      <div>
        <button type="button" onClick={onReview}>{count ? "Review" : "Open"}</button>
        <button type="button" disabled={!canShowOnPlan} onClick={onShowOnPlan}>
          <Crosshair size={14} aria-hidden="true" /> Show on plan
        </button>
        <button type="button" onClick={onIgnore}>Ignore for now</button>
      </div>
    </section>
  );
}
