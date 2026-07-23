import { ChangeEvent, DragEvent, PointerEvent, useEffect, useRef, useState } from "react";
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
  Trash2,
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
  { id: "select", label: "Select", icon: MousePointer2 },
  { id: "supply", label: "Supply run", icon: Route, tone: "blue" },
  { id: "branch", label: "T / Y branch", icon: DraftingCompass, tone: "yellow" },
  { id: "return", label: "Return", icon: Wind, tone: "red" },
  { id: "fresh", label: "Fresh air", icon: AirVent, tone: "green" },
  { id: "diffuser", label: "Diffuser", icon: Grid3X3 },
  { id: "equipment", label: "Equipment", icon: Box },
  { id: "fan", label: "Exhaust fan", icon: Fan },
];

const layers = [
  ["Supply duct", "blue"],
  ["Branches & fittings", "yellow"],
  ["Return air", "red"],
  ["Fresh air", "green"],
  ["Notes & dimensions", "orange"],
];

type Point = { x: number; y: number };
type DrawType = "supply" | "branch" | "return" | "fresh";
type Drawing = {
  id: string;
  type: DrawType;
  points: Point[];
  size: string;
  page: number;
};
type DragState =
  | { kind: "point"; drawingId: string; pointIndex: number; before: Drawing[] }
  | { kind: "line"; drawingId: string; start: Point; original: Point[]; before: Drawing[] };

const drawingColors: Record<DrawType, string> = {
  supply: "#2b83ff",
  branch: "#f5c543",
  return: "#ef5350",
  fresh: "#45d18b",
};

export function App() {
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [fileName, setFileName] = useState("Untitled HVAC Plan");
  const [pageNumber, setPageNumber] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTool, setActiveTool] = useState("select");
  const [ductSize, setDuctSize] = useState("14");
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [undoStack, setUndoStack] = useState<Drawing[][]>([]);
  const [redoStack, setRedoStack] = useState<Drawing[][]>([]);
  const [draft, setDraft] = useState<Point[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [renderSize, setRenderSize] = useState({ width: 0, height: 0 });
  const [hoverPoint, setHoverPoint] = useState<Point | null>(null);
  const [snapMarker, setSnapMarker] = useState<Point | null>(null);
  const dragRef = useRef<DragState | null>(null);

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
      const viewport = page.getViewport({ scale: 1.35 });
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
      if (!cancelled) setRenderSize({ width: viewport.width, height: viewport.height });
    };
    void render();
    return () => { cancelled = true; };
  }, [pdf, pageNumber]);

  const zoomOut = () => setZoom((value) => Math.max(.35, +(value - .15).toFixed(2)));
  const zoomIn = () => setZoom((value) => Math.min(3, +(value + .15).toFixed(2)));

  function setHistory(next: Drawing[]) {
    setDrawings((current) => {
      setUndoStack((stack) => [...stack, current]);
      setRedoStack([]);
      return next;
    });
  }

  function nearestSegment(point: Point, ignoredId?: string) {
    let best: { point: Point; drawingId: string; segmentIndex: number; distance: number } | null = null;
    for (const drawing of drawings) {
      if (drawing.page !== pageNumber || drawing.id === ignoredId) continue;
      for (let index = 0; index < drawing.points.length - 1; index++) {
        const a = drawing.points[index];
        const b = drawing.points[index + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const lengthSquared = dx * dx + dy * dy;
        const amount = lengthSquared ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared)) : 0;
        const projected = { x: a.x + amount * dx, y: a.y + amount * dy };
        const distance = Math.hypot(point.x - projected.x, point.y - projected.y);
        if (!best || distance < best.distance) best = { point: projected, drawingId: drawing.id, segmentIndex: index, distance };
      }
    }
    return best;
  }

  function snapPoint(point: Point, ignoredId?: string) {
    const nearest = nearestSegment(point, ignoredId);
    return nearest && nearest.distance <= 14 / zoom ? nearest.point : point;
  }

  function addJunctionPoints(current: Drawing[], endpoints: Point[]) {
    let next = current;
    for (const endpoint of endpoints) {
      let match: { drawingId: string; segmentIndex: number; point: Point } | null = null;
      for (const drawing of next) {
        if (drawing.page !== pageNumber) continue;
        for (let index = 0; index < drawing.points.length - 1; index++) {
          const a = drawing.points[index];
          const b = drawing.points[index + 1];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const lengthSquared = dx * dx + dy * dy;
          const amount = lengthSquared ? Math.max(0, Math.min(1, ((endpoint.x - a.x) * dx + (endpoint.y - a.y) * dy) / lengthSquared)) : 0;
          const projected = { x: a.x + amount * dx, y: a.y + amount * dy };
          if (Math.hypot(endpoint.x - projected.x, endpoint.y - projected.y) < .75) {
            match = { drawingId: drawing.id, segmentIndex: index, point: projected };
            break;
          }
        }
        if (match) break;
      }
      if (!match) continue;
      next = next.map((drawing) => {
        if (drawing.id !== match!.drawingId) return drawing;
        if (drawing.points.some((point) => Math.hypot(point.x - match!.point.x, point.y - match!.point.y) < .75)) return drawing;
        const points = [...drawing.points];
        points.splice(match!.segmentIndex + 1, 0, match!.point);
        return { ...drawing, points };
      });
    }
    return next;
  }

  function finishDrawing() {
    if (draft.length > 1 && ["supply", "branch", "return", "fresh"].includes(activeTool)) {
      const drawing: Drawing = {
        id: crypto.randomUUID(),
        type: activeTool as DrawType,
        points: draft,
        size: ductSize,
        page: pageNumber,
      };
      const connected = addJunctionPoints(drawings, [draft[0], draft[draft.length - 1]]);
      setHistory([...connected, drawing]);
    }
    setDraft([]);
    setHoverPoint(null);
    setSnapMarker(null);
  }

  function canvasPoint(event: PointerEvent<SVGSVGElement>): Point {
    const target = event.currentTarget as unknown as SVGSVGElement | SVGGraphicsElement;
    const svg = target instanceof SVGSVGElement ? target : target.ownerSVGElement;
    const bounds = (svg || target).getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * renderSize.width,
      y: ((event.clientY - bounds.top) / bounds.height) * renderSize.height,
    };
  }

  function handleDrawingClick(event: PointerEvent<SVGSVGElement>) {
    if (activeTool === "select") {
      setSelectedId(null);
      return;
    }
    if (!["supply", "branch", "return", "fresh"].includes(activeTool)) return;
    const point = snapPoint(canvasPoint(event));
    setDraft((points) => [...points, point]);
  }

  function undo() {
    if (draft.length) {
      setDraft((points) => points.slice(0, -1));
      return;
    }
    const previous = undoStack.at(-1);
    if (!previous) return;
    setRedoStack((redo) => [...redo, drawings]);
    setDrawings(previous);
    setUndoStack((stack) => stack.slice(0, -1));
    setSelectedId(null);
  }

  function redo() {
    const next = redoStack.at(-1);
    if (!next) return;
    setUndoStack((stack) => [...stack, drawings]);
    setDrawings(next);
    setRedoStack((stack) => stack.slice(0, -1));
  }

  function deleteSelected() {
    if (!selectedId) return;
    setHistory(drawings.filter((drawing) => drawing.id !== selectedId));
    setSelectedId(null);
  }

  function startPointDrag(event: PointerEvent<SVGCircleElement>, drawingId: string, pointIndex: number) {
    if (activeTool !== "select") return;
    event.stopPropagation();
    event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId);
    dragRef.current = { kind: "point", drawingId, pointIndex, before: drawings };
    setSelectedId(drawingId);
  }

  function startLineDrag(event: PointerEvent<SVGPathElement>, drawing: Drawing) {
    if (activeTool !== "select") return;
    event.stopPropagation();
    event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId);
    dragRef.current = { kind: "line", drawingId: drawing.id, start: canvasPoint(event as unknown as PointerEvent<SVGSVGElement>), original: drawing.points, before: drawings };
    setSelectedId(drawing.id);
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    const raw = canvasPoint(event);
    const drag = dragRef.current;
    if (drag) {
      if (drag.kind === "point") {
        const point = snapPoint(raw, drag.drawingId);
        setSnapMarker(point.x !== raw.x || point.y !== raw.y ? point : null);
        setDrawings((current) => current.map((drawing) => drawing.id === drag.drawingId
          ? { ...drawing, points: drawing.points.map((oldPoint, index) => index === drag.pointIndex ? point : oldPoint) }
          : drawing));
      } else {
        const dx = raw.x - drag.start.x;
        const dy = raw.y - drag.start.y;
        setDrawings((current) => current.map((drawing) => drawing.id === drag.drawingId
          ? { ...drawing, points: drag.original.map((point) => ({ x: point.x + dx, y: point.y + dy })) }
          : drawing));
      }
      return;
    }
    if (["supply", "branch", "return", "fresh"].includes(activeTool)) {
      const point = snapPoint(raw);
      setHoverPoint(point);
      setSnapMarker(point.x !== raw.x || point.y !== raw.y ? point : null);
    }
  }

  function endDrag() {
    const drag = dragRef.current;
    if (!drag) return;
    setUndoStack((stack) => [...stack, drag.before]);
    setRedoStack([]);
    dragRef.current = null;
    setSnapMarker(null);
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDraft([]);
      if (event.key === "Delete" || event.key === "Backspace") deleteSelected();
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        event.shiftKey ? redo() : undo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

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
          <button aria-label="Undo" onClick={undo}><Undo2 size={17} /></button>
          <button aria-label="Redo" onClick={redo}><Redo2 size={17} /></button>
          <button aria-label="Delete selected object" disabled={!selectedId} onClick={deleteSelected}><Trash2 size={17} /></button>
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
            {tools.map(({ id, label, icon: Icon, tone }) => (
              <button className={`tool ${activeTool === id ? "active" : ""}`} key={label} onClick={() => { finishDrawing(); setActiveTool(id); setSelectedId(null); }}>
                <span className={`tool-icon ${tone || ""}`}><Icon size={19} /></span>
                <span>{label}</span>
                {activeTool === id && <kbd>{id === "select" ? "V" : "●"}</kbd>}
              </button>
            ))}
          </div>

          <div className="panel-section">
            <div className="section-title"><span>DUCT PROPERTIES</span><SlidersHorizontal size={15} /></div>
            <label>Duct size
              <select value={ductSize} onChange={(event) => setDuctSize(event.target.value)}><option>16</option><option>14</option><option>12</option><option>10</option><option>8</option><option>7</option><option>6</option><option>4</option></select>
            </label>
            <label>System zone
              <select><option>System 1 — Main Level</option><option>System 2 — Upper Level</option></select>
            </label>
          </div>
        </aside>

        <section className="canvas-area">
          <div className="canvas-toolbar">
            <button onClick={() => setActiveTool("select")}><MousePointer2 size={16} /> {activeTool === "select" ? "Select" : tools.find((tool) => tool.id === activeTool)?.label}</button>
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
              <div className="pdf-stage">
                <div className="plan-sheet" style={{ width: renderSize.width * zoom, height: renderSize.height * zoom }}>
                  <canvas ref={canvasRef} aria-label={`PDF page ${pageNumber}`} />
                  <svg
                    className={`drawing-layer tool-${activeTool}`}
                    viewBox={`0 0 ${renderSize.width || 1} ${renderSize.height || 1}`}
                    onPointerDown={handleDrawingClick}
                    onPointerMove={handlePointerMove}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    onPointerLeave={() => { if (!dragRef.current) { setHoverPoint(null); setSnapMarker(null); } }}
                    onContextMenu={(event) => { event.preventDefault(); finishDrawing(); }}
                  >
                    {drawings.filter((drawing) => drawing.page === pageNumber).map((drawing) => {
                      const path = drawing.points.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ");
                      const middle = drawing.points[Math.floor(drawing.points.length / 2)];
                      return <g key={drawing.id} className={selectedId === drawing.id ? "selected-drawing" : ""} onPointerDown={(event) => {
                        if (activeTool !== "select") return;
                        event.stopPropagation();
                        setSelectedId(drawing.id);
                      }}>
                        <path className="hit-line" d={path} onPointerDown={(event) => startLineDrag(event, drawing)} />
                        <path className="duct-line" d={path} stroke={drawingColors[drawing.type]} />
                        {drawing.points.map((point, index) => <circle
                          className={selectedId === drawing.id ? "edit-handle" : ""}
                          key={index}
                          cx={point.x}
                          cy={point.y}
                          r={selectedId === drawing.id ? 6 : 3.5}
                          fill={drawingColors[drawing.type]}
                          onPointerDown={(event) => startPointDrag(event, drawing.id, index)}
                        />)}
                        <text x={middle.x + 8} y={middle.y - 8}>{drawing.size}"</text>
                      </g>;
                    })}
                    {draft.length > 0 && <g className="draft-drawing">
                      <polyline points={[...draft, ...(hoverPoint ? [hoverPoint] : [])].map((point) => `${point.x},${point.y}`).join(" ")} stroke={drawingColors[activeTool as DrawType]} />
                      {draft.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r="4" fill={drawingColors[activeTool as DrawType]} />)}
                    </g>}
                    {snapMarker && <g className="snap-marker"><circle cx={snapMarker.x} cy={snapMarker.y} r="9" /><path d={`M ${snapMarker.x - 5} ${snapMarker.y} L ${snapMarker.x + 5} ${snapMarker.y} M ${snapMarker.x} ${snapMarker.y - 5} L ${snapMarker.x} ${snapMarker.y + 5}`} /></g>}
                  </svg>
                </div>
              </div>
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
                <small>{drawings.filter((drawing) => drawing.type === ({ blue: "supply", yellow: "branch", red: "return", green: "fresh" } as Record<string, string>)[tone]).length}</small>
              </label>
            ))}
          </div>
          <div className="plan-summary">
            <div className="section-title"><span>PLAN SUMMARY</span></div>
            <dl>
              <div><dt>Systems</dt><dd>0</dd></div>
              <div><dt>Supply runs</dt><dd>{drawings.filter((drawing) => drawing.type === "supply").length}</dd></div>
              <div><dt>Returns</dt><dd>{drawings.filter((drawing) => drawing.type === "return").length}</dd></div>
              <div><dt>Estimated CFM</dt><dd>—</dd></div>
            </dl>
          </div>
          <div className="status-card"><span className="pulse" /><div><strong>{draft.length ? "Drawing in progress" : pdf ? "Construction plan loaded" : "Drawing engine ready"}</strong><small>{draft.length ? "Left-click: add point · Right-click: finish · Esc: cancel" : pdf ? `${pdf.numPages} page PDF · ${drawings.length} drawing objects` : "Upload a plan to start drafting"}</small></div></div>
        </aside>
      </section>

      <footer>
        <span><i className="online" /> Ready</span>
        <span>{selectedId ? "1 object selected" : "0 objects selected"}</span>
        <span>Cursor: 0', 0'</span>
        <span className="footer-right">HVAC Plan Studio v0.1.0</span>
      </footer>
    </main>
  );
}
