"use client";

import { ChangeEvent, DragEvent, PointerEvent, useCallback, useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { isDriveConfigured, pickPdfFromDrive } from "./googleDrive";
import {
  AirVent,
  AlertTriangle,
  ArrowRight,
  Box,
  ChevronDown,
  CircleDot,
  CloudUpload,
  Copy,
  DraftingCompass,
  Fan,
  FileText,
  FolderOpen,
  HardDrive,
  Grid3X3,
  Gauge,
  MousePointer2,
  PanelLeftClose,
  ChevronLeft,
  ChevronRight,
  Hand,
  Redo2,
  Route,
  Ruler,
  Save,
  Search,
  Settings,
  ShieldAlert,
  Sparkles,
  StickyNote,
  SlidersHorizontal,
  Trash2,
  Undo2,
  Wind,
  Thermometer,
  ToggleLeft,
  CheckCircle2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

const tools = [
  { id: "select", label: "Select", icon: MousePointer2 },
  { id: "supply", label: "Supply run", icon: Route, tone: "blue" },
  { id: "branch", label: "T / Y branch", icon: DraftingCompass, tone: "yellow" },
  { id: "return", label: "Return duct", icon: Wind, tone: "red" },
  { id: "fresh", label: "Fresh air", icon: AirVent, tone: "green" },
  { id: "diffuser", label: "Diffuser", icon: Grid3X3 },
  { id: "returnGrille", label: "Return grille", icon: AirVent, tone: "red" },
  { id: "equipment", label: "Equipment", icon: Box },
  { id: "fan", label: "Exhaust fan", icon: Fan },
  { id: "damper", label: "Balance damper", icon: Gauge, tone: "yellow" },
  { id: "motorDamper", label: "Motorized OA damper", icon: ToggleLeft, tone: "green" },
  { id: "reducer", label: "Reducer / transition", icon: DraftingCompass, tone: "yellow" },
  { id: "thermostat", label: "Thermostat", icon: Thermometer, tone: "orange" },
  { id: "smoke", label: "Duct smoke detector", icon: ShieldAlert, tone: "orange" },
  { id: "airflow", label: "Airflow arrow", icon: ArrowRight, tone: "orange" },
  { id: "note", label: "Field note", icon: StickyNote, tone: "orange" },
  { id: "measure", label: "Measure", icon: Ruler, tone: "orange" },
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
type SymbolKind = "diffuser" | "returnGrille" | "equipment" | "fan" | "damper" | "motorDamper" | "reducer" | "thermostat" | "smoke" | "airflow" | "note";
const symbolTools: SymbolKind[] = ["diffuser", "returnGrille", "equipment", "fan", "damper", "motorDamper", "reducer", "thermostat", "smoke", "airflow", "note"];
type SymbolMeta = {
  kind: SymbolKind;
  label: string;
  rotation: number;
};
type MeasurementMeta = {
  feet: number;
};
type FittingMeta = {
  kind: "ty";
  angle: number;
  side: 1 | -1;
  upstreamSize: string;
  downstreamSize: string;
  branchSize: string;
  connectedIds: string[];
};
type Drawing = {
  id: string;
  type: DrawType | "symbol" | "measurement";
  points: Point[];
  size: string;
  page: number;
  fitting?: FittingMeta;
  symbol?: SymbolMeta;
  measurement?: MeasurementMeta;
  cfm?: number;
  systemId?: string;
  roomName?: string;
  roomType?: "general" | "bedroom" | "bathroom" | "closet";
};
type DragState =
  | { kind: "point"; drawingId: string; pointIndex: number; before: Drawing[] }
  | { kind: "line"; drawingId: string; start: Point; original: Point[]; before: Drawing[] }
  | { kind: "fitting"; drawingId: string; start: Point; originalCenter: Point; connectedIds: string[]; before: Drawing[] }
  | { kind: "symbol"; drawingId: string; before: Drawing[] };

type BranchPreview = {
  center: Point;
  angle: number;
  side: 1 | -1;
  parentSize: string;
  valid: boolean;
};

type SavedProject = {
  version: 1 | 2;
  fileName: string;
  drawings: Drawing[];
  savedAt: string;
  scaleFeetPerUnit?: number;
  scaleLabel?: string;
  systemNames?: Record<string, string>;
};

const STORAGE_PREFIX = "hvac-plan-studio:";
const systems = Array.from({ length: 16 }, (_, index) => ({ id: `system-${index + 1}`, label: `System ${index + 1}` }));
const defaultSystemNames = Object.fromEntries(systems.map((system) => [system.id, system.label]));

const drawingColors: Record<DrawType, string> = {
  supply: "#2b83ff",
  branch: "#f5c543",
  return: "#ef5350",
  fresh: "#45d18b",
};

export default function Home() {
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
  const [branchPreview, setBranchPreview] = useState<BranchPreview | null>(null);
  const [symbolPreview, setSymbolPreview] = useState<{ kind: SymbolKind; point: Point } | null>(null);
  const [branchMessage, setBranchMessage] = useState("");
  const [scaleFeetPerUnit, setScaleFeetPerUnit] = useState(1 / 24.3);
  const [scaleLabel, setScaleLabel] = useState('1/4" = 1\'-0"');
  const [scaleLocked, setScaleLocked] = useState(true);
  const [calibrating, setCalibrating] = useState(false);
  const [referenceFeet, setReferenceFeet] = useState("10");
  const [measureDraft, setMeasureDraft] = useState<Point[]>([]);
  const [rightTab, setRightTab] = useState<"layers" | "rooms" | "takeoff" | "checks">("layers");
  const [saveState, setSaveState] = useState<"saved" | "saving">("saved");
  const [showSizingReview, setShowSizingReview] = useState(false);
  const [activeSystem, setActiveSystem] = useState("system-1");
  const [systemNames, setSystemNames] = useState<Record<string, string>>(defaultSystemNames);
  const dragRef = useRef<DragState | null>(null);
  const clipboardRef = useRef<Drawing | null>(null);

  function drawingSystem(drawing?: Drawing) {
    return drawing?.systemId || "system-1";
  }

  function systemLabel(systemId: string) {
    return systemNames[systemId] || systems.find((system) => system.id === systemId)?.label || systemId;
  }

  function restoreProject(name: string) {
    try {
      const stored = localStorage.getItem(`${STORAGE_PREFIX}${name.toLowerCase()}`);
      if (!stored) {
        setDrawings([]);
        setUndoStack([]);
        setRedoStack([]);
        return;
      }
      const project = JSON.parse(stored) as SavedProject;
      setDrawings(Array.isArray(project.drawings) ? project.drawings : []);
      setScaleFeetPerUnit(project.scaleFeetPerUnit || 1 / 24.3);
      setScaleLabel(project.scaleLabel || '1/4" = 1\'-0"');
      setSystemNames({ ...defaultSystemNames, ...(project.systemNames || {}) });
      setUndoStack([]);
      setRedoStack([]);
    } catch {
      setDrawings([]);
      setUndoStack([]);
      setRedoStack([]);
    }
  }

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
      const projectName = file.name.replace(/\.pdf$/i, "");
      setPdf(document);
      setFileName(projectName);
      setPageNumber(1);
      setZoom(1);
      restoreProject(projectName);
    } catch {
      setError("This PDF could not be opened. Try another file.");
    } finally {
      setLoading(false);
    }
  }

  async function openPdfBytes(name: string, bytes: Uint8Array) {
    setLoading(true);
    setError("");
    try {
      const document = await pdfjsLib.getDocument({ data: bytes }).promise;
      const projectName = name.replace(/\.pdf$/i, "");
      setPdf(document);
      setFileName(projectName);
      setPageNumber(1);
      setZoom(1);
      restoreProject(projectName);
    } catch {
      setError("This Drive PDF could not be opened.");
    } finally {
      setLoading(false);
    }
  }

  async function openFromDrive() {
    try {
      const selected = await pickPdfFromDrive();
      await openPdfBytes(selected.name, selected.bytes);
    } catch (driveError) {
      setError(driveError instanceof Error ? driveError.message : "Google Drive could not be opened.");
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

  const saveProject = useCallback(() => {
    if (!pdf) return;
    const project: SavedProject = {
      version: 1,
      fileName,
      drawings,
      savedAt: new Date().toISOString(),
      scaleFeetPerUnit,
      scaleLabel,
      systemNames,
    };
    localStorage.setItem(`${STORAGE_PREFIX}${fileName.toLowerCase()}`, JSON.stringify(project));
    setSaveState("saved");
  }, [drawings, fileName, pdf, scaleFeetPerUnit, scaleLabel, systemNames]);

  useEffect(() => {
    if (!pdf) return;
    setSaveState("saving");
    const timer = window.setTimeout(saveProject, 650);
    return () => window.clearTimeout(timer);
  }, [drawings, fileName, pdf, saveProject]);

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
      if (drawing.page !== pageNumber || drawing.id === ignoredId || drawing.fitting) continue;
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

  function nearestSupplySegment(point: Point) {
    let best: { point: Point; drawing: Drawing; segmentIndex: number; distance: number; angle: number; side: 1 | -1 } | null = null;
    for (const drawing of drawings) {
      if (drawing.page !== pageNumber || drawing.type !== "supply" || drawing.fitting || drawingSystem(drawing) !== activeSystem) continue;
      for (let index = 0; index < drawing.points.length - 1; index++) {
        const a = drawing.points[index];
        const b = drawing.points[index + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const lengthSquared = dx * dx + dy * dy;
        if (!lengthSquared) continue;
        const amount = Math.max(.08, Math.min(.92, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared));
        const projected = { x: a.x + amount * dx, y: a.y + amount * dy };
        const distance = Math.hypot(point.x - projected.x, point.y - projected.y);
        const cross = dx * (point.y - projected.y) - dy * (point.x - projected.x);
        const side: 1 | -1 = cross >= 0 ? 1 : -1;
        if (!best || distance < best.distance) {
          best = { point: projected, drawing, segmentIndex: index, distance, angle: Math.atan2(dy, dx), side };
        }
      }
    }
    return best;
  }

  function steppedSize(parent: string, steps: number) {
    const sizes = ["16", "14", "12", "10", "8", "7", "6", "4"];
    const index = Math.max(0, sizes.indexOf(parent));
    return sizes[Math.min(sizes.length - 1, index + steps)];
  }

  function cleanPoints(points: Point[]) {
    return points.filter((point, index) => index === 0 || Math.hypot(point.x - points[index - 1].x, point.y - points[index - 1].y) > .5);
  }

  function drawingLengthFeet(drawing: Drawing) {
    if (drawing.fitting || drawing.symbol) return 0;
    const units = drawing.points.slice(1).reduce((total, point, index) => {
      const previous = drawing.points[index];
      return total + Math.hypot(point.x - previous.x, point.y - previous.y);
    }, 0);
    return units * scaleFeetPerUnit;
  }

  function defaultCfm(size: string) {
    const values: Record<string, number> = {
      "4": 40,
      "6": 75,
      "7": 110,
      "8": 160,
      "10": 280,
      "12": 450,
      "14": 700,
      "16": 1000,
    };
    return values[size] || 0;
  }

  function velocityFpm(size: string, cfm = 0) {
    const diameterFeet = Number(size) / 12;
    const area = Math.PI * diameterFeet * diameterFeet / 4;
    return area > 0 ? Math.round(cfm / area) : 0;
  }

  function flexFrictionRate(size: string, cfm = 0) {
    const diameter = Number(size);
    if (!diameter || !cfm) return 0;
    // Round-duct equal-friction estimate with a 1.5× installed-flex allowance.
    return 0.109136 * Math.pow(cfm, 1.9) / Math.pow(diameter, 5.02) * 1.5;
  }

  function runPressure(drawing: Drawing) {
    const bends = Math.max(0, drawing.points.length - 2);
    const equivalentLength = drawingLengthFeet(drawing) + bends * 8;
    const frictionRate = flexFrictionRate(drawing.size, runAirflow(drawing));
    return {
      bends,
      equivalentLength,
      frictionRate,
      pressureDrop: frictionRate * equivalentLength / 100,
    };
  }

  function pressureSummary() {
    const runs = drawings
      .filter((drawing) => ["supply", "return", "fresh"].includes(drawing.type) && !drawing.fitting && drawingSystem(drawing) === activeSystem)
      .map((drawing) => ({ drawing, ...runPressure(drawing) }))
      .sort((a, b) => b.pressureDrop - a.pressureDrop);
    const highest = runs[0];
    return {
      runs,
      highestDrop: highest?.pressureDrop || 0,
      highestRun: highest?.drawing,
      averageFriction: runs.length ? runs.reduce((total, run) => total + run.frictionRate, 0) / runs.length : 0,
    };
  }

  function pointToDrawingDistance(point: Point, drawing: Drawing) {
    let minimum = Infinity;
    for (let index = 0; index < drawing.points.length - 1; index += 1) {
      const a = drawing.points[index];
      const b = drawing.points[index + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const lengthSquared = dx * dx + dy * dy;
      const amount = lengthSquared ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared)) : 0;
      minimum = Math.min(minimum, Math.hypot(point.x - (a.x + amount * dx), point.y - (a.y + amount * dy)));
    }
    return minimum;
  }

  function airflowNetwork() {
    const runs = drawings.filter((drawing) => ["supply", "return", "fresh"].includes(drawing.type) && !drawing.fitting);
    const direct = new Map<string, number>();
    const terminalRun = new Map<string, string>();
    const equipmentRun = new Map<string, string>();
    const children = new Map<string, string[]>();
    for (const fitting of drawings.filter((drawing) => drawing.fitting)) {
      const [upstreamId, downstreamId, branchId] = fitting.fitting!.connectedIds;
      children.set(upstreamId, [downstreamId, branchId]);
    }
    for (const symbol of drawings.filter((drawing) => drawing.symbol)) {
      const desiredType = symbol.symbol?.kind === "diffuser" ? ["supply"] : symbol.symbol?.kind === "returnGrille" ? ["return"] : [];
      if (symbol.symbol?.kind === "equipment") {
        const nearest = runs
          .filter((run) => run.type === "supply" && drawingSystem(run) === drawingSystem(symbol))
          .map((run) => ({ run, distance: pointToDrawingDistance(symbol.points[0], run) }))
          .sort((a, b) => a.distance - b.distance)[0];
        if (nearest && nearest.distance <= 24) equipmentRun.set(symbol.id, nearest.run.id);
        continue;
      }
      if (!desiredType.length) continue;
      const candidates = runs
        .filter((run) => desiredType.includes(run.type) && drawingSystem(run) === drawingSystem(symbol))
        .map((run) => ({ run, distance: pointToDrawingDistance(symbol.points[0], run) }))
        .sort((a, b) => a.distance - b.distance);
      if (candidates[0] && candidates[0].distance <= 24) {
        terminalRun.set(symbol.id, candidates[0].run.id);
        direct.set(candidates[0].run.id, (direct.get(candidates[0].run.id) || 0) + (symbol.cfm || 0));
      }
    }
    const calculated = new Map<string, number>();
    const calculate = (id: string, visiting = new Set<string>()): number => {
      if (calculated.has(id)) return calculated.get(id)!;
      if (visiting.has(id)) return 0;
      const next = new Set(visiting).add(id);
      const total = (direct.get(id) || 0) + (children.get(id) || []).reduce((sum, childId) => sum + calculate(childId, next), 0);
      calculated.set(id, total);
      return total;
    };
    runs.forEach((run) => calculate(run.id));
    return { calculated, terminalRun, equipmentRun, children };
  }

  function runAirflow(drawing: Drawing) {
    const propagated = airflowNetwork().calculated.get(drawing.id) || 0;
    return propagated || drawing.cfm || defaultCfm(drawing.size);
  }

  function recommendedDuctSize(cfm: number, type: Drawing["type"]) {
    const sizes = ["4", "6", "7", "8", "10", "12", "14", "16"];
    const maximumVelocity = type === "supply" ? 900 : 700;
    return sizes.find((size) => velocityFpm(size, cfm) <= maximumVelocity) || "16";
  }

  function sizingSuggestions() {
    return drawings
      .filter((drawing) => ["supply", "return", "fresh"].includes(drawing.type) && !drawing.fitting && drawingSystem(drawing) === activeSystem)
      .map((drawing) => {
        const cfm = runAirflow(drawing);
        const recommended = recommendedDuctSize(cfm, drawing.type);
        return {
          id: drawing.id,
          type: drawing.type,
          current: drawing.size,
          recommended,
          cfm,
          velocity: velocityFpm(recommended, cfm),
        };
      })
      .filter((suggestion) => suggestion.current !== suggestion.recommended);
  }

  function applySizingSuggestions() {
    const proposed = new Map(sizingSuggestions().map((suggestion) => [suggestion.id, suggestion.recommended]));
    if (!proposed.size) {
      setShowSizingReview(false);
      return;
    }
    setHistory(drawings.map((drawing) => {
      if (drawing.fitting) {
        const [upstreamId, downstreamId, branchId] = drawing.fitting.connectedIds;
        const upstreamSize = proposed.get(upstreamId) || drawing.fitting.upstreamSize;
        const downstreamSize = proposed.get(downstreamId) || drawing.fitting.downstreamSize;
        const branchSize = proposed.get(branchId) || drawing.fitting.branchSize;
        return {
          ...drawing,
          size: `${upstreamSize}×${downstreamSize}×${branchSize}`,
          fitting: { ...drawing.fitting, upstreamSize, downstreamSize, branchSize },
        };
      }
      const size = proposed.get(drawing.id);
      return size ? { ...drawing, size } : drawing;
    }));
    setShowSizingReview(false);
  }

  function designAirflow() {
    const equipment = drawings.filter((drawing) => drawing.symbol?.kind === "equipment" && drawingSystem(drawing) === activeSystem);
    const targetCfm = Math.max(0, ...equipment.map((drawing) => {
      const tons = Number(drawing.size.match(/[\d.]+/)?.[0] || 0);
      return drawing.cfm || tons * 400;
    }));
    const supplyCfm = drawings
      .filter((drawing) => drawing.symbol?.kind === "diffuser" && drawingSystem(drawing) === activeSystem)
      .reduce((total, drawing) => total + (drawing.cfm || 0), 0);
    const returnCfm = drawings
      .filter((drawing) => drawing.symbol?.kind === "returnGrille" && drawingSystem(drawing) === activeSystem)
      .reduce((total, drawing) => total + (drawing.cfm || 0), 0);
    const difference = supplyCfm - targetCfm;
    const percent = targetCfm ? Math.round(supplyCfm / targetCfm * 100) : 0;
    return { targetCfm, supplyCfm, returnCfm, difference, percent };
  }

  function systemStats(systemId: string) {
    const scoped = drawings.filter((drawing) => drawingSystem(drawing) === systemId);
    const equipment = scoped.filter((drawing) => drawing.symbol?.kind === "equipment");
    const designCfm = equipment.reduce((total, drawing) => {
      const tons = Number(drawing.size.match(/[\d.]+/)?.[0] || 0);
      return total + (drawing.cfm || tons * 400);
    }, 0);
    const supplyCfm = scoped.filter((drawing) => drawing.symbol?.kind === "diffuser").reduce((total, drawing) => total + (drawing.cfm || 0), 0);
    const returnCfm = scoped.filter((drawing) => drawing.symbol?.kind === "returnGrille").reduce((total, drawing) => total + (drawing.cfm || 0), 0);
    const balanced = designCfm > 0 && Math.abs(supplyCfm - designCfm) <= designCfm * .1;
    return { objects: scoped.length, units: equipment.length, designCfm, supplyCfm, returnCfm, balanced };
  }

  function roomSchedule() {
    const rooms = new Map<string, { name: string; type: Drawing["roomType"]; supplyCfm: number; returnCfm: number; diffusers: number; returns: number }>();
    for (const drawing of drawings.filter((item) => drawingSystem(item) === activeSystem && item.roomName?.trim())) {
      const name = drawing.roomName!.trim();
      const key = name.toLowerCase();
      const current = rooms.get(key) || { name, type: drawing.roomType || "general", supplyCfm: 0, returnCfm: 0, diffusers: 0, returns: 0 };
      if (drawing.symbol?.kind === "diffuser") {
        current.supplyCfm += drawing.cfm || 0;
        current.diffusers += 1;
      }
      if (drawing.symbol?.kind === "returnGrille") {
        current.returnCfm += drawing.cfm || 0;
        current.returns += 1;
      }
      if (drawing.roomType && drawing.roomType !== "general") current.type = drawing.roomType;
      rooms.set(key, current);
    }
    return [...rooms.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  function missingBranchDampers() {
    const dampers = drawings.filter((drawing) => drawing.symbol?.kind === "damper");
    return drawings.filter((drawing) => {
      if (!drawing.fitting || drawingSystem(drawing) !== activeSystem) return false;
      return !dampers.some((damper) => drawingSystem(damper) === drawingSystem(drawing) && Math.hypot(damper.points[0].x - drawing.points[0].x, damper.points[0].y - drawing.points[0].y) <= 38);
    });
  }

  function damperForFitting(fitting: Drawing): Drawing {
    const angle = fitting.fitting!.angle + fitting.fitting!.side * Math.PI / 4;
    return {
      id: crypto.randomUUID(),
      type: "symbol",
      points: [{ x: fitting.points[0].x + Math.cos(angle) * 25, y: fitting.points[0].y + Math.sin(angle) * 25 }],
      size: fitting.fitting!.branchSize,
      page: fitting.page,
      systemId: drawingSystem(fitting),
      roomName: fitting.roomName,
      roomType: fitting.roomType,
      cfm: 0,
      symbol: { kind: "damper", label: `VD · ${fitting.fitting!.branchSize}" · ACCESSIBLE`, rotation: Math.round(angle * 180 / Math.PI) },
    };
  }

  function addMissingBranchDampers() {
    const missing = missingBranchDampers();
    if (!missing.length) return;
    setHistory([...drawings, ...missing.map(damperForFitting)]);
  }

  function validationIssues() {
    const issues: Array<{ severity: "critical" | "warning" | "info"; title: string; detail: string; drawingId?: string }> = [];
    const balance = designAirflow();
    const equipment = drawings.filter((drawing) => drawing.symbol?.kind === "equipment" && drawingSystem(drawing) === activeSystem);
    const diffusers = drawings.filter((drawing) => drawing.symbol?.kind === "diffuser" && drawingSystem(drawing) === activeSystem);
    const returnGrilles = drawings.filter((drawing) => drawing.symbol?.kind === "returnGrille" && drawingSystem(drawing) === activeSystem);
    if (!equipment.length) issues.push({ severity: "critical", title: "Equipment missing", detail: "Place equipment and enter its design CFM." });
    if (!diffusers.length) issues.push({ severity: "critical", title: "Supply terminals missing", detail: "Place diffusers and assign scheduled CFM." });
    if (!returnGrilles.length) issues.push({ severity: "warning", title: "Return path missing", detail: "Add return grilles; verify bedroom return-air paths." });
    for (const unit of equipment) {
      if (!airflowNetwork().equipmentRun.has(unit.id)) issues.push({ severity: "critical", title: "Equipment disconnected", detail: `${unit.symbol?.label || "Equipment"} is not connected to a supply trunk.`, drawingId: unit.id });
    }
    if (balance.targetCfm && Math.abs(balance.difference) > balance.targetCfm * .1) {
      issues.push({
        severity: Math.abs(balance.difference) > balance.targetCfm * .2 ? "critical" : "warning",
        title: "Supply CFM is out of balance",
        detail: `${balance.supplyCfm} assigned vs ${balance.targetCfm} design CFM (${balance.difference > 0 ? "+" : ""}${balance.difference} CFM).`,
      });
    }
    if (balance.targetCfm && balance.returnCfm && Math.abs(balance.returnCfm - balance.targetCfm) > balance.targetCfm * .1) {
      issues.push({ severity: "warning", title: "Return CFM needs review", detail: `${balance.returnCfm} return vs ${balance.targetCfm} design CFM.` });
    }
    for (const drawing of drawings) {
      if (drawingSystem(drawing) !== activeSystem) continue;
      if (!["supply", "return", "fresh"].includes(drawing.type) || drawing.fitting) continue;
      const cfm = runAirflow(drawing);
      const velocity = velocityFpm(drawing.size, cfm);
      const highLimit = drawing.type === "supply" ? 900 : drawing.type === "return" ? 700 : 700;
      const lowLimit = drawing.type === "supply" ? 400 : 300;
      if (velocity > highLimit) issues.push({
        severity: velocity > highLimit * 1.2 ? "critical" : "warning",
        title: `${drawing.type === "supply" ? "Supply" : drawing.type === "return" ? "Return" : "Fresh-air"} velocity high`,
        detail: `${drawing.size}" run is ${velocity} FPM; target ${lowLimit}–${highLimit} FPM.`,
        drawingId: drawing.id,
      });
      const pressure = runPressure(drawing);
      if (pressure.frictionRate > .12) issues.push({
        severity: pressure.frictionRate > .2 ? "critical" : "warning",
        title: "Flex friction rate high",
        detail: `${drawing.size}" at ${cfm} CFM is approximately ${pressure.frictionRate.toFixed(2)} in. w.g./100 ft. Review size, compression, and routing.`,
        drawingId: drawing.id,
      });
      if (pressure.pressureDrop > .15) issues.push({
        severity: pressure.pressureDrop > .25 ? "critical" : "warning",
        title: "Run pressure loss high",
        detail: `${pressure.equivalentLength.toFixed(0)} equivalent ft produces approximately ${pressure.pressureDrop.toFixed(2)} in. w.g. loss.`,
        drawingId: drawing.id,
      });
      if (!airflowNetwork().calculated.get(drawing.id) && !drawing.cfm) issues.push({ severity: "info", title: "Run uses estimated CFM", detail: `${drawing.size}" ${drawing.type} run defaults to ${cfm} CFM. Connect a terminal or enter design airflow.`, drawingId: drawing.id });
    }
    for (const diffuser of diffusers) {
      if (!diffuser.cfm) issues.push({ severity: "warning", title: "Diffuser CFM missing", detail: `${diffuser.symbol?.label || "Supply diffuser"} needs scheduled airflow.`, drawingId: diffuser.id });
      if (!airflowNetwork().terminalRun.has(diffuser.id)) issues.push({ severity: "critical", title: "Diffuser disconnected", detail: `${diffuser.symbol?.label || "Supply diffuser"} is not connected to a supply run.`, drawingId: diffuser.id });
    }
    for (const grille of returnGrilles) {
      if (!airflowNetwork().terminalRun.has(grille.id)) issues.push({ severity: "warning", title: "Return grille disconnected", detail: `${grille.symbol?.label || "Return grille"} is not connected to a return run.`, drawingId: grille.id });
    }
    const activeRuns = drawings.filter((drawing) => drawingSystem(drawing) === activeSystem && ["supply", "return", "fresh"].includes(drawing.type) && !drawing.fitting);
    const otherRuns = drawings.filter((drawing) => drawingSystem(drawing) !== activeSystem && ["supply", "return", "fresh"].includes(drawing.type) && !drawing.fitting);
    for (const run of activeRuns) {
      const touchesOtherSystem = run.points.some((point) => otherRuns.some((other) => other.points.some((otherPoint) => Math.hypot(point.x - otherPoint.x, point.y - otherPoint.y) < 2)));
      if (touchesOtherSystem) issues.push({ severity: "critical", title: "Systems touch at a connection", detail: `${systemLabel(activeSystem)} contacts another system. Keep zones separated.`, drawingId: run.id });
    }
    for (const room of roomSchedule()) {
      if (room.type === "bedroom" && room.supplyCfm > 0 && room.returns === 0) {
        issues.push({ severity: "warning", title: "Bedroom return path missing", detail: `${room.name} has ${room.supplyCfm} supply CFM but no assigned return. Verify door-closed pressure relief.` });
      }
      if (room.type === "bedroom" && room.returns > 0 && room.returnCfm === 0) {
        issues.push({ severity: "info", title: "Bedroom return CFM missing", detail: `${room.name} has a return grille without scheduled airflow.` });
      }
    }
    for (const fitting of missingBranchDampers()) {
      issues.push({ severity: "warning", title: "Branch damper missing", detail: `${fitting.size} T/Y needs an accessible balancing damper at the branch takeoff.`, drawingId: fitting.id });
    }
    const freshRuns = drawings.filter((drawing) => drawingSystem(drawing) === activeSystem && drawing.type === "fresh" && !drawing.fitting);
    const motorDampers = drawings.filter((drawing) => drawingSystem(drawing) === activeSystem && drawing.symbol?.kind === "motorDamper");
    if (freshRuns.length && !motorDampers.length) issues.push({ severity: "warning", title: "Outside-air damper missing", detail: "Fresh-air duct is shown without a motorized damper. Verify whether the existing damper is reusable." });
    if (equipment.length && !drawings.some((drawing) => drawingSystem(drawing) === activeSystem && drawing.symbol?.kind === "thermostat")) {
      issues.push({ severity: "info", title: "Thermostat location not marked", detail: `Add the control point for ${systemLabel(activeSystem)} so the field team can coordinate wiring.` });
    }
    return issues;
  }

  function buildTakeoff() {
    const ductTotals = new Map<string, { type: string; size: string; length: number }>();
    for (const drawing of drawings) {
      if (!["supply", "return", "fresh"].includes(drawing.type) || drawing.fitting || drawing.symbol) continue;
      const key = `${drawing.type}-${drawing.size}`;
      const current = ductTotals.get(key) || { type: drawing.type, size: drawing.size, length: 0 };
      current.length += drawingLengthFeet(drawing);
      ductTotals.set(key, current);
    }
    const rows: Array<{ item: string; size: string; quantity: string; note: string }> = [];
    for (const total of [...ductTotals.values()].sort((a, b) => Number(b.size) - Number(a.size))) {
      const name = total.type === "supply" ? "Supply flex duct" : total.type === "return" ? "Return flex duct" : "Fresh-air duct";
      const rolls = Math.max(1, Math.ceil(total.length / 25));
      rows.push({
        item: name,
        size: `${total.size}"`,
        quantity: `${total.length.toFixed(1)} LF`,
        note: `${rolls} × 25-ft ${rolls === 1 ? "roll" : "rolls"}`,
      });
    }
    const count = (kind: SymbolKind) => drawings.filter((drawing) => drawing.symbol?.kind === kind).length;
    const diffusers = count("diffuser");
    const returnGrilles = count("returnGrille");
    const equipment = count("equipment");
    const fans = count("fan");
    const dampers = count("damper");
    const motorDampers = count("motorDamper");
    const reducers = count("reducer");
    const thermostats = count("thermostat");
    const smokeDetectors = count("smoke");
    const fittings = drawings.filter((drawing) => drawing.fitting).length;
    if (fittings) rows.push({ item: "T/Y branch fitting", size: "Auto-sized", quantity: `${fittings} EA`, note: "Connected fitting" });
    if (diffusers) {
      rows.push({ item: "Supply diffuser", size: "Per plan", quantity: `${diffusers} EA`, note: "Field label governs" });
      rows.push({ item: "Diffuser plenum box", size: "Per diffuser", quantity: `${diffusers} EA`, note: "One per diffuser" });
      rows.push({ item: "Collar + volume damper", size: "Per run", quantity: `${diffusers} EA`, note: "Damper at takeoff" });
    }
    if (returnGrilles) rows.push({ item: "Return grille / box", size: "Per plan", quantity: `${returnGrilles} EA`, note: "Field label governs" });
    if (equipment) rows.push({ item: "HVAC equipment", size: "Per plan", quantity: `${equipment} EA`, note: "Verify model/tonnage" });
    if (fans) rows.push({ item: "Exhaust fan", size: "Per plan", quantity: `${fans} EA`, note: "Coordinate power/roof" });
    if (dampers) rows.push({ item: "Volume balancing damper", size: "Per branch", quantity: `${dampers} EA`, note: "Keep accessible and label" });
    if (motorDampers) rows.push({ item: "Motorized outside-air damper", size: "Per plan", quantity: `${motorDampers} EA`, note: "24V · normally closed · verify controls" });
    if (reducers) rows.push({ item: "Reducer / transition", size: "Field measure", quantity: `${reducers} EA`, note: "Do not fabricate from plan only" });
    if (thermostats) rows.push({ item: "Thermostat / wall control", size: "24V", quantity: `${thermostats} EA`, note: "Coordinate mounting height" });
    if (smokeDetectors) rows.push({ item: "Duct smoke detector", size: "Per code", quantity: `${smokeDetectors} EA`, note: "Before first takeoff · maintain access" });
    if (ductTotals.size) rows.push({ item: "Hangers, strap, sealant & mastic", size: "—", quantity: "1 LOT", note: "Field verify" });
    return rows;
  }

  function applyScalePreset(label: string) {
    const unitsPerFoot: Record<string, number> = {
      '1/8" = 1\'-0"': 12.15,
      '3/16" = 1\'-0"': 18.225,
      '1/4" = 1\'-0"': 24.3,
      '1/2" = 1\'-0"': 48.6,
    };
    setScaleFeetPerUnit(1 / (unitsPerFoot[label] || 24.3));
    setScaleLabel(label);
    setScaleLocked(true);
    setCalibrating(false);
    setMeasureDraft([]);
  }

  function placeSmartBranch(point: Point) {
    const target = nearestSupplySegment(point);
    if (!target || target.distance > 34 / zoom) {
      setBranchMessage("Move closer to a blue supply run");
      return;
    }

    const center = target.point;
    const downstreamSize = steppedSize(target.drawing.size, 1);
    const branchSize = steppedSize(target.drawing.size, 2);
    const upstreamPoints = cleanPoints([...target.drawing.points.slice(0, target.segmentIndex + 1), center]);
    const downstreamPoints = cleanPoints([center, ...target.drawing.points.slice(target.segmentIndex + 1)]);
    if (upstreamPoints.length < 2 || downstreamPoints.length < 2) {
      setBranchMessage("Place the fitting farther from the end of the run");
      return;
    }

    const downstreamId = crypto.randomUUID();
    const branchRunId = crypto.randomUUID();
    const fittingId = crypto.randomUUID();
    const branchAngle = target.angle + target.side * Math.PI / 4;
    const branchEnd = {
      x: center.x + Math.cos(branchAngle) * 44,
      y: center.y + Math.sin(branchAngle) * 44,
    };

    const upstream: Drawing = { ...target.drawing, points: upstreamPoints, cfm: target.drawing.cfm || defaultCfm(target.drawing.size) };
    const downstream: Drawing = {
      ...target.drawing,
      id: downstreamId,
      points: downstreamPoints,
      size: downstreamSize,
      cfm: defaultCfm(downstreamSize),
    };
    const branchRun: Drawing = {
      id: branchRunId,
      type: "supply",
      points: [center, branchEnd],
      size: branchSize,
      cfm: defaultCfm(branchSize),
      page: pageNumber,
      systemId: drawingSystem(target.drawing),
    };
    const fitting: Drawing = {
      id: fittingId,
      type: "branch",
      points: [center],
      size: `${target.drawing.size}×${downstreamSize}×${branchSize}`,
      page: pageNumber,
      systemId: drawingSystem(target.drawing),
      fitting: {
        kind: "ty",
        angle: target.angle,
        side: target.side,
        upstreamSize: target.drawing.size,
        downstreamSize,
        branchSize,
        connectedIds: [upstream.id, downstream.id, branchRun.id],
      },
    };
    const branchDamper = damperForFitting(fitting);

    setHistory([
      ...drawings.filter((drawing) => drawing.id !== target.drawing.id),
      upstream,
      downstream,
      branchRun,
      fitting,
      branchDamper,
    ]);
    setSelectedId(fittingId);
    setBranchMessage(`${target.drawing.size}×${downstreamSize}×${branchSize} T/Y connected`);
  }

  function placeSymbol(kind: SymbolKind, point: Point) {
    const defaults: Record<SymbolKind, { label: string; size: string; cfm: number }> = {
      diffuser: { label: "12×12 SUPPLY", size: "12×12", cfm: 225 },
      returnGrille: { label: "14×14 RETURN", size: "14×14", cfm: 1200 },
      equipment: { label: "SYSTEM 1 · 3 TON", size: "3 TON", cfm: 1200 },
      fan: { label: "EF-1", size: "EF-1", cfm: 80 },
      damper: { label: "VD · ACCESSIBLE", size: "VD", cfm: 0 },
      motorDamper: { label: "MOTORIZED OA DAMPER · 24V NC", size: "OA", cfm: 0 },
      reducer: { label: "REDUCER · FIELD VERIFY", size: "TRANSITION", cfm: 0 },
      thermostat: { label: "T-STAT", size: "24V", cfm: 0 },
      smoke: { label: "DUCT SMOKE · BEFORE 1ST TAKEOFF", size: "SD", cfm: 0 },
      airflow: { label: "AIRFLOW", size: "FLOW", cfm: 0 },
      note: { label: "FIELD VERIFY BEFORE FABRICATION", size: "NOTE", cfm: 0 },
    };
    const snapped = snapPoint(point);
    const symbol: Drawing = {
      id: crypto.randomUUID(),
      type: "symbol",
      points: [snapped],
      size: defaults[kind].size,
      page: pageNumber,
      systemId: activeSystem,
      cfm: defaults[kind].cfm,
      symbol: {
        kind,
        label: defaults[kind].label,
        rotation: 0,
      },
    };
    setHistory([...drawings, symbol]);
    setSelectedId(symbol.id);
  }

  function snapPoint(point: Point, ignoredId?: string) {
    let closestVertex: Point | null = null;
    let vertexDistance = Infinity;
    for (const drawing of drawings) {
      if (drawing.page !== pageNumber || drawing.id === ignoredId) continue;
      for (const vertex of drawing.points) {
        const distance = Math.hypot(point.x - vertex.x, point.y - vertex.y);
        if (distance < vertexDistance) {
          closestVertex = vertex;
          vertexDistance = distance;
        }
      }
    }
    if (closestVertex && vertexDistance <= 14 / zoom) return closestVertex;
    const nearest = nearestSegment(point, ignoredId);
    if (nearest && nearest.distance <= 14 / zoom) return nearest.point;
    const gridPoint = { x: Math.round(point.x / 10) * 10, y: Math.round(point.y / 10) * 10 };
    return Math.hypot(point.x - gridPoint.x, point.y - gridPoint.y) <= 5 / zoom ? gridPoint : point;
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
    if (draft.length > 1 && ["supply", "return", "fresh"].includes(activeTool)) {
      const drawing: Drawing = {
        id: crypto.randomUUID(),
        type: activeTool as DrawType,
        points: draft,
        size: ductSize,
        page: pageNumber,
        cfm: defaultCfm(ductSize),
        systemId: activeSystem,
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
    const rawPoint = canvasPoint(event);
    if (calibrating) {
      const point = snapPoint(rawPoint);
      if (!measureDraft.length) {
        setMeasureDraft([point]);
        return;
      }
      const distance = Math.hypot(point.x - measureDraft[0].x, point.y - measureDraft[0].y);
      const feet = Number(referenceFeet);
      if (distance > 1 && feet > 0) {
        setScaleFeetPerUnit(feet / distance);
        setScaleLabel(`Calibrated · ${feet} ft reference`);
        setScaleLocked(true);
        setCalibrating(false);
        setMeasureDraft([]);
      }
      return;
    }
    if (activeTool === "select") {
      setSelectedId(null);
      return;
    }
    if (activeTool === "measure") {
      const point = snapPoint(rawPoint);
      if (!measureDraft.length) {
        setMeasureDraft([point]);
      } else {
        const feet = Math.hypot(point.x - measureDraft[0].x, point.y - measureDraft[0].y) * scaleFeetPerUnit;
        const measurement: Drawing = {
          id: crypto.randomUUID(),
          type: "measurement",
          points: [measureDraft[0], point],
          size: `${feet.toFixed(1)} FT`,
          page: pageNumber,
          systemId: activeSystem,
          measurement: { feet },
        };
        setHistory([...drawings, measurement]);
        setSelectedId(measurement.id);
        setMeasureDraft([]);
      }
      return;
    }
    if (calibrating || activeTool === "measure") {
      const point = snapPoint(raw);
      setHoverPoint(point);
      setSnapMarker(point.x !== raw.x || point.y !== raw.y ? point : null);
      return;
    }
    if (activeTool === "branch") {
      placeSmartBranch(rawPoint);
      return;
    }
    if (symbolTools.includes(activeTool as SymbolKind)) {
      placeSymbol(activeTool as SymbolKind, rawPoint);
      return;
    }
    if (!["supply", "return", "fresh"].includes(activeTool)) return;
    const point = snapPoint(rawPoint);
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

  function copySelected() {
    const selected = drawings.find((drawing) => drawing.id === selectedId);
    if (selected) clipboardRef.current = structuredClone(selected);
  }

  function pasteDrawing() {
    const copied = clipboardRef.current;
    if (!copied) return;
    const pasted: Drawing = {
      ...structuredClone(copied),
      id: crypto.randomUUID(),
      page: pageNumber,
      points: copied.points.map((point) => ({ x: point.x + 18, y: point.y + 18 })),
    };
    setHistory([...drawings, pasted]);
    setSelectedId(pasted.id);
    clipboardRef.current = structuredClone(pasted);
  }

  function duplicateSelected() {
    const selected = drawings.find((drawing) => drawing.id === selectedId);
    if (!selected) return;
    const duplicate: Drawing = {
      ...structuredClone(selected),
      id: crypto.randomUUID(),
      page: pageNumber,
      points: selected.points.map((point) => ({ x: point.x + 18, y: point.y + 18 })),
    };
    clipboardRef.current = structuredClone(duplicate);
    setHistory([...drawings, duplicate]);
    setSelectedId(duplicate.id);
  }

  function updateSelectedSize(size: string) {
    if (!selectedId) {
      setDuctSize(size);
      return;
    }
    const selected = drawings.find((drawing) => drawing.id === selectedId);
    if (selected?.fitting) {
      const downstreamSize = steppedSize(size, 1);
      const branchSize = steppedSize(size, 2);
      const [upstreamId, downstreamId, branchId] = selected.fitting.connectedIds;
      setHistory(drawings.map((drawing) => {
        if (drawing.id === selectedId) return {
          ...drawing,
          size: `${size}×${downstreamSize}×${branchSize}`,
          fitting: {
            ...selected.fitting!,
            upstreamSize: size,
            downstreamSize,
            branchSize,
          },
        };
        if (drawing.id === upstreamId) return { ...drawing, size, cfm: defaultCfm(size) };
        if (drawing.id === downstreamId) return { ...drawing, size: downstreamSize, cfm: defaultCfm(downstreamSize) };
        if (drawing.id === branchId) return { ...drawing, size: branchSize, cfm: defaultCfm(branchSize) };
        return drawing;
      }));
    } else {
      setHistory(drawings.map((drawing) => drawing.id === selectedId ? { ...drawing, size, cfm: defaultCfm(size) } : drawing));
    }
    setDuctSize(size);
  }

  function updateSelectedCfm(cfm: number) {
    if (!selectedId || !Number.isFinite(cfm)) return;
    setHistory(drawings.map((drawing) => drawing.id === selectedId ? { ...drawing, cfm: Math.max(0, cfm) } : drawing));
  }

  function updateSelectedSystem(systemId: string) {
    if (!selectedId) {
      setActiveSystem(systemId);
      return;
    }
    const selected = drawings.find((drawing) => drawing.id === selectedId);
    const affected = new Set([selectedId, ...(selected?.fitting?.connectedIds || [])]);
    setHistory(drawings.map((drawing) => affected.has(drawing.id) ? { ...drawing, systemId } : drawing));
    setActiveSystem(systemId);
  }

  function updateSelectedRoom(changes: Partial<Pick<Drawing, "roomName" | "roomType">>) {
    if (!selectedId) return;
    setHistory(drawings.map((drawing) => drawing.id === selectedId ? { ...drawing, ...changes } : drawing));
  }

  function updateSelectedSymbol(changes: Partial<SymbolMeta>) {
    if (!selectedId) return;
    setHistory(drawings.map((drawing) =>
      drawing.id === selectedId && drawing.symbol
        ? { ...drawing, symbol: { ...drawing.symbol, ...changes } }
        : drawing));
  }

  function rotateSelectedSymbol(delta: number) {
    const selected = drawings.find((drawing) => drawing.id === selectedId);
    if (!selected?.symbol) return;
    updateSelectedSymbol({ rotation: (selected.symbol.rotation + delta + 360) % 360 });
  }

  function startPointDrag(event: PointerEvent<SVGCircleElement>, drawingId: string, pointIndex: number) {
    if (activeTool !== "select") return;
    event.stopPropagation();
    event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId);
    dragRef.current = { kind: "point", drawingId, pointIndex, before: drawings };
    setSelectedId(drawingId);
    setActiveSystem(drawingSystem(drawings.find((drawing) => drawing.id === drawingId)));
  }

  function startLineDrag(event: PointerEvent<SVGPathElement>, drawing: Drawing) {
    if (activeTool !== "select") return;
    event.stopPropagation();
    event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId);
    dragRef.current = { kind: "line", drawingId: drawing.id, start: canvasPoint(event as unknown as PointerEvent<SVGSVGElement>), original: drawing.points, before: drawings };
    setSelectedId(drawing.id);
    setActiveSystem(drawingSystem(drawing));
  }

  function startFittingDrag(event: PointerEvent<SVGGElement>, drawing: Drawing) {
    if (activeTool !== "select" || !drawing.fitting) return;
    event.stopPropagation();
    event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId);
    dragRef.current = {
      kind: "fitting",
      drawingId: drawing.id,
      start: canvasPoint(event as unknown as PointerEvent<SVGSVGElement>),
      originalCenter: drawing.points[0],
      connectedIds: drawing.fitting.connectedIds,
      before: drawings,
    };
    setSelectedId(drawing.id);
    setActiveSystem(drawingSystem(drawing));
  }

  function startSymbolDrag(event: PointerEvent<SVGGElement>, drawing: Drawing) {
    if (activeTool !== "select" || !drawing.symbol) return;
    event.stopPropagation();
    event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId);
    dragRef.current = { kind: "symbol", drawingId: drawing.id, before: drawings };
    setSelectedId(drawing.id);
    setActiveSystem(drawingSystem(drawing));
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
        if (drag.kind === "line") {
          const dx = raw.x - drag.start.x;
          const dy = raw.y - drag.start.y;
          setDrawings((current) => current.map((drawing) => drawing.id === drag.drawingId
            ? { ...drawing, points: drag.original.map((point) => ({ x: point.x + dx, y: point.y + dy })) }
            : drawing));
        } else if (drag.kind === "fitting") {
          const nextCenter = raw;
          setDrawings((current) => current.map((drawing) => {
            if (drawing.id === drag.drawingId) return { ...drawing, points: [nextCenter] };
            if (!drag.connectedIds.includes(drawing.id)) return drawing;
            return {
              ...drawing,
              points: drawing.points.map((point) =>
                Math.hypot(point.x - drag.originalCenter.x, point.y - drag.originalCenter.y) < .75 ? nextCenter : point),
            };
          }));
        } else {
          const nextPoint = snapPoint(raw, drag.drawingId);
          setSnapMarker(nextPoint.x !== raw.x || nextPoint.y !== raw.y ? nextPoint : null);
          setDrawings((current) => current.map((drawing) =>
            drawing.id === drag.drawingId ? { ...drawing, points: [nextPoint] } : drawing));
        }
      }
      return;
    }
    if (activeTool === "branch") {
      const target = nearestSupplySegment(raw);
      if (target && target.distance <= 34 / zoom) {
        setBranchPreview({
          center: target.point,
          angle: target.angle,
          side: target.side,
          parentSize: target.drawing.size,
          valid: true,
        });
        setSnapMarker(target.point);
        setBranchMessage("Click once to insert and connect");
      } else {
        setBranchPreview(null);
        setSnapMarker(null);
        setBranchMessage("Move over a blue supply run");
      }
      return;
    }
    if (symbolTools.includes(activeTool as SymbolKind)) {
      const point = snapPoint(raw);
      setSymbolPreview({ kind: activeTool as SymbolKind, point });
      setSnapMarker(point.x !== raw.x || point.y !== raw.y ? point : null);
      return;
    }
    if (["supply", "return", "fresh"].includes(activeTool)) {
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

  function renderSymbol(drawing: Drawing, preview = false) {
    if (!drawing.symbol) return null;
    const center = drawing.points[0];
    const { kind, label, rotation } = drawing.symbol;
    const selected = selectedId === drawing.id;
    return <g
      className={`hvac-symbol symbol-${kind} ${preview ? "symbol-preview" : ""} ${selected ? "selected-symbol" : ""}`}
      transform={`translate(${center.x} ${center.y}) rotate(${rotation})`}
      onPointerDown={preview ? undefined : (event) => startSymbolDrag(event, drawing)}
    >
      <circle className="symbol-hit" cx="0" cy="0" r="24" />
      {kind === "diffuser" && <>
        <rect x="-10" y="-10" width="20" height="20" rx="1" />
        <path d="M -7 -7 L 7 7 M 7 -7 L -7 7 M 0 -9 L 0 9 M -9 0 L 9 0" />
      </>}
      {kind === "returnGrille" && <>
        <rect x="-15" y="-10" width="30" height="20" rx="1" />
        <path d="M -11 -7 L -11 7 M -6 -7 L -6 7 M -1 -7 L -1 7 M 4 -7 L 4 7 M 9 -7 L 9 7" />
      </>}
      {kind === "equipment" && <>
        <rect x="-20" y="-12" width="40" height="24" rx="2" />
        <path d="M -14 -7 L 9 -7 L 14 0 L 9 7 L -14 7 Z" />
        <circle cx="-20" cy="0" r="3" />
        <circle cx="20" cy="0" r="3" />
      </>}
      {kind === "fan" && <>
        <circle cx="0" cy="0" r="11" />
        <circle cx="0" cy="0" r="2.5" />
        <path d="M 0 -2 C 8 -10 12 -3 6 2 M 2 1 C 5 12 -4 12 -5 5 M -2 1 C -12 -1 -8 -10 -2 -7" />
      </>}
      {kind === "damper" && <>
        <circle cx="0" cy="0" r="10" />
        <path d="M -11 0 L 11 0 M -7 7 L 7 -7" />
      </>}
      {kind === "motorDamper" && <>
        <rect x="-14" y="-8" width="28" height="16" rx="2" />
        <path d="M -10 5 L 10 -5 M 0 -8 L 0 -14 L 10 -14" />
      </>}
      {kind === "reducer" && <>
        <path d="M -15 -10 L -15 10 L 15 6 L 15 -6 Z" />
        <path d="M -8 0 L 8 0" />
      </>}
      {kind === "thermostat" && <>
        <rect x="-9" y="-11" width="18" height="22" rx="3" />
        <text className="symbol-letter" x="0" y="4" textAnchor="middle">T</text>
      </>}
      {kind === "smoke" && <>
        <rect x="-12" y="-9" width="24" height="18" rx="2" />
        <circle cx="0" cy="0" r="4" />
        <path d="M -8 -5 L -4 -5 M 4 -5 L 8 -5" />
      </>}
      {kind === "airflow" && <path className="airflow-arrow" d="M -18 0 L 16 0 M 8 -7 L 16 0 L 8 7" />}
      {kind === "note" && <>
        <rect x="-11" y="-10" width="22" height="20" rx="2" />
        <path d="M -7 -5 L 7 -5 M -7 0 L 7 0 M -7 5 L 3 5" />
      </>}
      <text className="symbol-label" x="0" y={kind === "equipment" ? -18 : kind === "airflow" ? -10 : -16} textAnchor="middle">{label}</text>
      {selected && <circle className="rotation-ring" cx="0" cy="0" r="23" />}
    </g>;
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, select, textarea")) return;
      const key = event.key.toLowerCase();
      if (event.key === "Escape") {
        setDraft([]);
        setHoverPoint(null);
        setSnapMarker(null);
        setMeasureDraft([]);
        setCalibrating(false);
      }
      if (event.key === "Delete" || event.key === "Backspace") deleteSelected();
      if ((event.ctrlKey || event.metaKey) && key === "z") {
        event.preventDefault();
        event.shiftKey ? redo() : undo();
      }
      if ((event.ctrlKey || event.metaKey) && key === "y") {
        event.preventDefault();
        redo();
      }
      if ((event.ctrlKey || event.metaKey) && key === "c") {
        event.preventDefault();
        copySelected();
      }
      if ((event.ctrlKey || event.metaKey) && key === "v") {
        event.preventDefault();
        pasteDrawing();
      }
      if ((event.ctrlKey || event.metaKey) && key === "d") {
        event.preventDefault();
        duplicateSelected();
      }
      if ((event.ctrlKey || event.metaKey) && key === "s") {
        event.preventDefault();
        saveProject();
      }
      if (event.key === "[") rotateSelectedSymbol(-15);
      if (event.key === "]") rotateSelectedSymbol(15);
      if (!event.ctrlKey && !event.metaKey && key === "v") setActiveTool("select");
      const toolShortcut: Record<string, string> = {
        s: "supply",
        b: "branch",
        r: "return",
        f: "fresh",
        d: "diffuser",
        g: "returnGrille",
        e: "equipment",
        x: "fan",
      };
      if (!event.ctrlKey && !event.metaKey && toolShortcut[key]) {
        finishDrawing();
        setActiveTool(toolShortcut[key]);
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
          <select className="system-switcher" aria-label="Active HVAC system" value={activeSystem} onChange={(event) => { setActiveSystem(event.target.value); setSelectedId(null); }}>
            {systems.map((system) => <option key={system.id} value={system.id}>{systemLabel(system.id)}</option>)}
          </select>
        </div>

        <nav className="top-actions" aria-label="Project actions">
          <button aria-label="Undo" onClick={undo}><Undo2 size={17} /></button>
          <button aria-label="Redo" onClick={redo}><Redo2 size={17} /></button>
          <button aria-label="Delete selected object" disabled={!selectedId} onClick={deleteSelected}><Trash2 size={17} /></button>
          <button aria-label="Duplicate selected object" disabled={!selectedId} onClick={duplicateSelected}><Copy size={16} /></button>
          <span className="divider" />
          <button className="save-button" onClick={saveProject}><Save size={16} /> {saveState === "saving" ? "Saving…" : "Saved"}</button>
          <button className="drive-button" onClick={() => void openFromDrive()}><HardDrive size={16} /> Open Drive</button>
          <button className="primary-button" disabled={!pdf} onClick={() => window.print()}>Export plan</button>
          <button aria-label="Settings"><Settings size={18} /></button>
        </nav>
      </header>

      <section className="print-header">
        <div>
          <strong>HVAC PLAN STUDIO · FIELD INSTALLATION PLAN</strong>
          <h1>{fileName}</h1>
        </div>
        <dl>
          <div><dt>Sheet</dt><dd>{pageNumber} of {pdf?.numPages || 1}</dd></div>
          <div><dt>Scale</dt><dd>{scaleLabel}</dd></div>
          <div><dt>Airflow</dt><dd>{Math.max(0, ...drawings.filter((drawing) => drawing.type === "supply").map((drawing) => drawing.cfm || defaultCfm(drawing.size)))} CFM</dd></div>
        </dl>
      </section>

      <section className="workspace">
        <aside className="left-panel">
          <div className="panel-heading">
            <div><span>DESIGN TOOLS</span><small>FIELD STANDARD</small></div>
            <PanelLeftClose size={17} />
          </div>
          <div className="tool-list">
            {tools.map(({ id, label, icon: Icon, tone }) => (
              <button className={`tool ${activeTool === id ? "active" : ""}`} key={label} onClick={() => { finishDrawing(); setActiveTool(id); setSelectedId(null); setBranchPreview(null); setSymbolPreview(null); }}>
                <span className={`tool-icon ${tone || ""}`}><Icon size={19} /></span>
                <span>{label}</span>
                {activeTool === id && <kbd>{id === "select" ? "V" : "●"}</kbd>}
              </button>
            ))}
          </div>

          <div className="panel-section">
            <div className="section-title"><span>OBJECT PROPERTIES</span><SlidersHorizontal size={15} /></div>
            {drawings.find((drawing) => drawing.id === selectedId)?.symbol ? <>
              <label>Field label
                <input
                  className="property-input"
                  value={drawings.find((drawing) => drawing.id === selectedId)?.symbol?.label || ""}
                  onChange={(event) => updateSelectedSymbol({ label: event.target.value })}
                />
              </label>
              <label>Rotation
                <div className="rotation-controls">
                  <button onClick={() => rotateSelectedSymbol(-15)}>−15°</button>
                  <strong>{drawings.find((drawing) => drawing.id === selectedId)?.symbol?.rotation || 0}°</strong>
                  <button onClick={() => rotateSelectedSymbol(15)}>+15°</button>
                </div>
              </label>
              {["diffuser", "returnGrille", "equipment", "fan"].includes(drawings.find((drawing) => drawing.id === selectedId)?.symbol?.kind || "") && <label>Scheduled airflow (CFM)
                <input
                  className="property-input"
                  type="number"
                  min="0"
                  step="5"
                  value={drawings.find((drawing) => drawing.id === selectedId)?.cfm || 0}
                  onChange={(event) => updateSelectedCfm(Number(event.target.value))}
                />
              </label>}
            </> : drawings.find((drawing) => drawing.id === selectedId)?.measurement ? <div className="engineering-card">
              <span>MEASURED DISTANCE</span>
              <strong>{drawings.find((drawing) => drawing.id === selectedId)?.measurement?.feet.toFixed(1)} FT</strong>
              <small>{scaleLabel}</small>
            </div> : <>
              <label>{selectedId ? "Selected duct size" : "New duct size"}
                <select value={selectedId ? drawings.find((drawing) => drawing.id === selectedId)?.fitting?.upstreamSize || drawings.find((drawing) => drawing.id === selectedId)?.size || ductSize : ductSize} onChange={(event) => updateSelectedSize(event.target.value)}><option>16</option><option>14</option><option>12</option><option>10</option><option>8</option><option>7</option><option>6</option><option>4</option></select>
              </label>
              {selectedId && !drawings.find((drawing) => drawing.id === selectedId)?.fitting && <div className="engineering-properties">
                <label>Manual airflow override (CFM)
                  <input
                    className="property-input"
                    type="number"
                    min="0"
                    value={drawings.find((drawing) => drawing.id === selectedId)?.cfm || 0}
                    onChange={(event) => updateSelectedCfm(Number(event.target.value))}
                  />
                </label>
                <div className="engineering-grid">
                  <div><span>Length</span><strong>{drawingLengthFeet(drawings.find((drawing) => drawing.id === selectedId)!)} LF</strong></div>
                  <div><span>Connected airflow</span><strong>{runAirflow(drawings.find((drawing) => drawing.id === selectedId)!)} CFM</strong></div>
                  <div><span>Velocity</span><strong>{velocityFpm(drawings.find((drawing) => drawing.id === selectedId)?.size || "0", runAirflow(drawings.find((drawing) => drawing.id === selectedId)!))} FPM</strong></div>
                  <div><span>Source</span><strong>{airflowNetwork().calculated.get(selectedId) ? "AUTO" : "MANUAL"}</strong></div>
                  <div><span>Friction rate</span><strong>{runPressure(drawings.find((drawing) => drawing.id === selectedId)!).frictionRate.toFixed(2)} /100 FT</strong></div>
                  <div><span>Pressure loss</span><strong>{runPressure(drawings.find((drawing) => drawing.id === selectedId)!).pressureDrop.toFixed(2)} IN. W.G.</strong></div>
                </div>
              </div>}
            </>}
            <label>System zone
              <select
                value={selectedId ? drawingSystem(drawings.find((drawing) => drawing.id === selectedId)!) : activeSystem}
                onChange={(event) => updateSelectedSystem(event.target.value)}
              >
                {systems.map((system) => <option key={system.id} value={system.id}>{systemLabel(system.id)}</option>)}
              </select>
            </label>
            <label>System name
              <input
                className="property-input"
                value={systemLabel(activeSystem)}
                onChange={(event) => setSystemNames((current) => ({ ...current, [activeSystem]: event.target.value }))}
                onBlur={() => setSaveState("saving")}
              />
            </label>
            {selectedId && <>
              <label>Room / area
                <input
                  className="property-input"
                  placeholder="Example: Primary Bedroom"
                  value={drawings.find((drawing) => drawing.id === selectedId)?.roomName || ""}
                  onChange={(event) => updateSelectedRoom({ roomName: event.target.value })}
                />
              </label>
              <label>Room type
                <select
                  value={drawings.find((drawing) => drawing.id === selectedId)?.roomType || "general"}
                  onChange={(event) => updateSelectedRoom({ roomType: event.target.value as Drawing["roomType"] })}
                >
                  <option value="general">General / common</option>
                  <option value="bedroom">Bedroom</option>
                  <option value="bathroom">Bathroom</option>
                  <option value="closet">Closet</option>
                </select>
              </label>
            </>}
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
            <div className="scale">
              <Ruler size={14} />
              <select
                className="scale-select"
                aria-label="Drawing scale"
                value={scaleLabel.startsWith("Calibrated") ? "custom" : scaleLabel}
                onChange={(event) => event.target.value !== "custom" && applyScalePreset(event.target.value)}
              >
                <option value={'1/8" = 1\'-0"'}>1/8" = 1'-0"</option>
                <option value={'3/16" = 1\'-0"'}>3/16" = 1'-0"</option>
                <option value={'1/4" = 1\'-0"'}>1/4" = 1'-0"</option>
                <option value={'1/2" = 1\'-0"'}>1/2" = 1'-0"</option>
                <option value="custom">Custom calibrated</option>
              </select>
              {calibrating && <input className="reference-input" aria-label="Known distance in feet" type="number" min="1" value={referenceFeet} onChange={(event) => setReferenceFeet(event.target.value)} />}
              <button className={calibrating ? "calibrate active" : "calibrate"} onClick={() => { setCalibrating((value) => !value); setMeasureDraft([]); }}>
                {calibrating ? `${referenceFeet} ft · pick 2 points` : scaleLocked ? "Calibrate" : "Set scale"}
              </button>
            </div>
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
                    onPointerLeave={() => { if (!dragRef.current) { setHoverPoint(null); setSnapMarker(null); setBranchPreview(null); setSymbolPreview(null); } }}
                    onContextMenu={(event) => { event.preventDefault(); finishDrawing(); }}
                  >
                    {drawings.filter((drawing) => drawing.page === pageNumber).map((drawing) => {
                      if (drawing.measurement) {
                        const [a, b] = drawing.points;
                        const middle = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
                        return <g key={drawing.id} className={`measurement ${selectedId === drawing.id ? "selected-measurement" : ""}`} onPointerDown={(event) => {
                          if (activeTool !== "select") return;
                          event.stopPropagation();
                          setSelectedId(drawing.id);
                        }}>
                          <path className="measurement-hit" d={`M ${a.x} ${a.y} L ${b.x} ${b.y}`} />
                          <path d={`M ${a.x} ${a.y} L ${b.x} ${b.y}`} />
                          <circle cx={a.x} cy={a.y} r="3" />
                          <circle cx={b.x} cy={b.y} r="3" />
                          <text x={middle.x} y={middle.y - 8} textAnchor="middle">{drawing.measurement.feet.toFixed(1)} FT</text>
                        </g>;
                      }
                      if (drawing.symbol) return <g key={drawing.id}>{renderSymbol(drawing)}</g>;
                      if (drawing.fitting) {
                        const center = drawing.points[0];
                        const axis = drawing.fitting.angle;
                        const branchAxis = axis + drawing.fitting.side * Math.PI / 4;
                        const inlet = { x: center.x - Math.cos(axis) * 13, y: center.y - Math.sin(axis) * 13 };
                        const outlet = { x: center.x + Math.cos(axis) * 13, y: center.y + Math.sin(axis) * 13 };
                        const branchPort = { x: center.x + Math.cos(branchAxis) * 18, y: center.y + Math.sin(branchAxis) * 18 };
                        return <g
                          key={drawing.id}
                          className={`branch-fitting ${selectedId === drawing.id ? "selected-fitting" : ""}`}
                          onPointerDown={(event) => startFittingDrag(event, drawing)}
                        >
                          <circle className="fitting-hit" cx={center.x} cy={center.y} r="22" />
                          <path d={`M ${inlet.x} ${inlet.y} L ${center.x} ${center.y} L ${outlet.x} ${outlet.y} M ${center.x} ${center.y} L ${branchPort.x} ${branchPort.y}`} />
                          {[inlet, outlet, branchPort].map((port, index) => <circle className="fitting-port" key={index} cx={port.x} cy={port.y} r="3.4" />)}
                          <circle className="fitting-core" cx={center.x} cy={center.y} r="4.5" />
                          <text x={branchPort.x + 7} y={branchPort.y - 6}>{drawing.size}</text>
                        </g>;
                      }
                      const path = drawing.points.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ");
                      const middle = drawing.points[Math.floor(drawing.points.length / 2)];
                      return <g key={drawing.id} className={selectedId === drawing.id ? "selected-drawing" : ""} onPointerDown={(event) => {
                        if (activeTool !== "select") return;
                        event.stopPropagation();
                        setSelectedId(drawing.id);
                      }}>
                        <path className="hit-line" d={path} onPointerDown={(event) => startLineDrag(event, drawing)} />
                        <path className="duct-line" d={path} stroke={drawingColors[drawing.type as DrawType]} />
                        {drawing.points.map((point, index) => <circle
                          className={selectedId === drawing.id ? "edit-handle" : ""}
                          key={index}
                          cx={point.x}
                          cy={point.y}
                          r={selectedId === drawing.id ? 6 : 3.5}
                          fill={drawingColors[drawing.type as DrawType]}
                          onPointerDown={(event) => startPointDrag(event, drawing.id, index)}
                        />)}
                        <text x={middle.x + 8} y={middle.y - 8}>
                          S{drawingSystem(drawing).split("-")[1]} · {drawing.size}" · {drawingLengthFeet(drawing).toFixed(1)} LF · {runAirflow(drawing)} CFM {airflowNetwork().calculated.get(drawing.id) ? "AUTO" : ""}
                        </text>
                      </g>;
                    })}
                    {draft.length > 0 && <g className="draft-drawing">
                      <polyline points={[...draft, ...(hoverPoint ? [hoverPoint] : [])].map((point) => `${point.x},${point.y}`).join(" ")} stroke={drawingColors[activeTool as DrawType]} />
                      {draft.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r="4" fill={drawingColors[activeTool as DrawType]} />)}
                    </g>}
                    {measureDraft.length > 0 && hoverPoint && <g className="measure-preview">
                      <path d={`M ${measureDraft[0].x} ${measureDraft[0].y} L ${hoverPoint.x} ${hoverPoint.y}`} />
                      <text x={(measureDraft[0].x + hoverPoint.x) / 2} y={(measureDraft[0].y + hoverPoint.y) / 2 - 8} textAnchor="middle">
                        {calibrating ? `${referenceFeet} FT REFERENCE` : `${(Math.hypot(hoverPoint.x - measureDraft[0].x, hoverPoint.y - measureDraft[0].y) * scaleFeetPerUnit).toFixed(1)} FT`}
                      </text>
                    </g>}
                    {branchPreview && (() => {
                      const center = branchPreview.center;
                      const branchAxis = branchPreview.angle + branchPreview.side * Math.PI / 4;
                      const inlet = { x: center.x - Math.cos(branchPreview.angle) * 13, y: center.y - Math.sin(branchPreview.angle) * 13 };
                      const outlet = { x: center.x + Math.cos(branchPreview.angle) * 13, y: center.y + Math.sin(branchPreview.angle) * 13 };
                      const branchPort = { x: center.x + Math.cos(branchAxis) * 18, y: center.y + Math.sin(branchAxis) * 18 };
                      return <g className="branch-preview">
                        <circle cx={center.x} cy={center.y} r="22" />
                        <path d={`M ${inlet.x} ${inlet.y} L ${center.x} ${center.y} L ${outlet.x} ${outlet.y} M ${center.x} ${center.y} L ${branchPort.x} ${branchPort.y}`} />
                        <text x={branchPort.x + 7} y={branchPort.y - 6}>{branchPreview.parentSize}×{steppedSize(branchPreview.parentSize, 1)}×{steppedSize(branchPreview.parentSize, 2)}</text>
                      </g>;
                    })()}
                    {symbolPreview && renderSymbol({
                      id: "symbol-preview",
                      type: "symbol",
                      points: [symbolPreview.point],
                      size: "",
                      page: pageNumber,
                      symbol: {
                        kind: symbolPreview.kind,
                        rotation: 0,
                        label: {
                          diffuser: "12×12 SUPPLY",
                          returnGrille: "14×14 RETURN",
                          equipment: "SYSTEM 1 · 3 TON",
                          fan: "EF-1",
                        }[symbolPreview.kind],
                      },
                    }, true)}
                    {snapMarker && <g className="snap-marker"><circle cx={snapMarker.x} cy={snapMarker.y} r="9" /><path d={`M ${snapMarker.x - 5} ${snapMarker.y} L ${snapMarker.x + 5} ${snapMarker.y} M ${snapMarker.x} ${snapMarker.y - 5} L ${snapMarker.x} ${snapMarker.y + 5}`} /></g>}
                  </svg>
                </div>
              </div>
            ) : <div className="upload-card">
              <div className="upload-icon"><CloudUpload size={30} /></div>
              <h1>{loading ? "Opening your plan…" : "Start your HVAC plan"}</h1>
              <p>{error || "Upload a construction PDF to begin a field-ready layout."}</p>
              <div className="upload-actions">
                <button className="primary-button" disabled={loading} onClick={() => inputRef.current?.click()}><FolderOpen size={17} /> Choose PDF plan</button>
                <button className="drive-upload-button" disabled={loading} onClick={() => void openFromDrive()}><HardDrive size={17} /> Open from Drive</button>
              </div>
              <span>or drag and drop a file here</span>
              {!isDriveConfigured() && <div className="drive-setup-note">Drive button ready · Google app credentials still need to be added</div>}
              <div className="file-note"><CircleDot size={13} /> PDF up to 100 MB · Set drawing scale after upload</div>
            </div>}
          </div>
        </section>

        <aside className="right-panel">
          <div className="right-tabs">
            <button className={rightTab === "layers" ? "active" : ""} onClick={() => setRightTab("layers")}>Layers</button>
            <button className={rightTab === "rooms" ? "active" : ""} onClick={() => setRightTab("rooms")}>Rooms</button>
            <button className={rightTab === "takeoff" ? "active" : ""} onClick={() => setRightTab("takeoff")}>Takeoff</button>
            <button className={rightTab === "checks" ? "active" : ""} onClick={() => setRightTab("checks")}>Checks</button>
          </div>
          {rightTab === "layers" ? <>
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
                <div><dt>Active zone</dt><dd>{systemLabel(activeSystem)}</dd></div>
                <div><dt>Supply runs</dt><dd>{drawings.filter((drawing) => drawing.type === "supply" && drawingSystem(drawing) === activeSystem).length}</dd></div>
                <div><dt>Supply diffusers</dt><dd>{drawings.filter((drawing) => drawing.symbol?.kind === "diffuser" && drawingSystem(drawing) === activeSystem).length}</dd></div>
                <div><dt>Returns</dt><dd>{drawings.filter((drawing) => drawing.type === "return" && drawingSystem(drawing) === activeSystem).length}</dd></div>
                <div><dt>Return grilles</dt><dd>{drawings.filter((drawing) => drawing.symbol?.kind === "returnGrille" && drawingSystem(drawing) === activeSystem).length}</dd></div>
                <div><dt>Equipment</dt><dd>{drawings.filter((drawing) => drawing.symbol?.kind === "equipment" && drawingSystem(drawing) === activeSystem).length}</dd></div>
                <div><dt>Total duct length</dt><dd>{drawings.filter((drawing) => ["supply", "return", "fresh"].includes(drawing.type) && drawingSystem(drawing) === activeSystem).reduce((total, drawing) => total + drawingLengthFeet(drawing), 0).toFixed(1)} LF</dd></div>
                <div><dt>System airflow</dt><dd>{Math.max(0, ...drawings.filter((drawing) => drawing.type === "supply" && drawingSystem(drawing) === activeSystem).map((drawing) => runAirflow(drawing)))} CFM</dd></div>
                <div><dt>Connected terminals</dt><dd>{drawings.filter((drawing) => ["diffuser", "returnGrille"].includes(drawing.symbol?.kind || "") && drawingSystem(drawing) === activeSystem && airflowNetwork().terminalRun.has(drawing.id)).length}</dd></div>
              </dl>
            </div>
            <div className="system-schedule">
              <div className="section-title"><span>16-SYSTEM SCHEDULE</span><small>{systems.filter((system) => systemStats(system.id).objects).length} active</small></div>
              <div className="system-schedule-list">
                {systems.map((system) => {
                  const stats = systemStats(system.id);
                  return <button
                    className={`${activeSystem === system.id ? "active" : ""} ${stats.balanced ? "balanced" : ""}`}
                    key={system.id}
                    onClick={() => { setActiveSystem(system.id); setSelectedId(null); }}
                  >
                    <b>{system.id.replace("system-", "S")}</b>
                    <span><strong>{systemLabel(system.id)}</strong><small>{stats.units} unit · {stats.designCfm} design · {stats.supplyCfm} supply · {stats.returnCfm} return CFM</small></span>
                    <i>{stats.objects ? stats.balanced ? "OK" : "CHECK" : "EMPTY"}</i>
                  </button>;
                })}
              </div>
            </div>
          </> : rightTab === "rooms" ? <div className="rooms-panel">
            <div className="checks-heading">
              <div><strong>ROOM AIRFLOW SCHEDULE</strong><small>{systemLabel(activeSystem)} · comfort review</small></div>
              <span className="check-pill clear">{roomSchedule().length}</span>
            </div>
            {roomSchedule().length ? <div className="room-list">
              {roomSchedule().map((room) => <div className={`room-row ${room.type === "bedroom" && !room.returns ? "needs-return" : ""}`} key={room.name}>
                <div className="room-row-heading"><strong>{room.name}</strong><span>{room.type}</span></div>
                <div className="room-airflow-grid">
                  <div><span>Supply</span><b>{room.supplyCfm} CFM</b><small>{room.diffusers} diffusers</small></div>
                  <div><span>Return</span><b>{room.returnCfm} CFM</b><small>{room.returns} grilles</small></div>
                </div>
                {room.type === "bedroom" && !room.returns && <p><AlertTriangle size={12} /> Add or verify a return path for door-closed comfort.</p>}
              </div>)}
            </div> : <div className="empty-takeoff">Select a diffuser, return, or duct and enter its room name to build the room schedule.</div>}
            <div className="takeoff-note">Bedrooms are checked for an assigned return path. Final airflow still requires field balancing and room-load verification.</div>
          </div> : rightTab === "takeoff" ? <div className="takeoff-panel">
            <div className="takeoff-heading">
              <div><strong>LIVE MATERIALS</strong><small>{buildTakeoff().length} line items</small></div>
              <button onClick={() => window.print()}>Print / PDF</button>
            </div>
            {buildTakeoff().length ? <div className="takeoff-list">
              {buildTakeoff().map((row, index) => <div className="takeoff-row" key={`${row.item}-${row.size}-${index}`}>
                <div><strong>{row.item}</strong><small>{row.size} · {row.note}</small></div>
                <b>{row.quantity}</b>
              </div>)}
            </div> : <div className="empty-takeoff">Draw ductwork or place HVAC symbols to build the takeoff.</div>}
            <div className="takeoff-note">Quantities are based on the current calibrated drawing. Field-verify routing, offsets, clearances, and fabricated dimensions before ordering.</div>
          </div> : <div className="checks-panel">
            <div className="checks-heading">
              <div><strong>AIRFLOW BALANCE</strong><small>Live design-intent checks</small></div>
              <span className={`check-pill ${validationIssues().some((issue) => issue.severity === "critical") ? "critical" : validationIssues().length ? "warning" : "clear"}`}>
                {validationIssues().filter((issue) => issue.severity !== "info").length || "Clear"}
              </span>
            </div>
            <div className="auto-size-card">
              <div><Sparkles size={16} /><span><strong>SMART DUCT SIZING</strong><small>Calculated CFM · your residential size rules</small></span></div>
              <button onClick={() => setShowSizingReview((visible) => !visible)}>
                {showSizingReview ? "Close review" : `Review ${sizingSuggestions().length} changes`}
              </button>
              {showSizingReview && <div className="sizing-review">
                {sizingSuggestions().length ? <>
                  <div className="sizing-rule">16″ maximum flex · Supply ≤900 FPM · Return ≤700 FPM</div>
                  {sizingSuggestions().map((suggestion) => <button key={suggestion.id} onClick={() => { setSelectedId(suggestion.id); setActiveTool("select"); }}>
                    <span><strong>{suggestion.type.toUpperCase()} · {suggestion.cfm} CFM</strong><small>{suggestion.current}″ existing → {suggestion.recommended}″ recommended</small></span>
                    <b>{suggestion.velocity} FPM</b>
                  </button>)}
                  <button className="apply-sizing" onClick={applySizingSuggestions}>Apply {sizingSuggestions().length} reviewed changes</button>
                </> : <div className="sizing-clear"><CheckCircle2 size={17} /> Connected runs already match the sizing rules.</div>}
              </div>}
            </div>
            <div className="accessory-card">
              <div><Gauge size={16} /><span><strong>SMART FIELD ACCESSORIES</strong><small>Dampers and controls by active system</small></span></div>
              <button disabled={!missingBranchDampers().length} onClick={addMissingBranchDampers}>
                {missingBranchDampers().length ? `Add ${missingBranchDampers().length} missing branch dampers` : "All branch dampers placed"}
              </button>
              <p>New T/Y branches include a labeled, accessible volume damper automatically.</p>
            </div>
            <div className="balance-grid">
              <div><span>Design</span><strong>{designAirflow().targetCfm} CFM</strong></div>
              <div><span>Diffusers</span><strong>{designAirflow().supplyCfm} CFM</strong></div>
              <div><span>Return</span><strong>{designAirflow().returnCfm} CFM</strong></div>
              <div className="wide"><span>Connected network</span><strong>{drawings.filter((drawing) => ["diffuser", "returnGrille"].includes(drawing.symbol?.kind || "") && drawingSystem(drawing) === activeSystem && airflowNetwork().terminalRun.has(drawing.id)).length} terminals in {systemLabel(activeSystem)}</strong></div>
              <div className={Math.abs(designAirflow().difference) <= designAirflow().targetCfm * .1 && designAirflow().targetCfm ? "good" : "attention"}>
                <span>Assigned</span><strong>{designAirflow().percent}%</strong>
              </div>
            </div>
            <div className="balance-bar" aria-label={`${designAirflow().percent}% of design airflow assigned`}>
              <i style={{ width: `${Math.min(100, designAirflow().percent)}%` }} />
              <b style={{ left: `${Math.min(100, designAirflow().percent)}%` }} />
            </div>
            <div className="velocity-guide">
              <strong>RESIDENTIAL DESIGN GUIDE</strong>
              <span>Supply main 700–900 FPM</span>
              <span>Return main 500–700 FPM</span>
              <span>Flex friction target ≤0.10 in. w.g./100 ft</span>
            </div>
            <div className={`pressure-card ${pressureSummary().highestDrop > .15 ? "attention" : "good"}`}>
              <div><Gauge size={16} /><span><strong>PRESSURE-LOSS ESTIMATE</strong><small>Installed flex · bends include 8 equivalent ft each</small></span></div>
              <dl>
                <div><dt>Average friction</dt><dd>{pressureSummary().averageFriction.toFixed(2)} in. w.g./100 ft</dd></div>
                <div><dt>Highest run loss</dt><dd>{pressureSummary().highestDrop.toFixed(2)} in. w.g.</dd></div>
                <div><dt>Runs reviewed</dt><dd>{pressureSummary().runs.length}</dd></div>
              </dl>
              {pressureSummary().highestRun && <button onClick={() => { setSelectedId(pressureSummary().highestRun!.id); setActiveTool("select"); }}>
                Select highest-loss run
              </button>}
              <p>Planning estimate only. Final available static pressure requires equipment data, filters, coils, grilles, fittings, and field measurements.</p>
            </div>
            <div className="issue-list">
              {validationIssues().length ? validationIssues().map((issue, index) => (
                <button
                  className={`issue-row ${issue.severity}`}
                  key={`${issue.title}-${index}`}
                  onClick={() => issue.drawingId && (setSelectedId(issue.drawingId), setActiveTool("select"))}
                >
                  {issue.severity === "info" ? <CircleDot size={15} /> : <AlertTriangle size={15} />}
                  <span><strong>{issue.title}</strong><small>{issue.detail}</small></span>
                </button>
              )) : <div className="checks-clear"><CheckCircle2 size={24} /><strong>Plan checks clear</strong><span>Airflow is balanced within ±10% and no velocity warnings were found.</span></div>}
            </div>
            <div className="takeoff-note">Design-intent review only. Engineering objects and scheduled values govern. Field verify before fabrication and final balance.</div>
          </div>}
          <div className="status-card"><span className="pulse" /><div><strong>{calibrating && pdf ? "Scale calibration" : activeTool === "measure" && pdf ? "Measurement tool" : symbolTools.includes(activeTool as SymbolKind) && pdf ? "HVAC symbol placement" : activeTool === "branch" && pdf ? "Smart T/Y placement" : draft.length ? "Drawing in progress" : pdf ? "Construction plan loaded" : "Drawing engine ready"}</strong><small>{calibrating && pdf ? `Pick two points exactly ${referenceFeet} ft apart` : activeTool === "measure" && pdf ? "Pick two points to place a field dimension" : symbolTools.includes(activeTool as SymbolKind) && pdf ? "One click places · V selects · [ ] rotates" : activeTool === "branch" && pdf ? branchMessage || "Move over a blue supply run · one click places the fitting" : draft.length ? "Left-click: add point · Right-click: finish · Esc: cancel" : pdf ? `${pdf.numPages} page PDF · ${drawings.length} drawing objects` : "Upload a plan to start drafting"}</small></div></div>
        </aside>
      </section>

      <section className="print-takeoff">
        <div className="print-section-heading">
          <strong>MATERIAL TAKEOFF</strong>
          <span>Approximate quantities · field verify before ordering</span>
        </div>
        <table>
          <thead><tr><th>Item</th><th>Size</th><th>Quantity</th><th>Field note</th></tr></thead>
          <tbody>
            {buildTakeoff().map((row, index) => <tr key={`${row.item}-print-${index}`}>
              <td>{row.item}</td><td>{row.size}</td><td>{row.quantity}</td><td>{row.note}</td>
            </tr>)}
          </tbody>
        </table>
        <div className="field-notes">
          <strong>FIELD NOTES</strong>
          <span>Keep flex straight, fully supported, and free of kinks or sags.</span>
          <span>Install balancing dampers at branch takeoffs—not at diffusers.</span>
          <span>Verify structure, lighting, plumbing, ceiling height, and access before installation.</span>
          <span>Final duct sizes, routing, fabricated dimensions, and airflow must be field verified.</span>
        </div>
        <div className="print-checks">
          <strong>AIRFLOW & VALIDATION SUMMARY</strong>
          <div>
            <span>Design airflow: {designAirflow().targetCfm} CFM</span>
            <span>Assigned diffusers: {designAirflow().supplyCfm} CFM ({designAirflow().percent}%)</span>
            <span>Assigned return: {designAirflow().returnCfm} CFM</span>
          </div>
          {validationIssues().filter((issue) => issue.severity !== "info").map((issue, index) => <span key={`${issue.title}-print-${index}`}>• {issue.title}: {issue.detail}</span>)}
          {!validationIssues().filter((issue) => issue.severity !== "info").length && <span>✓ No critical airflow or velocity issues detected.</span>}
        </div>
      </section>

      <footer>
        <span><i className="online" /> Ready</span>
        <span>{selectedId ? "1 object selected · Ctrl+D duplicate" : "0 objects selected"}</span>
        <span><Ruler size={11} /> {scaleLabel}</span>
        <span className="footer-right">{saveState === "saving" ? "Autosaving…" : "All changes saved"} · HVAC Plan Studio v0.2.0</span>
      </footer>
    </main>
  );
}
