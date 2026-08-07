"use client";

import { RotateCcw, Save, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  cloneDefaultAirflowSizingProfile,
  normalizeAirflowSizingProfile,
  type AirflowSizingProfile,
} from "./airflowSizingProfile";

type ProfileTab = "flexible" | "roundMetal" | "rectangular";

type Props = {
  open: boolean;
  profile: AirflowSizingProfile;
  onClose: () => void;
  onSave: (profile: AirflowSizingProfile) => void;
};

const tabs: Array<{ id: ProfileTab; label: string; detail: string }> = [
  { id: "flexible", label: "Flexible duct", detail: "Drives current flex-run suggestions" },
  { id: "roundMetal", label: "Round / spiral", detail: "Saved for future metal runs" },
  { id: "rectangular", label: "Rectangular", detail: "Saved for future trunk runs" },
];

export default function AirflowSizingProfileStudio({ open, profile, onClose, onSave }: Props) {
  const [draft, setDraft] = useState(() => normalizeAirflowSizingProfile(profile));
  const [tab, setTab] = useState<ProfileTab>("flexible");
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      setDraft(normalizeAirflowSizingProfile(profile));
      setTab("flexible");
      dialogRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, profile]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  const rectangularGroups = useMemo(() => {
    const groups = new Map<number, typeof draft.rectangular>();
    draft.rectangular.forEach((row) => {
      const group = groups.get(row.heightInches) || [];
      group.push(row);
      groups.set(row.heightInches, group);
    });
    return [...groups.entries()].sort(([left], [right]) => left - right);
  }, [draft]);

  if (!open) return null;

  const updateRoundCfm = (kind: "flexible" | "roundMetal", index: number, value: number) => {
    setDraft((current) => ({
      ...current,
      [kind]: current[kind].map((row, rowIndex) => rowIndex === index
        ? { ...row, cfm: Math.max(1, Math.round(value || 0)) }
        : row),
    }));
  };

  const updateRectangularCfm = (widthInches: number, heightInches: number, value: number) => {
    setDraft((current) => ({
      ...current,
      rectangular: current.rectangular.map((row) =>
        row.widthInches === widthInches && row.heightInches === heightInches
          ? { ...row, cfm: Math.max(1, Math.round(value || 0)) }
          : row),
    }));
  };

  return <div className="airflow-profile-overlay" role="presentation" onMouseDown={(event) => {
    if (event.target === event.currentTarget) onClose();
  }}>
    <section ref={dialogRef} tabIndex={-1} className="airflow-profile-studio" role="dialog" aria-modal="true" aria-labelledby="airflow-profile-title">
      <header>
        <div>
          <small>PROJECT SIZING DEFAULTS</small>
          <h2 id="airflow-profile-title">Airflow capacity chart</h2>
          <p>Editable planning values from your field chart. Final design still requires pressure review and test-and-balance.</p>
        </div>
        <button className="airflow-profile-close" type="button" onClick={onClose} aria-label="Close airflow capacity chart"><X size={18} /></button>
      </header>

      <div className="airflow-profile-rulebar">
        <label>
          <span>Chart name</span>
          <input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
        </label>
        <label>
          <span>Move up one size after</span>
          <div><input type="number" min="1" step="1" value={draft.longRunThresholdFeet} onChange={(event) => setDraft((current) => ({
            ...current,
            longRunThresholdFeet: Math.max(1, Number(event.target.value) || 1),
          }))} /><b>ft</b></div>
        </label>
      </div>

      <nav className="airflow-profile-tabs" role="tablist" aria-label="Airflow chart sections">
        {tabs.map((item) => <button key={item.id} id={`airflow-profile-tab-${item.id}`} role="tab" type="button" aria-selected={tab === item.id} aria-controls={`airflow-profile-panel-${item.id}`} onClick={() => setTab(item.id)}>
          <strong>{item.label}</strong><small>{item.detail}</small>
        </button>)}
      </nav>

      <div className="airflow-profile-table-wrap" id={`airflow-profile-panel-${tab}`} role="tabpanel" aria-labelledby={`airflow-profile-tab-${tab}`}>
        {tab === "flexible" && <>
          <div className="airflow-profile-table-heading"><span>Flexible duct</span><b>{draft.flexibleFrictionRate.toFixed(2)} in. w.g. / 100 ft reference</b></div>
          <table><thead><tr><th>Duct size</th><th>Design airflow</th></tr></thead><tbody>
            {draft.flexible.map((row, index) => <tr key={row.diameterInches}><th>{row.diameterInches}&quot;</th><td><input aria-label={`${row.diameterInches} inch flexible duct design airflow`} type="number" min="1" value={row.cfm} onChange={(event) => updateRoundCfm("flexible", index, Number(event.target.value))} /><span>CFM</span></td></tr>)}
          </tbody></table>
        </>}
        {tab === "roundMetal" && <>
          <div className="airflow-profile-table-heading"><span>Round metal / spiral pipe</span><b>{draft.roundMetalFrictionRate.toFixed(2)} in. w.g. / 100 ft reference</b></div>
          <table><thead><tr><th>Duct size</th><th>Design airflow</th></tr></thead><tbody>
            {draft.roundMetal.map((row, index) => <tr key={row.diameterInches}><th>{row.diameterInches}&quot;</th><td><input aria-label={`${row.diameterInches} inch round metal pipe design airflow`} type="number" min="1" value={row.cfm} onChange={(event) => updateRoundCfm("roundMetal", index, Number(event.target.value))} /><span>CFM</span></td></tr>)}
          </tbody></table>
        </>}
        {tab === "rectangular" && <>
          <div className="airflow-profile-table-heading"><span>Rectangular duct</span><b>{draft.rectangularFrictionRate.toFixed(2)} in. w.g. / 100 ft reference</b></div>
          {rectangularGroups.map(([height, rows]) => <div className="airflow-profile-rect-group" key={height}>
            <h3>{height}&quot; duct height</h3>
            <div>{rows.map((row) => <label key={`${row.widthInches}x${row.heightInches}`}>
              <span>{row.widthInches} x {row.heightInches}</span>
              <input aria-label={`${row.widthInches} by ${row.heightInches} rectangular duct design airflow`} type="number" min="1" value={row.cfm} onChange={(event) => updateRectangularCfm(row.widthInches, row.heightInches, Number(event.target.value))} />
              <b>CFM</b>
            </label>)}</div>
          </div>)}
        </>}
      </div>

      <aside className="airflow-profile-notice">
        <strong>Planning chart only.</strong>
        <span>Move up a size when the route exceeds the configured length. Excessive fittings, installed flex condition, static pressure, leakage, sound, and equipment data still require professional review.</span>
      </aside>

      <footer>
        <button type="button" className="airflow-profile-reset" onClick={() => setDraft(cloneDefaultAirflowSizingProfile())}><RotateCcw size={16} /> Reset uploaded chart</button>
        <div><button type="button" onClick={onClose}>Cancel</button><button type="button" className="airflow-profile-save" onClick={() => onSave(normalizeAirflowSizingProfile(draft))}><Save size={16} /> Save chart</button></div>
      </footer>
    </section>
  </div>;
}
