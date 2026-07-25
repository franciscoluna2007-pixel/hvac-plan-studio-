"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BrainCircuit,
  FileSearch,
  Gauge,
  LoaderCircle,
  RefreshCw,
  Sparkles,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { loadOwnerAnalytics, type OwnerAnalyticsSummary } from "./productAnalytics";

type Props = {
  open: boolean;
  onClose: () => void;
};

function percent(value: number) {
  return `${Math.round(value * 10) / 10}%`;
}

export default function OwnerAnalytics({ open, onClose }: Props) {
  const panelRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [windowDays, setWindowDays] = useState(30);
  const [summary, setSummary] = useState<OwnerAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function refresh(days = windowDays) {
    setLoading(true);
    setError("");
    try {
      setSummary(await loadOwnerAnalytics(days));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Owner analytics could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() => {
      panelRef.current?.focus();
      void refresh(windowDays);
    });
    return () => {
      cancelAnimationFrame(frame);
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
    };
    // Refresh only when the protected dashboard opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab" || !panelRef.current) return;
    const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(
      'button:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])',
    ));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return <div className="owner-analytics-overlay" role="dialog" aria-modal="true" aria-labelledby="owner-analytics-title">
    <button className="owner-analytics-dismiss" aria-label="Close Owner Analytics" onClick={onClose} />
    <section ref={panelRef} tabIndex={-1} className="owner-analytics-panel" onKeyDown={handleKeyDown}>
      <header>
        <div>
          <span><BarChart3 size={20} /></span>
          <div><small>PRIVATE OWNER VIEW</small><h2 id="owner-analytics-title">Product Analytics</h2></div>
        </div>
        <div className="owner-analytics-actions">
          <select
            aria-label="Analytics reporting window"
            value={windowDays}
            onChange={(event) => {
              const days = Number(event.target.value);
              setWindowDays(days);
              void refresh(days);
            }}
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button aria-label="Refresh analytics" onClick={() => void refresh()} disabled={loading}><RefreshCw className={loading ? "spin" : ""} size={16} /></button>
          <button aria-label="Close Owner Analytics" onClick={onClose}><X size={18} /></button>
        </div>
      </header>

      {loading && !summary ? <div className="owner-analytics-loading"><LoaderCircle className="spin" size={24} /><strong>Loading private product metrics…</strong></div> : error ? <div className="owner-analytics-error"><AlertTriangle size={20} /><div><strong>Analytics unavailable</strong><span>{error}</span></div></div> : summary && <>
        <div className="owner-analytics-hero">
          <div><small>UNIQUE WORKSPACE VISITORS</small><strong>{summary.audience.uniqueVisitors}</strong><span>{summary.audience.visits} total workspace visits</span></div>
          <div><small>REGISTERED ACCOUNTS</small><strong>{summary.audience.registeredAccounts}</strong><span>{summary.audience.newAccounts} new · {percent(summary.audience.signupConversionPercent)} conversion</span></div>
          <div><small>AI ANALYSES</small><strong>{summary.activation.aiAnalyses}</strong><span>{summary.engagement.aiPagesRead} plan pages read</span></div>
          <div><small>EARLY ACCESS</small><strong>{summary.growth.earlyAccessRequests}</strong><span>{summary.growth.upgradeViews} Professional views</span></div>
        </div>

        <div className="owner-analytics-grid">
          <article>
            <header><Users size={17} /><div><small>AUDIENCE</small><strong>Reach and return</strong></div></header>
            <dl>
              <div><dt>Returning visitors</dt><dd>{summary.audience.returningVisitors}</dd></div>
              <div><dt>Daily active</dt><dd>{summary.engagement.dailyActive}</dd></div>
              <div><dt>Weekly active</dt><dd>{summary.engagement.weeklyActive}</dd></div>
              <div><dt>Monthly active</dt><dd>{summary.engagement.monthlyActive}</dd></div>
            </dl>
          </article>
          <article>
            <header><FileSearch size={17} /><div><small>ACTIVATION</small><strong>First value delivered</strong></div></header>
            <dl>
              <div><dt>PDFs opened</dt><dd>{summary.activation.pdfsOpened}</dd></div>
              <div><dt>AI analyses</dt><dd>{summary.activation.aiAnalyses}</dd></div>
              <div><dt>Finding decisions</dt><dd>{summary.activation.findingsDecided}</dd></div>
              <div><dt>Takeoffs exported</dt><dd>{summary.activation.takeoffsExported}</dd></div>
            </dl>
          </article>
          <article>
            <header><Sparkles size={17} /><div><small>SUBSCRIPTION READINESS</small><strong>Demand for paid value</strong></div></header>
            <dl>
              <div><dt>Free accounts</dt><dd>{summary.growth.freeAccounts}</dd></div>
              <div><dt>Professional</dt><dd>{summary.growth.professionalAccounts}</dd></div>
              <div><dt>Team</dt><dd>{summary.growth.teamAccounts}</dd></div>
              <div><dt>Early-access requests</dt><dd>{summary.growth.earlyAccessRequests}</dd></div>
            </dl>
          </article>
          <article>
            <header><Gauge size={17} /><div><small>RELIABILITY</small><strong>Reader health</strong></div></header>
            <dl>
              <div><dt>Analysis success</dt><dd>{percent(summary.reliability.analysisSuccessPercent)}</dd></div>
              <div><dt>Completed reads</dt><dd>{summary.reliability.completedAnalyses}</dd></div>
              <div><dt>Failed reads</dt><dd>{summary.reliability.failedAnalyses}</dd></div>
              <div><dt>Application errors</dt><dd>{summary.reliability.applicationErrors}</dd></div>
            </dl>
          </article>
        </div>

        <section className="owner-event-list">
          <header><Activity size={17} /><div><small>PRODUCT BEHAVIOR</small><strong>Most-used actions</strong></div></header>
          {summary.topEvents.length ? summary.topEvents.map((row) => <div key={row.event}>
            <span>{row.event.replaceAll("_", " ")}</span><strong>{row.count}</strong>
          </div>) : <div className="owner-event-empty"><BrainCircuit size={18} /><span>Usage events will appear here as people test the product.</span></div>}
        </section>

        <footer>
          <span><UserPlus size={15} /> Product events are restricted to approved actions and numeric usage—not plan text, filenames, addresses, or customer names.</span>
          <small>Updated {new Date(summary.generatedAt).toLocaleString()}</small>
        </footer>
      </>}
    </section>
  </div>;
}
