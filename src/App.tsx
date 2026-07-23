import { ChangeEvent, DragEvent, useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import {
  AirVent,
  Box,
  ChevronDown,
  CircleDot,
  CloudUpload,
  DraftingCompass,
  Fan,
  FileText,
  FolderOpen,
  Grid3X3,
  MousePointer2,
  PanelLeftClose,
  ChevronLeft,
  ChevronRight,
  Hand,
  Redo2,
  Route,
  Save,
  Search,
  Settings,
  SlidersHorizontal,
  Undo2,
  Wind,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

const tools = [
  { label: "Select", icon: MousePointer2, active: true },
  { label: "Supply run", icon: Route, tone: "blue" },
  { label: "T / Y branch", icon: DraftingCompass, tone: "yellow" },
  { label: "Return", icon: Wind, tone: "red" },
  { label: "Fresh air", icon: AirVent, tone: "green" },
  { label: "Diffuser", icon: Grid3X3 },
  { label: "Equipment", icon: Box },
  { label: "Exhaust fan", icon: Fan },
];

const layers = [
  ["Supply duct", "blue"],
  ["Branches & fittings", "yellow"],
  ["Return air", "red"],
  ["Fresh air", "green"],
  ["Notes & dimensions", "orange"],
];

export function App() {
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [fileName, setFileName] = useState("Untitled HVAC Plan");
  const [pageNumber, setPageNumber] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function openPdf(file?: File) {
    if (!file) return;
    if (file.type !== "application/pdf") {
      setError("Please choose a PDF construction plan.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const document = await pdfjsLib.getDocument({ data: bytes }).promise;
      setPdf(document);
      setFileName(file.name.replace(/\.pdf$/i, ""));
      setPageNumber(1);
      setZoom(1);
    } catch {
      setError("This PDF could not be opened. Try another file.");
    } finally {
      setLoading(false);
    }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    void openPdf(event.target.files?.[0]);
    event.target.value = "";
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    void openPdf(event.dataTransfer.files?.[0]);
  }

  useEffect(() => {
    if (!pdf || !canvasRef.current) return;
    let cancelled = false;
    const render = async () => {
      const page = await pdf.getPage(pageNumber);
      if (cancelled || !canvasRef.current) return;
      const viewport = page.getViewport({ scale: zoom * 1.35 });
      const canvas = canvasRef.current;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * ratio);
      canvas.height = Math.floor(viewport.height * ratio);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      await page.render({ canvasContext: context, viewport }).promise;
    };
    void render();
    return () => { cancelled = true; };
  }, [pdf, pageNumber, zoom]);

  const zoomOut = () => setZoom((value) => Math.max(.35, +(value - .15).toFixed(2)));
  const zoomIn = () => setZoom((value) => Math.min(3, +(value + .15).toFixed(2)));

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><Wind size={23} strokeWidth={2.4} /></div>
          <div>
            <strong>HVAC Plan Studio</strong>
            <span>Professional Drafting Workspace</span>
          </div>
        </div>

        <div className="project-name">
          <FileText size={15} />
          <span>{fileName}</span>
          <ChevronDown size={14} />
        </div>

        <nav className="top-actions" aria-label="Project actions">
          <button aria-label="Undo"><Undo2 size={17} /></button>
          <button aria-label="Redo"><Redo2 size={17} /></button>
          <span className="divider" />
          <button className="save-button"><Save size={16} /> Save</button>
          <button className="primary-button">Export plan</button>
          <button aria-label="Settings"><Settings size={18} /></button>
        </nav>
      </header>

      <section className="workspace">
        <aside className="left-panel">
          <div className="panel-heading">
            <div><span>DESIGN TOOLS</span><small>FIELD STANDARD</small></div>
            <PanelLeftClose size={17} />
          </div>
          <div className="tool-list">
            {tools.map(({ label, icon: Icon, active, tone }) => (
              <button className={`tool ${active ? "active" : ""}`} key={label}>
                <span className={`tool-icon ${tone || ""}`}><Icon size={19} /></span>
                <span>{label}</span>
                {active && <kbd>V</kbd>}
              </button>
            ))}
          </div>

          <div className="panel-section">
            <div className="section-title"><span>DUCT PROPERTIES</span><SlidersHorizontal size={15} /></div>
            <label>Duct size
              <select defaultValue="14"><option>16</option><option>14</option><option>12</option><option>10</option><option>8</option><option>7</option><option>6</option><option>4</option></select>
            </label>
            <label>System zone
              <select><option>System 1 — Main Level</option><option>System 2 — Upper Level</option></select>
            </label>
          </div>
        </aside>

        <section className="canvas-area">
          <div className="canvas-toolbar">
            <button><MousePointer2 size={16} /> Select</button>
            <span className="divider" />
            <button aria-label="Pan drawing"><Hand size={16} /> Pan</button>
            <button aria-label="Zoom out" onClick={zoomOut} disabled={!pdf}><ZoomOut size={17} /></button>
            <strong>{Math.round(zoom * 100)}%</strong>
            <button aria-label="Zoom in" onClick={zoomIn} disabled={!pdf}><ZoomIn size={17} /></button>
            <button><Grid3X3 size={16} /> Grid</button>
            {pdf && <div className="page-controls">
              <button aria-label="Previous page" disabled={pageNumber === 1} onClick={() => setPageNumber((page) => page - 1)}><ChevronLeft size={16} /></button>
              <span>Page <strong>{pageNumber}</strong> of {pdf.numPages}</span>
              <button aria-label="Next page" disabled={pageNumber === pdf.numPages} onClick={() => setPageNumber((page) => page + 1)}><ChevronRight size={16} /></button>
            </div>}
            <div className="scale">Scale <strong>1/4" = 1'-0"</strong><ChevronDown size={13} /></div>
          </div>

          <div className={`canvas ${pdf ? "has-plan" : ""}`} onDragOver={(event) => event.preventDefault()} onDrop={onDrop}>
            <input ref={inputRef} className="file-input" type="file" accept="application/pdf,.pdf" onChange={onFileChange} />
            {pdf ? (
              <div className="pdf-stage"><canvas ref={canvasRef} aria-label={`PDF page ${pageNumber}`} /></div>
            ) : <div className="upload-card">
              <div className="upload-icon"><CloudUpload size={30} /></div>
              <h1>{loading ? "Opening your plan…" : "Start your HVAC plan"}</h1>
              <p>{error || "Upload a construction PDF to begin a field-ready layout."}</p>
              <button className="primary-button" disabled={loading} onClick={() => inputRef.current?.click()}><FolderOpen size={17} /> Choose PDF plan</button>
              <span>or drag and drop a file here</span>
              <div className="file-note"><CircleDot size={13} /> PDF up to 100 MB · Set drawing scale after upload</div>
            </div>}
          </div>
        </section>

        <aside className="right-panel">
          <div className="right-tabs"><button className="active">Layers</button><button>Plan data</button></div>
          <div className="search"><Search size={15} /><input aria-label="Search layers" placeholder="Search layers" /></div>
          <div className="layer-list">
            {layers.map(([label, tone]) => (
              <label className="layer" key={label}>
                <input type="checkbox" defaultChecked />
                <i className={tone} />
                <span>{label}</span>
                <small>0</small>
              </label>
            ))}
          </div>
          <div className="plan-summary">
            <div className="section-title"><span>PLAN SUMMARY</span></div>
            <dl>
              <div><dt>Systems</dt><dd>0</dd></div>
              <div><dt>Supply runs</dt><dd>0</dd></div>
              <div><dt>Returns</dt><dd>0</dd></div>
              <div><dt>Estimated CFM</dt><dd>—</dd></div>
            </dl>
          </div>
          <div className="status-card"><span className="pulse" /><div><strong>{pdf ? "Construction plan loaded" : "Drawing engine ready"}</strong><small>{pdf ? `${pdf.numPages} page PDF · Page ${pageNumber} active` : "Upload a plan to start drafting"}</small></div></div>
        </aside>
      </section>

      <footer>
        <span><i className="online" /> Ready</span>
        <span>0 objects selected</span>
        <span>Cursor: 0', 0'</span>
        <span className="footer-right">HVAC Plan Studio v0.1.0</span>
      </footer>
    </main>
  );
}
