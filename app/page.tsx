"use client";

import { ChangeEvent, DragEvent, PointerEvent, WheelEvent as ReactWheelEvent, useCallback, useEffect, useRef, useState } from "react";
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
  Lock,
  MousePointer2,
  PanelLeftClose,
  PanelRightClose,
  Maximize2,
  Minimize2,
  FlipHorizontal2,
  X,
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
  Unlock,
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
  { id: "supply", label: "Supply duct & diffusers", tone: "blue" },
  { id: "branch", label: "Branches & fittings", tone: "yellow" },
  { id: "return", label: "Return air & grilles", tone: "red" },
  { id: "fresh", label: "Fresh air & OA controls", tone: "green" },
  { id: "notes", label: "Notes & dimensions", tone: "orange" },
] as const;
type LayerId = typeof layers[number]["id"];
const defaultVisibleLayers: Record<LayerId, boolean> = { supply: true, branch: true, return: true, fresh: true, notes: true };
const defaultLockedLayers: Record<LayerId, boolean> = { supply: false, branch: false, return: false, fresh: false, notes: false };

type Point = { x: number; y: number };
type DrawType = "supply" | "branch" | "return" | "fresh";
type SymbolKind = "diffuser" | "returnGrille" | "equipment" | "fan" | "damper" | "motorDamper" | "reducer" | "thermostat" | "smoke" | "airflow" | "note";
const symbolTools: SymbolKind[] = ["diffuser", "returnGrille", "equipment", "fan", "damper", "motorDamper", "reducer", "thermostat", "smoke", "airflow", "note"];
type SymbolPreset = {
  id: string;
  category: "Supply air" | "Return air" | "Equipment" | "Air devices" | "Controls & notes";
  kind: SymbolKind;
  label: string;
  size: string;
  cfm: number;
  variant: string;
  elevation?: string;
};
const symbolPresets: SymbolPreset[] = [
  { id: "supply-4way", category: "Supply air", kind: "diffuser", label: "4-WAY SUPPLY", size: "12×12", cfm: 225, variant: "4way", elevation: "CEILING" },
  { id: "supply-3way", category: "Supply air", kind: "diffuser", label: "3-WAY SUPPLY", size: "12×12", cfm: 200, variant: "3way", elevation: "CEILING" },
  { id: "supply-2way", category: "Supply air", kind: "diffuser", label: "2-WAY SUPPLY", size: "12×12", cfm: 175, variant: "2way", elevation: "CEILING" },
  { id: "supply-1way", category: "Supply air", kind: "diffuser", label: "1-WAY SUPPLY", size: "12×12", cfm: 150, variant: "1way", elevation: "CEILING" },
  { id: "supply-round", category: "Supply air", kind: "diffuser", label: "ROUND DIFFUSER", size: "10", cfm: 175, variant: "round", elevation: "CEILING" },
  { id: "supply-slot", category: "Supply air", kind: "diffuser", label: "LINEAR SLOT", size: "2-SLOT", cfm: 150, variant: "slot", elevation: "CEILING" },
  { id: "supply-sidewall", category: "Supply air", kind: "diffuser", label: "SIDEWALL REGISTER", size: "12×6", cfm: 175, variant: "register", elevation: "HIGH WALL" },
  { id: "supply-floor", category: "Supply air", kind: "diffuser", label: "FLOOR REGISTER", size: "4×10", cfm: 100, variant: "floor", elevation: "FLOOR" },
  { id: "return-standard", category: "Return air", kind: "returnGrille", label: "RETURN GRILLE", size: "14×14", cfm: 400, variant: "grille", elevation: "CEILING" },
  { id: "return-filter", category: "Return air", kind: "returnGrille", label: "FILTER RETURN", size: "20×20", cfm: 800, variant: "filter", elevation: "CEILING" },
  { id: "return-eggcrate", category: "Return air", kind: "returnGrille", label: "EGGCRATE RETURN", size: "14×14", cfm: 400, variant: "eggcrate", elevation: "CEILING" },
  { id: "return-door", category: "Return air", kind: "returnGrille", label: "DOOR TRANSFER GRILLE", size: "12×12", cfm: 250, variant: "transfer", elevation: "HIGH WALL" },
  { id: "return-jump", category: "Return air", kind: "returnGrille", label: "JUMP DUCT GRILLE", size: "12×12", cfm: 250, variant: "jump", elevation: "CEILING" },
  { id: "equipment-airhandler", category: "Equipment", kind: "equipment", label: "SYSTEM 1 · 3 TON AHU", size: "3 TON", cfm: 1200, variant: "air-handler" },
  { id: "equipment-furnace", category: "Equipment", kind: "equipment", label: "SYSTEM 1 · 3 TON FURNACE", size: "3 TON", cfm: 1200, variant: "furnace" },
  { id: "equipment-package", category: "Equipment", kind: "equipment", label: "SYSTEM 1 · 3 TON PACKAGE UNIT", size: "3 TON", cfm: 1200, variant: "package" },
  { id: "equipment-fancoil", category: "Equipment", kind: "equipment", label: "SYSTEM 1 · 3 TON FAN COIL", size: "3 TON", cfm: 1200, variant: "fan-coil" },
  { id: "equipment-heatpump", category: "Equipment", kind: "equipment", label: "SYSTEM 1 · 3 TON HEAT PUMP", size: "3 TON", cfm: 1200, variant: "heat-pump" },
  { id: "equipment-erv", category: "Equipment", kind: "equipment", label: "ERV-1", size: "ERV", cfm: 150, variant: "erv" },
  { id: "equipment-hrv", category: "Equipment", kind: "equipment", label: "HRV-1", size: "HRV", cfm: 150, variant: "hrv" },
  { id: "equipment-condenser", category: "Equipment", kind: "equipment", label: "CONDENSER · SYSTEM 1", size: "3 TON", cfm: 0, variant: "condenser" },
  { id: "equipment-minisplit", category: "Equipment", kind: "equipment", label: "MINI-SPLIT HEAD", size: "1 TON", cfm: 400, variant: "mini-split" },
  { id: "equipment-rtu", category: "Equipment", kind: "equipment", label: "RTU-1 · 3 TON", size: "3 TON", cfm: 1200, variant: "rtu" },
  { id: "equipment-makeup", category: "Equipment", kind: "equipment", label: "MAKE-UP AIR UNIT", size: "MAU-1", cfm: 1000, variant: "makeup-air" },
  { id: "equipment-humidifier", category: "Equipment", kind: "equipment", label: "HUMIDIFIER", size: "HUM-1", cfm: 0, variant: "humidifier" },
  { id: "equipment-dehumidifier", category: "Equipment", kind: "equipment", label: "DEHUMIDIFIER", size: "DH-1", cfm: 200, variant: "dehumidifier" },
  { id: "equipment-boiler", category: "Equipment", kind: "equipment", label: "BOILER", size: "B-1", cfm: 0, variant: "boiler" },
  { id: "device-exhaust", category: "Air devices", kind: "fan", label: "EF-1", size: "EF-1", cfm: 80, variant: "exhaust", elevation: "CEILING" },
  { id: "device-inline", category: "Air devices", kind: "fan", label: "INLINE FAN", size: "IF-1", cfm: 150, variant: "inline", elevation: "ABOVE CEILING" },
  { id: "device-damper", category: "Air devices", kind: "damper", label: "VD · ACCESSIBLE", size: "VD", cfm: 0, variant: "volume" },
  { id: "device-fire-damper", category: "Air devices", kind: "damper", label: "FIRE DAMPER", size: "FD", cfm: 0, variant: "fire" },
  { id: "device-backdraft", category: "Air devices", kind: "damper", label: "BACKDRAFT DAMPER", size: "BDD", cfm: 0, variant: "backdraft" },
  { id: "device-oa", category: "Air devices", kind: "motorDamper", label: "MOTORIZED OA DAMPER · 24V NC", size: "OA", cfm: 0, variant: "oa" },
  { id: "device-reducer", category: "Air devices", kind: "reducer", label: "REDUCER · FIELD VERIFY", size: "TRANSITION", cfm: 0, variant: "reducer" },
  { id: "control-stat", category: "Controls & notes", kind: "thermostat", label: "T-STAT", size: "24V", cfm: 0, variant: "thermostat", elevation: "48 IN AFF" },
  { id: "control-smoke", category: "Controls & notes", kind: "smoke", label: "DUCT SMOKE · BEFORE 1ST TAKEOFF", size: "SD", cfm: 0, variant: "smoke", elevation: "ABOVE CEILING" },
  { id: "control-airflow", category: "Controls & notes", kind: "airflow", label: "AIRFLOW", size: "FLOW", cfm: 0, variant: "airflow" },
  { id: "control-note", category: "Controls & notes", kind: "note", label: "FIELD VERIFY BEFORE FABRICATION", size: "NOTE", cfm: 0, variant: "note" },
];
const symbolCategories = ["Supply air", "Return air", "Equipment", "Air devices", "Controls & notes"] as const;
type SymbolMeta = {
  kind: SymbolKind;
  label: string;
  rotation: number;
  variant?: string;
};
type MeasurementMeta = {
  feet: number;
};
type FittingMeta = {
  kind: "ty";
  style?: "wye45" | "tee90";
  angle: number;
  branchAngle?: number;
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
  elevation?: string;
};
type DragState =
  | { kind: "point"; drawingId: string; pointIndex: number; before: Drawing[] }
  | { kind: "line"; drawingId: string; start: Point; original: Point[]; before: Drawing[] }
  | { kind: "fitting"; drawingId: string; start: Point; originalCenter: Point; originalPorts: Point[]; connectedIds: string[]; before: Drawing[] }
  | { kind: "symbol"; drawingId: string; before: Drawing[] }
  | { kind: "group"; start: Point; ids: string[]; originals: Record<string, Point[]>; before: Drawing[] };
type PanState = { pointerId: number; startX: number; startY: number; scrollLeft: number; scrollTop: number; moved: boolean };

type BranchPreview = {
  center: Point;
  angle: number;
  branchAngle?: number;
  side: 1 | -1;
  style?: "wye45" | "tee90";
  parentSize: string;
  valid: boolean;
  matchedExisting?: boolean;
  mainRunId?: string;
  branchRunId?: string;
};

type SavedProject = {
  version: 1 | 2;
  fileName: string;
  drawings: Drawing[];
  savedAt: string;
  scaleFeetPerUnit?: number;
  scaleLabel?: string;
  systemNames?: Record<string, string>;
  showCfmLabels?: boolean;
  showLengthLabels?: boolean;
  visibleLayers?: Partial<Record<LayerId, boolean>>;
  backgroundOpacity?: number;
  showGrid?: boolean;
  snapEnabled?: boolean;
  lockedLayers?: Partial<Record<LayerId, boolean>>;
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
  const canvasViewportRef = useRef<HTMLDivElement>(null);
  const planSheetRef = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [fileName, setFileName] = useState("Untitled HVAC Plan");
  const [pageNumber, setPageNumber] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTool, setActiveTool] = useState("select");
  const [symbolCategory, setSymbolCategory] = useState<(typeof symbolCategories)[number]>("Supply air");
  const [activePresetId, setActivePresetId] = useState("supply-4way");
  const [ductSize, setDuctSize] = useState("14");
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [undoStack, setUndoStack] = useState<Drawing[][]>([]);
  const [redoStack, setRedoStack] = useState<Drawing[][]>([]);
  const [draft, setDraft] = useState<Point[]>([]);
  const [continuingRunId, setContinuingRunId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectionBox, setSelectionBox] = useState<{ start: Point; end: Point; additive: boolean } | null>(null);
  const [renderSize, setRenderSize] = useState({ width: 0, height: 0 });
  const [hoverPoint, setHoverPoint] = useState<Point | null>(null);
  const [snapMarker, setSnapMarker] = useState<Point | null>(null);
  const [branchPreview, setBranchPreview] = useState<BranchPreview | null>(null);
  const [symbolPreview, setSymbolPreview] = useState<{ kind: SymbolKind; point: Point } | null>(null);
  const [branchMessage, setBranchMessage] = useState("");
  const [branchStyle, setBranchStyle] = useState<"auto" | "wye45" | "tee90">("auto");
  const [branchMatchChoices, setBranchMatchChoices] = useState<Record<string, string>>({});
  const [scaleFeetPerUnit, setScaleFeetPerUnit] = useState(1 / 24.3);
  const [scaleLabel, setScaleLabel] = useState('1/4" = 1\'-0"');
  const [scaleLocked, setScaleLocked] = useState(true);
  const [calibrating, setCalibrating] = useState(false);
  const [referenceFeet, setReferenceFeet] = useState("10");
  const [measureDraft, setMeasureDraft] = useState<Point[]>([]);
  const [rightTab, setRightTab] = useState<"layers" | "rooms" | "network" | "takeoff" | "checks">("layers");
  const [saveState, setSaveState] = useState<"saved" | "saving">("saved");
  const [showSizingReview, setShowSizingReview] = useState(false);
  const [showProgressionReview, setShowProgressionReview] = useState(true);
  const [showReducerReview, setShowReducerReview] = useState(true);
  const [showSheetNavigator, setShowSheetNavigator] = useState(false);
  const [fieldMode, setFieldMode] = useState(false);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [showCfmLabels, setShowCfmLabels] = useState(true);
  const [showLengthLabels, setShowLengthLabels] = useState(true);
  const [visibleLayers, setVisibleLayers] = useState<Record<LayerId, boolean>>(defaultVisibleLayers);
  const [backgroundOpacity, setBackgroundOpacity] = useState(100);
  const [showGrid, setShowGrid] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [lockedLayers, setLockedLayers] = useState<Record<LayerId, boolean>>(defaultLockedLayers);
  const [activeSystem, setActiveSystem] = useState("system-1");
  const [systemNames, setSystemNames] = useState<Record<string, string>>(defaultSystemNames);
  const dragRef = useRef<DragState | null>(null);
  const panRef = useRef<PanState | null>(null);
  const spacePanRef = useRef(false);
  const clipboardRef = useRef<Drawing | null>(null);

  useEffect(() => {
    setSelectedIds((current) => {
      if (!selectedId) return [];
      return current.includes(selectedId) ? current : [selectedId];
    });
  }, [selectedId]);

  function selectOnly(id: string | null) {
    setSelectedId(id);
    setSelectedIds(id ? [id] : []);
  }

  function toggleSelection(id: string) {
    setSelectedIds((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      setSelectedId(next.at(-1) || null);
      return next;
    });
  }

  function isSelected(id: string) {
    return selectedIds.includes(id);
  }

  function connectedSelection(seedIds: string[]) {
    const expanded = new Set(seedIds);
    let changed = true;
    while (changed) {
      changed = false;
      drawings.forEach((drawing) => {
        if (!drawing.fitting) return;
        const linked = [drawing.id, ...drawing.fitting.connectedIds];
        if (linked.some((id) => expanded.has(id))) {
          linked.forEach((id) => {
            if (!expanded.has(id)) {
              expanded.add(id);
              changed = true;
            }
          });
        }
      });
    }
    return [...expanded];
  }

  function drawingSystem(drawing?: Drawing) {
    return drawing?.systemId || "system-1";
  }

  function drawingLayer(drawing: Drawing): LayerId | null {
    if (drawing.type === "supply" || drawing.symbol?.kind === "diffuser") return "supply";
    if (drawing.type === "branch" || ["damper", "reducer"].includes(drawing.symbol?.kind || "")) return "branch";
    if (drawing.type === "return" || drawing.symbol?.kind === "returnGrille") return "return";
    if (drawing.type === "fresh" || drawing.symbol?.kind === "motorDamper") return "fresh";
    if (drawing.type === "measurement" || ["note", "thermostat", "smoke", "airflow"].includes(drawing.symbol?.kind || "")) return "notes";
    return null;
  }

  function drawingLocked(drawing?: Drawing) {
    if (!drawing) return false;
    const layer = drawingLayer(drawing);
    return Boolean(layer && lockedLayers[layer]);
  }

  function toggleLayerLock(layerId: LayerId) {
    const willLock = !lockedLayers[layerId];
    setLockedLayers((current) => ({ ...current, [layerId]: willLock }));
    const selected = drawings.find((drawing) => drawing.id === selectedId);
    if (willLock && selected && drawingLayer(selected) === layerId) setSelectedId(null);
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
      const restoredDrawings = Array.isArray(project.drawings) ? project.drawings : [];
      setDrawings(synchronizeFittingSizes(restoredDrawings, restoredDrawings));
      setScaleFeetPerUnit(project.scaleFeetPerUnit || 1 / 24.3);
      setScaleLabel(project.scaleLabel || '1/4" = 1\'-0"');
      setSystemNames({ ...defaultSystemNames, ...(project.systemNames || {}) });
      setShowCfmLabels(project.showCfmLabels ?? true);
      setShowLengthLabels(project.showLengthLabels ?? true);
      setVisibleLayers({ ...defaultVisibleLayers, ...(project.visibleLayers || {}) });
      setBackgroundOpacity(project.backgroundOpacity ?? 100);
      setShowGrid(project.showGrid ?? true);
      setSnapEnabled(project.snapEnabled ?? true);
      setLockedLayers({ ...defaultLockedLayers, ...(project.lockedLayers || {}) });
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

  function centerPlan() {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const viewport = canvasViewportRef.current;
      if (!viewport) return;
      viewport.scrollTo({
        left: Math.max(0, (viewport.scrollWidth - viewport.clientWidth) / 2),
        top: Math.max(0, (viewport.scrollHeight - viewport.clientHeight) / 2),
        behavior: "smooth",
      });
    }));
  }

  function applyViewportZoom(nextZoom: number) {
    setZoom(Math.max(.35, Math.min(4, +nextZoom.toFixed(2))));
    centerPlan();
  }

  function fitPage() {
    const viewport = canvasViewportRef.current;
    if (!viewport || !renderSize.width || !renderSize.height) return;
    const availableWidth = Math.max(100, viewport.clientWidth - 110);
    const availableHeight = Math.max(100, viewport.clientHeight - 110);
    applyViewportZoom(Math.min(availableWidth / renderSize.width, availableHeight / renderSize.height));
  }

  function fitWidth() {
    const viewport = canvasViewportRef.current;
    if (!viewport || !renderSize.width) return;
    applyViewportZoom(Math.max(100, viewport.clientWidth - 110) / renderSize.width);
  }

  function zoomAtPoint(nextZoom: number, clientX: number, clientY: number) {
    const viewport = canvasViewportRef.current;
    const sheet = planSheetRef.current;
    if (!viewport || !sheet || nextZoom === zoom) return;
    const sheetBounds = sheet.getBoundingClientRect();
    const xRatio = Math.max(0, Math.min(1, (clientX - sheetBounds.left) / Math.max(1, sheetBounds.width)));
    const yRatio = Math.max(0, Math.min(1, (clientY - sheetBounds.top) / Math.max(1, sheetBounds.height)));
    setZoom(nextZoom);
    requestAnimationFrame(() => {
      const nextSheet = planSheetRef.current?.getBoundingClientRect();
      if (!nextSheet) return;
      viewport.scrollLeft += nextSheet.left + nextSheet.width * xRatio - clientX;
      viewport.scrollTop += nextSheet.top + nextSheet.height * yRatio - clientY;
    });
  }

  function handleWheelZoom(event: ReactWheelEvent<HTMLDivElement>) {
    if (!pdf) return;
    event.preventDefault();
    const direction = event.deltaY < 0 ? 1 : -1;
    const step = event.ctrlKey ? .2 : .12;
    const nextZoom = Math.max(.35, Math.min(4, +(zoom + direction * step).toFixed(2)));
    zoomAtPoint(nextZoom, event.clientX, event.clientY);
  }

  function startPlanPan(event: PointerEvent<HTMLDivElement>) {
    const panButton = event.button === 2 || (event.button === 0 && spacePanRef.current);
    if (!pdf || !panButton || draft.length) return;
    const viewport = canvasViewportRef.current;
    if (!viewport) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    panRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop,
      moved: false,
    };
    viewport.classList.add("panning");
  }

  function movePlanPan(event: PointerEvent<HTMLDivElement>) {
    const pan = panRef.current;
    const viewport = canvasViewportRef.current;
    if (!pan || !viewport || pan.pointerId !== event.pointerId) return;
    const dx = event.clientX - pan.startX;
    const dy = event.clientY - pan.startY;
    pan.moved ||= Math.hypot(dx, dy) > 3;
    viewport.scrollLeft = pan.scrollLeft - dx;
    viewport.scrollTop = pan.scrollTop - dy;
  }

  function endPlanPan(event: PointerEvent<HTMLDivElement>) {
    if (!panRef.current || panRef.current.pointerId !== event.pointerId) return;
    canvasViewportRef.current?.classList.remove("panning");
    panRef.current = null;
  }

  function goToPage(page: number) {
    if (!pdf) return;
    setPageNumber(Math.max(1, Math.min(pdf.numPages, page)));
    canvasViewportRef.current?.scrollTo({ left: 0, top: 0 });
  }

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
      showCfmLabels,
      showLengthLabels,
      visibleLayers,
      backgroundOpacity,
      showGrid,
      snapEnabled,
      lockedLayers,
    };
    localStorage.setItem(`${STORAGE_PREFIX}${fileName.toLowerCase()}`, JSON.stringify(project));
    setSaveState("saved");
  }, [backgroundOpacity, drawings, fileName, lockedLayers, pdf, scaleFeetPerUnit, scaleLabel, showCfmLabels, showGrid, showLengthLabels, snapEnabled, systemNames, visibleLayers]);

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

  function orientMainTowardAirflow<T extends NonNullable<ReturnType<typeof nearestSupplySegment>>>(target: T) {
    const equipment = drawings.filter((drawing) =>
      drawing.page === pageNumber &&
      drawing.symbol?.kind === "equipment" &&
      drawingSystem(drawing) === activeSystem
    );
    if (!equipment.length) return { ...target, points: target.drawing.points, reversed: false };
    const distanceToEquipment = (point: Point) => Math.min(...equipment.map((unit) =>
      Math.hypot(point.x - unit.points[0].x, point.y - unit.points[0].y)));
    const first = target.drawing.points[0];
    const last = target.drawing.points[target.drawing.points.length - 1];
    const reversed = distanceToEquipment(last) < distanceToEquipment(first);
    if (!reversed) return { ...target, points: target.drawing.points, reversed: false };
    return {
      ...target,
      points: [...target.drawing.points].reverse(),
      segmentIndex: target.drawing.points.length - 2 - target.segmentIndex,
      angle: target.angle + Math.PI,
      side: (target.side === 1 ? -1 : 1) as 1 | -1,
      reversed: true,
    };
  }

  function existingBranchRoute(center: Point, mainId: string, mainAngle: number) {
    let best: { drawing: Drawing; points: Point[]; angle: number; side: 1 | -1; distance: number } | null = null;
    for (const drawing of drawings) {
      if (
        drawing.id === mainId ||
        drawing.page !== pageNumber ||
        drawing.type !== "supply" ||
        drawing.fitting ||
        drawing.symbol ||
        drawingSystem(drawing) !== activeSystem
      ) continue;
      for (let index = 0; index < drawing.points.length - 1; index++) {
        const a = drawing.points[index];
        const b = drawing.points[index + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const lengthSquared = dx * dx + dy * dy;
        if (!lengthSquared) continue;
        const amount = Math.max(0, Math.min(1, ((center.x - a.x) * dx + (center.y - a.y) * dy) / lengthSquared));
        const projected = { x: a.x + amount * dx, y: a.y + amount * dy };
        const distance = Math.hypot(center.x - projected.x, center.y - projected.y);
        if (distance > 40 / zoom) continue;

        const towardEnd = cleanPoints([center, projected, ...drawing.points.slice(index + 1)]);
        const towardStart = cleanPoints([center, projected, ...drawing.points.slice(0, index + 1).reverse()]);
        const candidates = [towardEnd, towardStart].filter((points) => points.length >= 2);
        for (const points of candidates) {
          const vector = points.find((point) => Math.hypot(point.x - center.x, point.y - center.y) > 2);
          if (!vector) continue;
          const angle = Math.atan2(vector.y - center.y, vector.x - center.x);
          const divergence = Math.abs(Math.sin(angle - mainAngle));
          if (divergence < .22) continue;
          const cross = Math.cos(mainAngle) * Math.sin(angle) - Math.sin(mainAngle) * Math.cos(angle);
          const side: 1 | -1 = cross >= 0 ? 1 : -1;
          const score = distance - divergence * 8;
          if (!best || score < best.distance) best = { drawing, points, angle, side, distance: score };
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

  function automaticBranchStyle(mainAngle: number, branchAngle: number): "wye45" | "tee90" {
    const difference = Math.abs(Math.atan2(Math.sin(branchAngle - mainAngle), Math.cos(branchAngle - mainAngle)));
    const acute = Math.min(difference, Math.PI - difference);
    return acute > Math.PI * .375 ? "tee90" : "wye45";
  }

  function fittingPortPoints(fitting: Drawing, center = fitting.points[0]) {
    if (!fitting.fitting) return [center, center, center];
    const axis = fitting.fitting.angle;
    const branchAxis = fitting.fitting.branchAngle ?? axis + fitting.fitting.side * (fitting.fitting.style === "tee90" ? Math.PI / 2 : Math.PI / 4);
    const reach = (size: string, base: number) => Math.max(14, Math.min(27, base + (Number(size) || 8) * .38));
    const inletReach = reach(fitting.fitting.upstreamSize, 12);
    const outletReach = reach(fitting.fitting.downstreamSize, 13);
    const branchReach = reach(fitting.fitting.branchSize, 16);
    return [
      { x: center.x - Math.cos(axis) * inletReach, y: center.y - Math.sin(axis) * inletReach },
      { x: center.x + Math.cos(axis) * outletReach, y: center.y + Math.sin(axis) * outletReach },
      { x: center.x + Math.cos(branchAxis) * branchReach, y: center.y + Math.sin(branchAxis) * branchReach },
    ];
  }

  function fittingLegWidth(size: string) {
    return Math.max(5.5, Math.min(10, 4.5 + (Number(size) || 8) * .3));
  }

  function snapRunsToFittingPorts(drawingsToSnap: Drawing[], fitting: Drawing, previousFitting = fitting) {
    if (!fitting.fitting || !previousFitting.fitting) return drawingsToSnap;
    const oldPorts = fittingPortPoints(previousFitting);
    const newPorts = fittingPortPoints(fitting);
    return drawingsToSnap.map((drawing) => {
      const port = fitting.fitting!.connectedIds.indexOf(drawing.id);
      if (port < 0 || drawing.points.length < 2) return drawing;
      const oldPort = oldPorts[port];
      const firstDistance = Math.min(
        Math.hypot(drawing.points[0].x - oldPort.x, drawing.points[0].y - oldPort.y),
        Math.hypot(drawing.points[0].x - previousFitting.points[0].x, drawing.points[0].y - previousFitting.points[0].y),
      );
      const lastIndex = drawing.points.length - 1;
      const lastDistance = Math.min(
        Math.hypot(drawing.points[lastIndex].x - oldPort.x, drawing.points[lastIndex].y - oldPort.y),
        Math.hypot(drawing.points[lastIndex].x - previousFitting.points[0].x, drawing.points[lastIndex].y - previousFitting.points[0].y),
      );
      const points = [...drawing.points];
      points[firstDistance <= lastDistance ? 0 : lastIndex] = newPorts[port];
      return { ...drawing, points };
    });
  }

  function synchronizeFittingSizes(nextDrawings: Drawing[], previousDrawings = drawings) {
    let synchronized = nextDrawings;
    for (const previousFitting of previousDrawings.filter((drawing) => drawing.fitting)) {
      const fitting = synchronized.find((drawing) => drawing.id === previousFitting.id);
      if (!fitting?.fitting) continue;
      const connected = fitting.fitting.connectedIds.map((id) => synchronized.find((drawing) => drawing.id === id));
      const [upstreamSize, downstreamSize, branchSize] = connected.map((run, index) =>
        run?.size || [fitting.fitting!.upstreamSize, fitting.fitting!.downstreamSize, fitting.fitting!.branchSize][index]);
      const updatedFitting: Drawing = {
        ...fitting,
        size: `${upstreamSize}×${downstreamSize}×${branchSize}`,
        fitting: { ...fitting.fitting, upstreamSize, downstreamSize, branchSize },
      };
      synchronized = synchronized.map((drawing) => drawing.id === fitting.id ? updatedFitting : drawing);
      synchronized = snapRunsToFittingPorts(synchronized, updatedFitting, previousFitting);
    }
    return synchronized;
  }

  function reattachFittingIn(drawingsToRepair: Drawing[], fittingId: string) {
    const fitting = drawingsToRepair.find((drawing) => drawing.id === fittingId && drawing.fitting);
    if (!fitting?.fitting) return { drawings: drawingsToRepair, connected: 0 };
    const center = fitting.points[0];
    const expectedAngles = [
      fitting.fitting.angle + Math.PI,
      fitting.fitting.angle,
      fitting.fitting.branchAngle ?? fitting.fitting.angle + fitting.fitting.side * Math.PI / 4,
    ];
    const ports = fittingPortPoints(fitting);
    const available = drawingsToRepair.filter((drawing) =>
      drawing.page === fitting.page &&
      drawing.type === "supply" &&
      !drawing.fitting &&
      drawingSystem(drawing) === drawingSystem(fitting)
    );
    const used = new Set<string>();
    const connectedIds: string[] = [];
    const endpointChanges = new Map<string, 0 | -1>();

    expectedAngles.forEach((expectedAngle, port) => {
      let best: { drawing: Drawing; endpoint: 0 | -1; score: number } | null = null;
      for (const run of available) {
        if (used.has(run.id) || run.points.length < 2) continue;
        for (const endpoint of [0, -1] as const) {
          const point = endpoint === 0 ? run.points[0] : run.points[run.points.length - 1];
          const neighbor = endpoint === 0 ? run.points[1] : run.points[run.points.length - 2];
          const portPoint = ports[port];
          const distance = Math.hypot(point.x - portPoint.x, point.y - portPoint.y);
          if (distance > 48 / zoom) continue;
          const runAngle = Math.atan2(neighbor.y - point.y, neighbor.x - point.x);
          const angleError = Math.abs(Math.atan2(Math.sin(runAngle - expectedAngle), Math.cos(runAngle - expectedAngle)));
          const isOriginal = fitting.fitting!.connectedIds[port] === run.id;
          const score = distance + angleError * 12 - (isOriginal ? 16 : 0);
          if (!best || score < best.score) best = { drawing: run, endpoint, score };
        }
      }
      if (best) {
        used.add(best.drawing.id);
        connectedIds[port] = best.drawing.id;
        endpointChanges.set(best.drawing.id, best.endpoint);
      } else {
        connectedIds[port] = fitting.fitting!.connectedIds[port];
      }
    });

    const repaired = drawingsToRepair.map((drawing) => {
      if (drawing.id === fitting.id) {
        const branchRun = available.find((run) => run.id === connectedIds[2]);
        const branchEndpoint = branchRun && endpointChanges.get(branchRun.id);
        const neighbor = branchRun
          ? branchEndpoint === 0 ? branchRun.points[1] : branchRun.points[branchRun.points.length - 2]
          : null;
        const branchPort = ports[2];
        const branchAngle = neighbor ? Math.atan2(neighbor.y - branchPort.y, neighbor.x - branchPort.x) : drawing.fitting!.branchAngle;
        const style = branchAngle == null ? drawing.fitting!.style : automaticBranchStyle(drawing.fitting!.angle, branchAngle);
        const updated = { ...drawing, fitting: { ...drawing.fitting!, connectedIds, branchAngle, style } };
        const updatedPorts = fittingPortPoints(updated);
        ports.splice(0, ports.length, ...updatedPorts);
        return updated;
      }
      const endpoint = endpointChanges.get(drawing.id);
      if (endpoint == null) return drawing;
      const points = [...drawing.points];
      const port = connectedIds.findIndex((id) => id === drawing.id);
      const portPoint = ports[Math.max(0, port)] || center;
      if (endpoint === 0) points[0] = portPoint;
      else points[points.length - 1] = portPoint;
      return { ...drawing, points };
    });
    return { drawings: repaired, connected: endpointChanges.size };
  }

  function reattachSelectedFitting() {
    const selected = drawings.find((drawing) => drawing.id === selectedId && drawing.fitting);
    if (!selected) return;
    const repaired = reattachFittingIn(drawings, selected.id);
    setHistory(repaired.drawings);
    setBranchMessage(repaired.connected === 3
      ? "All 3 fitting ports reattached"
      : `${repaired.connected} of 3 ports found · move the fitting closer and try again`);
  }

  function repairFittingsAfterRunEdit(drawingsToRepair: Drawing[], changedRunId: string) {
    const changedRun = drawingsToRepair.find((drawing) => drawing.id === changedRunId);
    if (!changedRun) return { drawings: drawingsToRepair, repaired: 0 };
    let next = drawingsToRepair;
    let repaired = 0;
    const fittings = drawingsToRepair.filter((drawing) =>
      drawing.fitting &&
      drawing.page === changedRun.page &&
      drawingSystem(drawing) === drawingSystem(changedRun) &&
      (drawing.fitting.connectedIds.includes(changedRunId) ||
        changedRun.points.some((point) => Math.hypot(point.x - drawing.points[0].x, point.y - drawing.points[0].y) <= 60 / zoom))
    );
    for (const fitting of fittings) {
      const result = reattachFittingIn(next, fitting.id);
      next = result.drawings;
      if (result.connected === 3) repaired += 1;
    }
    return { drawings: next, repaired };
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

  function branchNetworkTrace(fitting?: Drawing) {
    const runIds = new Set<string>();
    const fittingIds = new Set<string>();
    if (!fitting?.fitting) {
      return { runIds, fittingIds, totalCfm: 0, runCount: 0, fittingCount: 0 };
    }

    const network = airflowNetwork();
    const rootRunId = fitting.fitting.connectedIds[0];
    const pending = [rootRunId];
    while (pending.length) {
      const runId = pending.shift()!;
      if (runIds.has(runId)) continue;
      runIds.add(runId);
      (network.children.get(runId) || []).forEach((childId) => pending.push(childId));
    }

    drawings
      .filter((drawing) => drawing.fitting && runIds.has(drawing.fitting.connectedIds[0]))
      .forEach((drawing) => fittingIds.add(drawing.id));

    const rootRun = drawings.find((drawing) => drawing.id === rootRunId);
    const totalCfm = network.calculated.get(rootRunId) || (rootRun ? runAirflow(rootRun) : 0);
    return {
      runIds,
      fittingIds,
      totalCfm,
      runCount: runIds.size,
      fittingCount: fittingIds.size,
    };
  }

  function branchNetworkConnectionHealth(fitting?: Drawing) {
    if (!fitting?.fitting) return { attached: 0, detached: 0, missing: 0, total: 0 };
    const trace = branchNetworkTrace(fitting);
    let attached = 0;
    let detached = 0;
    let missing = 0;
    for (const fittingId of trace.fittingIds) {
      const networkFitting = drawings.find((drawing) => drawing.id === fittingId && drawing.fitting);
      if (!networkFitting?.fitting) continue;
      const ports = fittingPortPoints(networkFitting);
      networkFitting.fitting.connectedIds.forEach((runId, port) => {
        const run = drawings.find((drawing) => drawing.id === runId);
        if (!run) {
          missing += 1;
          return;
        }
        const endpoints = [run.points[0], run.points[run.points.length - 1]];
        if (endpoints.some((endpoint) => Math.hypot(endpoint.x - ports[port].x, endpoint.y - ports[port].y) < 2)) attached += 1;
        else detached += 1;
      });
    }
    return { attached, detached, missing, total: attached + detached + missing };
  }

  function branchNetworkRepairPreview(fitting?: Drawing) {
    const detached: Array<{ id: string; endpoint: Point; portPoint: Point; port: number }> = [];
    const missing: Array<{
      id: string;
      fittingId: string;
      portPoint: Point;
      port: number;
      candidates: Array<{
        key: string;
        runId: string;
        endpoint: Point;
        endpointIndex: number;
        distance: number;
        angleError: number;
        size: string;
        destination: string;
      }>;
      candidate?: {
        key: string;
        runId: string;
        endpoint: Point;
        endpointIndex: number;
        distance: number;
        angleError: number;
        size: string;
        destination: string;
      };
    }> = [];
    if (!fitting?.fitting) return { detached, missing };
    const trace = branchNetworkTrace(fitting);
    const usedCandidates = new Set<string>();
    for (const fittingId of trace.fittingIds) {
      const networkFitting = drawings.find((drawing) => drawing.id === fittingId && drawing.fitting);
      if (!networkFitting?.fitting) continue;
      const ports = fittingPortPoints(networkFitting);
      networkFitting.fitting.connectedIds.forEach((runId, port) => {
        const run = drawings.find((drawing) => drawing.id === runId);
        if (!run) {
          const expectedAngle = [
            networkFitting.fitting!.angle + Math.PI,
            networkFitting.fitting!.angle,
            networkFitting.fitting!.branchAngle ?? networkFitting.fitting!.angle + networkFitting.fitting!.side * Math.PI / 4,
          ][port];
          const candidates = drawings
            .filter((candidate) =>
              candidate.page === networkFitting.page &&
              candidate.type === "supply" &&
              !candidate.fitting &&
              candidate.points.length >= 2 &&
              drawingSystem(candidate) === drawingSystem(networkFitting) &&
              !networkFitting.fitting!.connectedIds.includes(candidate.id))
            .flatMap((candidate) => [0, candidate.points.length - 1].map((endpointIndex) => {
              const endpoint = candidate.points[endpointIndex];
              const neighbor = endpointIndex === 0 ? candidate.points[1] : candidate.points[candidate.points.length - 2];
              const distance = Math.hypot(endpoint.x - ports[port].x, endpoint.y - ports[port].y);
              const runAngle = Math.atan2(neighbor.y - endpoint.y, neighbor.x - endpoint.x);
              const angleError = Math.abs(Math.atan2(Math.sin(runAngle - expectedAngle), Math.cos(runAngle - expectedAngle)));
              return {
                key: `${candidate.id}:${endpointIndex}`,
                runId: candidate.id,
                endpoint,
                endpointIndex,
                distance,
                angleError,
                size: candidate.size,
                destination: candidate.roomName?.trim() || "Unassigned room",
                score: distance + angleError * 12,
              };
            }))
            .filter((candidate) => candidate.distance <= 48 / zoom && !usedCandidates.has(`${candidate.runId}-${candidate.endpointIndex}`))
            .sort((a, b) => a.score - b.score)
            .slice(0, 3);
          const missingId = `${fittingId}-${port}`;
          const chosenKey = branchMatchChoices[missingId];
          const candidate = candidates.length === 1 ? candidates[0] : candidates.find((item) => item.key === chosenKey);
          if (candidate) usedCandidates.add(`${candidate.runId}-${candidate.endpointIndex}`);
          missing.push({
            id: missingId,
            fittingId,
            portPoint: ports[port],
            port,
            candidates: candidates.map(({ score: _score, ...item }) => item),
            candidate: candidate ? {
              key: candidate.key,
              runId: candidate.runId,
              endpoint: candidate.endpoint,
              endpointIndex: candidate.endpointIndex,
              distance: candidate.distance,
              angleError: candidate.angleError,
              size: candidate.size,
              destination: candidate.destination,
            } : undefined,
          });
          return;
        }
        const endpoints = [run.points[0], run.points[run.points.length - 1]];
        const endpoint = endpoints
          .map((point) => ({ point, distance: Math.hypot(point.x - ports[port].x, point.y - ports[port].y) }))
          .sort((a, b) => a.distance - b.distance)[0];
        if (endpoint.distance >= 2) detached.push({ id: `${fittingId}-${runId}-${port}`, endpoint: endpoint.point, portPoint: ports[port], port });
      });
    }
    return { detached, missing };
  }

  function reconnectMissingBranchRuns() {
    const selected = drawings.find((drawing) => drawing.id === selectedId && drawing.fitting);
    if (!selected?.fitting) return;
    const proposals = branchNetworkRepairPreview(selected).missing.filter((item) => item.candidate);
    if (!proposals.length) {
      setBranchMessage("No existing nearby runs match the missing network ports");
      return;
    }
    const next = drawings.map((drawing) => ({
      ...drawing,
      points: drawing.points.map((point) => ({ ...point })),
      fitting: drawing.fitting ? { ...drawing.fitting, connectedIds: [...drawing.fitting.connectedIds] } : undefined,
    }));
    let connected = 0;
    proposals.forEach((proposal) => {
      const candidate = proposal.candidate!;
      const fitting = next.find((drawing) => drawing.id === proposal.fittingId && drawing.fitting);
      const run = next.find((drawing) => drawing.id === candidate.runId && !drawing.fitting);
      if (!fitting?.fitting || !run) return;
      const key = ["upstreamSize", "downstreamSize", "branchSize"][proposal.port] as "upstreamSize" | "downstreamSize" | "branchSize";
      fitting.fitting.connectedIds[proposal.port] = run.id;
      fitting.fitting[key] = run.size;
      fitting.size = `${fitting.fitting.upstreamSize}×${fitting.fitting.downstreamSize}×${fitting.fitting.branchSize}`;
      run.points[candidate.endpointIndex] = proposal.portPoint;
      connected += 1;
    });
    if (!connected) return;
    setHistory(next);
    setBranchMessage(`${connected} existing run${connected === 1 ? "" : "s"} reconnected to missing ports · no new duct created`);
  }

  function repairSelectedBranchNetworkConnections() {
    const selected = drawings.find((drawing) => drawing.id === selectedId && drawing.fitting);
    if (!selected?.fitting) return;
    const trace = branchNetworkTrace(selected);
    const next = drawings.map((drawing) => ({
      ...drawing,
      points: drawing.points.map((point) => ({ ...point })),
      fitting: drawing.fitting ? { ...drawing.fitting, connectedIds: [...drawing.fitting.connectedIds] } : undefined,
    }));
    const usedEndpoints = new Map<string, Set<number>>();
    let repaired = 0;

    for (const fittingId of trace.fittingIds) {
      const fitting = next.find((drawing) => drawing.id === fittingId && drawing.fitting);
      if (!fitting?.fitting) continue;
      const ports = fittingPortPoints(fitting);
      fitting.fitting.connectedIds.forEach((runId, port) => {
        const run = next.find((drawing) => drawing.id === runId);
        if (!run || run.points.length < 2) return;
        const alreadyUsed = usedEndpoints.get(runId) || new Set<number>();
        const endpointChoices = [0, run.points.length - 1]
          .filter((index) => !alreadyUsed.has(index))
          .map((index) => ({
            index,
            distance: Math.hypot(run.points[index].x - ports[port].x, run.points[index].y - ports[port].y),
          }))
          .sort((a, b) => a.distance - b.distance);
        const choice = endpointChoices[0];
        if (!choice) return;
        alreadyUsed.add(choice.index);
        usedEndpoints.set(runId, alreadyUsed);
        if (choice.distance >= 2) {
          run.points[choice.index] = ports[port];
          repaired += 1;
        }
      });
    }

    if (!repaired) {
      setBranchMessage("Connected branch network ports are already aligned");
      return;
    }
    setHistory(next);
    setBranchMessage(`${repaired} network port${repaired === 1 ? "" : "s"} repaired in one step · routes and sizes preserved`);
  }

  function ductNetworkTrace(run?: Drawing) {
    const runIds = new Set<string>();
    const fittingIds = new Set<string>();
    if (!run || run.fitting || !["supply", "return", "fresh"].includes(run.type)) {
      return { runIds, fittingIds, totalCfm: 0, runCount: 0, fittingCount: 0, terminalCount: 0, sourceConnected: false };
    }

    const network = airflowNetwork();
    const parents = new Map<string, string[]>();
    network.children.forEach((childIds, parentId) => {
      childIds.forEach((childId) => parents.set(childId, [...(parents.get(childId) || []), parentId]));
    });

    const pending = [run.id];
    while (pending.length) {
      const runId = pending.shift()!;
      if (runIds.has(runId)) continue;
      runIds.add(runId);
      (network.children.get(runId) || []).forEach((childId) => pending.push(childId));
      (parents.get(runId) || []).forEach((parentId) => pending.push(parentId));
    }

    drawings
      .filter((drawing) => drawing.fitting?.connectedIds.some((id) => runIds.has(id)))
      .forEach((drawing) => fittingIds.add(drawing.id));

    const terminalCount = [...network.terminalRun.values()].filter((runId) => runIds.has(runId)).length;
    const sourceConnected = [...network.equipmentRun.values()].some((runId) => runIds.has(runId));
    return {
      runIds,
      fittingIds,
      totalCfm: runAirflow(run),
      runCount: runIds.size,
      fittingCount: fittingIds.size,
      terminalCount,
      sourceConnected,
    };
  }

  function runAttachmentStatus(run?: Drawing) {
    if (!run || run.fitting || !["supply", "return", "fresh"].includes(run.type)) {
      return { attached: 0, detached: 0, nearbyOpen: 0 };
    }
    let attached = 0;
    let detached = 0;
    let nearbyOpen = 0;
    const endpoints = [run.points[0], run.points[run.points.length - 1]];
    for (const fitting of drawings.filter((drawing) => drawing.fitting && drawing.page === run.page && drawingSystem(drawing) === drawingSystem(run))) {
      const ports = fittingPortPoints(fitting);
      fitting.fitting!.connectedIds.forEach((connectedId, port) => {
        if (connectedId === run.id) {
          const connected = endpoints.some((endpoint) => Math.hypot(endpoint.x - ports[port].x, endpoint.y - ports[port].y) < 2);
          if (connected) attached += 1;
          else detached += 1;
          return;
        }
        if (drawings.some((drawing) => drawing.id === connectedId)) return;
        if (endpoints.some((endpoint) => Math.hypot(endpoint.x - ports[port].x, endpoint.y - ports[port].y) <= 36 / zoom)) nearbyOpen += 1;
      });
    }
    return { attached, detached, nearbyOpen };
  }

  function repairSelectedRunConnections() {
    const run = drawings.find((drawing) => drawing.id === selectedId && !drawing.fitting && ["supply", "return", "fresh"].includes(drawing.type));
    if (!run) return;
    let next = drawings.map((drawing) => ({ ...drawing, points: drawing.points.map((point) => ({ ...point })), fitting: drawing.fitting ? { ...drawing.fitting, connectedIds: [...drawing.fitting.connectedIds] } : undefined }));
    let repaired = 0;
    const usedEndpoints = new Set<number>();

    for (const fitting of next.filter((drawing) => drawing.fitting?.connectedIds.includes(run.id))) {
      const ports = fittingPortPoints(fitting);
      fitting.fitting!.connectedIds.forEach((connectedId, port) => {
        if (connectedId !== run.id) return;
        const liveRun = next.find((drawing) => drawing.id === run.id)!;
        const endpointChoices = [0, liveRun.points.length - 1]
          .filter((index) => !usedEndpoints.has(index))
          .map((index) => ({ index, distance: Math.hypot(liveRun.points[index].x - ports[port].x, liveRun.points[index].y - ports[port].y) }))
          .sort((a, b) => a.distance - b.distance);
        const choice = endpointChoices[0];
        if (!choice) return;
        usedEndpoints.add(choice.index);
        if (choice.distance >= 2) repaired += 1;
        liveRun.points[choice.index] = ports[port];
      });
    }

    const liveRun = next.find((drawing) => drawing.id === run.id)!;
    const candidates = next
      .filter((drawing) => drawing.fitting && drawing.page === run.page && drawingSystem(drawing) === drawingSystem(run) && !drawing.fitting!.connectedIds.includes(run.id))
      .flatMap((fitting) => fittingPortPoints(fitting).map((portPoint, port) => ({ fitting, portPoint, port })))
      .filter(({ fitting, port }) => !next.some((drawing) => drawing.id === fitting.fitting!.connectedIds[port]))
      .flatMap((candidate) => [0, liveRun.points.length - 1].map((endpointIndex) => ({
        ...candidate,
        endpointIndex,
        distance: Math.hypot(liveRun.points[endpointIndex].x - candidate.portPoint.x, liveRun.points[endpointIndex].y - candidate.portPoint.y),
      })))
      .filter((candidate) => candidate.distance <= 36 / zoom && !usedEndpoints.has(candidate.endpointIndex))
      .sort((a, b) => a.distance - b.distance);

    for (const candidate of candidates) {
      if (usedEndpoints.has(candidate.endpointIndex) || candidate.fitting.fitting!.connectedIds.includes(run.id)) continue;
      const key = ["upstreamSize", "downstreamSize", "branchSize"][candidate.port] as "upstreamSize" | "downstreamSize" | "branchSize";
      candidate.fitting.fitting!.connectedIds[candidate.port] = run.id;
      candidate.fitting.fitting![key] = run.size;
      candidate.fitting.size = `${candidate.fitting.fitting!.upstreamSize}×${candidate.fitting.fitting!.downstreamSize}×${candidate.fitting.fitting!.branchSize}`;
      liveRun.points[candidate.endpointIndex] = candidate.portPoint;
      usedEndpoints.add(candidate.endpointIndex);
      repaired += 1;
    }

    if (!repaired) {
      setBranchMessage("Selected run connections are already aligned");
      return;
    }
    setHistory(next);
    setBranchMessage(`${repaired} duct connection${repaired === 1 ? "" : "s"} repaired · fitting ports and run sizes preserved`);
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

  function reducerRecommendations() {
    return sizingSuggestions().flatMap((suggestion) => {
      const run = drawings.find((drawing) => drawing.id === suggestion.id);
      if (!run || run.points.length < 2) return [];
      const parentFitting = drawings.find((drawing) =>
        drawing.fitting &&
        drawingSystem(drawing) === activeSystem &&
        drawing.fitting.connectedIds.slice(1).includes(run.id)
      );
      const parentPort = parentFitting?.fitting
        ? parentFitting.fitting.connectedIds[1] === run.id ? 1 : 2
        : null;
      const anchor = parentFitting && parentPort != null ? fittingPortPoints(parentFitting)[parentPort] : run.points[0];
      const firstDistance = Math.hypot(run.points[0].x - anchor.x, run.points[0].y - anchor.y);
      const lastIndex = run.points.length - 1;
      const lastDistance = Math.hypot(run.points[lastIndex].x - anchor.x, run.points[lastIndex].y - anchor.y);
      const endpointIndex = firstDistance <= lastDistance ? 0 : lastIndex;
      const neighborIndex = endpointIndex === 0 ? 1 : lastIndex - 1;
      const endpoint = run.points[endpointIndex];
      const neighbor = run.points[neighborIndex];
      const length = Math.hypot(neighbor.x - endpoint.x, neighbor.y - endpoint.y) || 1;
      const location = {
        x: endpoint.x + (neighbor.x - endpoint.x) / length * Math.min(14, length * .45),
        y: endpoint.y + (neighbor.y - endpoint.y) / length * Math.min(14, length * .45),
      };
      const existing = drawings.some((drawing) =>
        drawing.symbol?.kind === "reducer" &&
        drawing.page === run.page &&
        drawingSystem(drawing) === drawingSystem(run) &&
        Math.hypot(drawing.points[0].x - location.x, drawing.points[0].y - location.y) <= 24
      );
      if (existing) return [];
      const reducing = Number(suggestion.current) > Number(suggestion.recommended);
      return [{
        ...suggestion,
        run,
        location,
        rotation: Math.round(Math.atan2(neighbor.y - endpoint.y, neighbor.x - endpoint.x) * 180 / Math.PI),
        parentFittingId: parentFitting?.id,
        reducing,
        currentVelocity: velocityFpm(suggestion.current, suggestion.cfm),
      }];
    });
  }

  function placeRecommendedReducer(recommendation: ReturnType<typeof reducerRecommendations>[number]) {
    const label = `${recommendation.reducing ? "REDUCER" : "TRANSITION"} · ${recommendation.current}″×${recommendation.recommended}″`;
    const symbol: Drawing = {
      id: crypto.randomUUID(),
      type: "symbol",
      points: [recommendation.location],
      size: `${recommendation.current}×${recommendation.recommended}`,
      page: recommendation.run.page,
      systemId: drawingSystem(recommendation.run),
      roomName: recommendation.run.roomName,
      roomType: recommendation.run.roomType,
      elevation: recommendation.run.elevation,
      cfm: recommendation.cfm,
      symbol: {
        kind: "reducer",
        label,
        rotation: recommendation.rotation,
        variant: "reducer",
      },
    };
    setHistory([...drawings, symbol]);
    setSelectedId(symbol.id);
    setActiveTool("select");
    setBranchMessage(`${label} placed for review · connected duct sizes were not changed`);
  }

  function sizeProgressionIssues() {
    const sizeOrder = ["16", "14", "12", "10", "8", "7", "6", "4"];
    const sizeIndex = (size: string) => {
      const exact = sizeOrder.indexOf(size);
      if (exact >= 0) return exact;
      const numeric = Number(size);
      return numeric ? sizeOrder.findIndex((candidate) => Number(candidate) <= numeric) : -1;
    };
    const issues: Array<{
      id: string;
      fittingId: string;
      severity: "critical" | "warning";
      title: string;
      detail: string;
    }> = [];

    for (const fitting of drawings.filter((drawing) => drawing.fitting && drawingSystem(drawing) === activeSystem)) {
      const meta = fitting.fitting!;
      const ports = [
        { label: "straight outlet", size: meta.downstreamSize, runId: meta.connectedIds[1] },
        { label: "branch outlet", size: meta.branchSize, runId: meta.connectedIds[2] },
      ];
      const inlet = Number(meta.upstreamSize);
      const inletIndex = sizeIndex(meta.upstreamSize);

      for (const port of ports) {
        const outlet = Number(port.size);
        const outletIndex = sizeIndex(port.size);
        const run = drawings.find((drawing) => drawing.id === port.runId);
        const destination = run?.roomName?.trim() ? ` toward ${run.roomName.trim()}` : "";
        if (inlet && outlet && outlet > inlet) {
          issues.push({
            id: `${fitting.id}-${port.label}-larger`,
            fittingId: fitting.id,
            severity: "critical",
            title: `${port.label} grows after the split`,
            detail: `${meta.upstreamSize}″ inlet → ${port.size}″ ${port.label}${destination}. Verify airflow direction or resize manually.`,
          });
          continue;
        }
        if (inletIndex >= 0 && outletIndex >= 0 && outletIndex - inletIndex > 2) {
          issues.push({
            id: `${fitting.id}-${port.label}-drop`,
            fittingId: fitting.id,
            severity: "warning",
            title: `Aggressive ${port.label} reduction`,
            detail: `${meta.upstreamSize}″ inlet → ${port.size}″ ${port.label}${destination}. Review the transition and connected CFM before fabrication.`,
          });
        }
      }

      const inletRun = drawings.find((drawing) => drawing.id === meta.connectedIds[0]);
      const outletRuns = meta.connectedIds.slice(1).map((id) => drawings.find((drawing) => drawing.id === id));
      if (!inletRun || outletRuns.some((run) => !run)) continue;
      const inletCfm = runAirflow(inletRun);
      const outletCfm = outletRuns.reduce((total, run) => total + (run ? runAirflow(run) : 0), 0);
      if (inletCfm && outletCfm && Math.abs(inletCfm - outletCfm) > Math.max(25, inletCfm * .1)) {
        issues.push({
          id: `${fitting.id}-cfm`,
          fittingId: fitting.id,
          severity: "warning",
          title: "Branch airflow does not reconcile",
          detail: `${inletCfm} CFM enters, but ${outletCfm} CFM is assigned downstream. Review terminal CFM and connections.`,
        });
      }
    }
    return issues;
  }

  function applySizingSuggestions() {
    const proposed = new Map(sizingSuggestions().map((suggestion) => [suggestion.id, suggestion.recommended]));
    if (!proposed.size) {
      setShowSizingReview(false);
      return;
    }
    const resized = drawings.map((drawing) => {
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
    });
    setHistory(synchronizeFittingSizes(resized, drawings));
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

  function networkBalanceRows() {
    const network = airflowNetwork();
    const equipment = drawings.filter((drawing) => drawing.symbol?.kind === "equipment" && drawingSystem(drawing) === activeSystem);
    const returnCfm = drawings
      .filter((drawing) => drawing.symbol?.kind === "returnGrille" && drawingSystem(drawing) === activeSystem)
      .reduce((total, drawing) => total + (drawing.cfm || 0), 0);

    return equipment.map((unit) => {
      const rootRunId = network.equipmentRun.get(unit.id);
      const runIds = new Set<string>();
      if (rootRunId) {
        const pending = [rootRunId];
        while (pending.length) {
          const runId = pending.shift()!;
          if (runIds.has(runId)) continue;
          runIds.add(runId);
          pending.push(...(network.children.get(runId) || []));
        }
      }
      const fittingRows = drawings.filter((drawing) =>
        drawing.fitting &&
        drawingSystem(drawing) === activeSystem &&
        runIds.has(drawing.fitting.connectedIds[0])
      );
      const terminalCount = drawings.filter((drawing) =>
        drawing.symbol?.kind === "diffuser" &&
        drawingSystem(drawing) === activeSystem &&
        runIds.has(network.terminalRun.get(drawing.id) || "")
      ).length;
      let detachedPorts = 0;
      let missingPorts = 0;
      let overloadedPorts = 0;
      let firstConnectionProblemId: string | undefined;
      for (const fitting of fittingRows) {
        const ports = fittingPortPoints(fitting);
        fitting.fitting!.connectedIds.forEach((runId, port) => {
          const run = drawings.find((drawing) => drawing.id === runId);
          if (!run) {
            missingPorts += 1;
            firstConnectionProblemId ||= fitting.id;
            return;
          }
          const endpoints = [run.points[0], run.points[run.points.length - 1]];
          if (!endpoints.some((point) => Math.hypot(point.x - ports[port].x, point.y - ports[port].y) < 2)) {
            detachedPorts += 1;
            firstConnectionProblemId ||= fitting.id;
          }
          if (fittingPortState(fitting, port as 0 | 1 | 2).overloaded) {
            overloadedPorts += 1;
            firstConnectionProblemId ||= fitting.id;
          }
        });
      }
      const progression = sizeProgressionIssues().filter((issue) => fittingRows.some((fitting) => fitting.id === issue.fittingId));
      const firstProblemFittingId = firstConnectionProblemId || progression[0]?.fittingId;
      const tons = Number(unit.size.match(/[\d.]+/)?.[0] || 0);
      const designCfm = unit.cfm || tons * 400;
      const assignedCfm = rootRunId ? network.calculated.get(rootRunId) || 0 : 0;
      const remainingCfm = designCfm - assignedCfm;
      const problemCount = detachedPorts + missingPorts + overloadedPorts + progression.length;
      const balanced = Boolean(rootRunId && designCfm && Math.abs(remainingCfm) <= designCfm * .1 && problemCount === 0);
      return {
        unit,
        rootRunId,
        designCfm,
        assignedCfm,
        remainingCfm,
        returnCfm,
        runCount: runIds.size,
        fittingCount: fittingRows.length,
        terminalCount,
        detachedPorts,
        missingPorts,
        overloadedPorts,
        progressionCount: progression.length,
        problemCount,
        firstProblemFittingId,
        percent: designCfm ? Math.round(assignedCfm / designCfm * 100) : 0,
        balanced,
      };
    });
  }

  function roomSchedule() {
    const rooms = new Map<string, {
      name: string;
      type: Drawing["roomType"];
      supplyCfm: number;
      returnCfm: number;
      diffusers: number;
      returns: number;
      drawingIds: string[];
      missingCfm: number;
    }>();
    for (const drawing of drawings.filter((item) => drawingSystem(item) === activeSystem && item.roomName?.trim())) {
      const name = drawing.roomName!.trim();
      const key = name.toLowerCase();
      const current = rooms.get(key) || {
        name,
        type: drawing.roomType || "general",
        supplyCfm: 0,
        returnCfm: 0,
        diffusers: 0,
        returns: 0,
        drawingIds: [],
        missingCfm: 0,
      };
      current.drawingIds.push(drawing.id);
      if (drawing.symbol?.kind === "diffuser") {
        current.supplyCfm += drawing.cfm || 0;
        current.diffusers += 1;
        if (!drawing.cfm) current.missingCfm += 1;
      }
      if (drawing.symbol?.kind === "returnGrille") {
        current.returnCfm += drawing.cfm || 0;
        current.returns += 1;
        if (!drawing.cfm) current.missingCfm += 1;
      }
      if (drawing.roomType && drawing.roomType !== "general") current.type = drawing.roomType;
      rooms.set(key, current);
    }
    return [...rooms.values()]
      .map((room) => ({
        ...room,
        balanceCfm: room.supplyCfm - room.returnCfm,
        needsReturn: room.type === "bedroom" && room.supplyCfm > 0 && room.returns === 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  function roomScheduleSummary() {
    const rooms = roomSchedule();
    const bedrooms = rooms.filter((room) => room.type === "bedroom");
    return {
      supplyCfm: rooms.reduce((total, room) => total + room.supplyCfm, 0),
      returnCfm: rooms.reduce((total, room) => total + room.returnCfm, 0),
      bedrooms: bedrooms.length,
      bedroomsWithReturn: bedrooms.filter((room) => room.returns > 0).length,
      missingCfm: rooms.reduce((total, room) => total + room.missingCfm, 0),
    };
  }

  function exportRoomScheduleCsv() {
    const rows = roomSchedule();
    if (!rows.length) return;
    const quote = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const csv = [
      ["System", "Room", "Type", "Supply CFM", "Return CFM", "Room Balance CFM", "Diffusers", "Return Grilles", "Return Path", "Missing CFM Entries"],
      ...rows.map((room) => [
        systemLabel(activeSystem),
        room.name,
        room.type || "general",
        room.supplyCfm,
        room.returnCfm,
        room.balanceCfm,
        room.diffusers,
        room.returns,
        room.needsReturn ? "REVIEW" : "OK",
        room.missingCfm,
      ]),
    ].map((row) => row.map(quote).join(",")).join("\n");
    const link = document.createElement("a");
    const objectUrl = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.href = objectUrl;
    link.download = `${systemLabel(activeSystem).replaceAll(" ", "-").toLowerCase()}-room-airflow.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
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
      const attachment = runAttachmentStatus(drawing);
      if (attachment.detached) issues.push({
        severity: "warning",
        title: "Duct pulled away from fitting",
        detail: `${attachment.detached} associated T/Y port${attachment.detached === 1 ? " is" : "s are"} no longer aligned. Select the run and use Repair nearby connections.`,
        drawingId: drawing.id,
      });
    }
    for (const fitting of drawings.filter((drawing) => drawing.fitting && drawingSystem(drawing) === activeSystem)) {
      ([0, 1, 2] as const).forEach((port) => {
        const state = fittingPortState(fitting, port);
        if (state.overloaded) issues.push({
          severity: "warning",
          title: "Branch fitting leg undersized",
          detail: `Port ${port + 1} carries ${state.cfm} CFM and should increase to ${state.recommended}".`,
          drawingId: fitting.id,
        });
      });
    }
    for (const progression of sizeProgressionIssues()) {
      issues.push({
        severity: progression.severity,
        title: progression.title,
        detail: progression.detail,
        drawingId: progression.fittingId,
      });
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
    const runsWithoutElevation = activeRuns.filter((drawing) => !drawing.elevation?.trim());
    if (runsWithoutElevation.length) issues.push({
      severity: "warning",
      title: "Duct elevations need coordination",
      detail: `${runsWithoutElevation.length} ${runsWithoutElevation.length === 1 ? "run has" : "runs have"} no installation height. Set AFF, above-ceiling, or field-verify elevation before release.`,
      drawingId: runsWithoutElevation[0].id,
    });
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
    const rawTarget = nearestSupplySegment(point);
    if (!rawTarget || rawTarget.distance > 42 / zoom) {
      setBranchMessage("Move closer to a blue supply run");
      return;
    }
    const target = orientMainTowardAirflow(rawTarget);

    const center = target.point;
    const matchedRoute = existingBranchRoute(center, target.drawing.id, target.angle);
    if (!matchedRoute) {
      setBranchMessage("No crossing route found · move the fitting closer to both existing runs");
      return;
    }
    const downstreamSize = steppedSize(target.drawing.size, 1);
    const branchSize = matchedRoute.drawing.size;
    const downstreamId = crypto.randomUUID();
    const fittingId = crypto.randomUUID();
    const fittingSide = matchedRoute.side;
    const branchAngle = matchedRoute.angle;
    const resolvedStyle = branchStyle === "auto" ? automaticBranchStyle(target.angle, branchAngle) : branchStyle;
    const temporaryFitting: Drawing = {
      id: "branch-port-preview",
      type: "branch",
      points: [center],
      size: "",
      page: pageNumber,
      fitting: {
        kind: "ty",
        style: resolvedStyle,
        angle: target.angle,
        branchAngle,
        side: fittingSide,
        upstreamSize: target.drawing.size,
        downstreamSize,
        branchSize,
        connectedIds: [],
      },
    };
    const [inletPort, outletPort, branchPort] = fittingPortPoints(temporaryFitting);
    const upstreamPoints = cleanPoints([...target.points.slice(0, target.segmentIndex + 1), inletPort]);
    const downstreamPoints = cleanPoints([outletPort, ...target.points.slice(target.segmentIndex + 1)]);
    if (upstreamPoints.length < 2 || downstreamPoints.length < 2) {
      setBranchMessage("Place the fitting farther from the end of the run");
      return;
    }

    const upstream: Drawing = { ...target.drawing, points: upstreamPoints, cfm: target.drawing.cfm || defaultCfm(target.drawing.size) };
    const downstream: Drawing = {
      ...target.drawing,
      id: downstreamId,
      points: downstreamPoints,
      size: downstreamSize,
      cfm: defaultCfm(downstreamSize),
    };
    const branchRun: Drawing = {
      ...matchedRoute.drawing,
      points: cleanPoints([branchPort, ...matchedRoute.points.slice(1)]),
    };
    const fitting: Drawing = {
      id: fittingId,
      type: "branch",
      points: [center],
      size: `${target.drawing.size}×${downstreamSize}×${branchSize}`,
      page: pageNumber,
      systemId: drawingSystem(target.drawing),
      elevation: target.drawing.elevation,
      fitting: {
        kind: "ty",
        style: resolvedStyle,
        angle: target.angle,
        branchAngle,
        side: fittingSide,
        upstreamSize: target.drawing.size,
        downstreamSize,
        branchSize,
        connectedIds: [upstream.id, downstream.id, branchRun.id],
      },
    };
    setHistory([
      ...drawings.filter((drawing) => drawing.id !== target.drawing.id && drawing.id !== matchedRoute.drawing.id),
      upstream,
      downstream,
      branchRun,
      fitting,
    ]);
    setSelectedId(fittingId);
    setBranchMessage(`${resolvedStyle === "tee90" ? "90° tee" : "45° wye"} inserted · 3 existing runs connected`);
  }

  function updateFittingPortSize(port: 0 | 1 | 2, size: string) {
    const fitting = drawings.find((drawing) => drawing.id === selectedId && drawing.fitting);
    if (!fitting?.fitting) return;
    const keys = ["upstreamSize", "downstreamSize", "branchSize"] as const;
    const connectedId = fitting.fitting.connectedIds[port];
    const updatedMeta = { ...fitting.fitting, [keys[port]]: size };
    const inlet = drawings.find((drawing) => drawing.id === fitting.fitting!.connectedIds[0]);
    const inletCfm = inlet?.cfm || defaultCfm(updatedMeta.upstreamSize);
    const outletArea = Number(updatedMeta.downstreamSize) ** 2;
    const branchArea = Number(updatedMeta.branchSize) ** 2;
    const totalArea = Math.max(1, outletArea + branchArea);
    const resized = drawings.map((drawing) => {
      if (drawing.id === fitting.id) return {
        ...drawing,
        size: `${updatedMeta.upstreamSize}×${updatedMeta.downstreamSize}×${updatedMeta.branchSize}`,
        fitting: updatedMeta,
      };
      if (drawing.id === connectedId) {
        if (port === 0) return { ...drawing, size, cfm: defaultCfm(size) };
        return { ...drawing, size, cfm: Math.round(inletCfm * (port === 1 ? outletArea : branchArea) / totalArea / 5) * 5 };
      }
      if (port !== 0 && drawing.id === fitting.fitting!.connectedIds[port === 1 ? 2 : 1]) {
        const otherArea = port === 1 ? branchArea : outletArea;
        return { ...drawing, cfm: Math.round(inletCfm * otherArea / totalArea / 5) * 5 };
      }
      return drawing;
    });
    setHistory(synchronizeFittingSizes(resized, drawings));
  }

  function fittingPortState(fitting: Drawing, port: 0 | 1 | 2) {
    const run = drawings.find((drawing) => drawing.id === fitting.fitting?.connectedIds[port]);
    if (!run) return { connected: false, overloaded: false, cfm: 0, recommended: "" };
    const portPoint = fittingPortPoints(fitting)[port];
    const connected = run.points.some((point) => Math.hypot(point.x - portPoint.x, point.y - portPoint.y) < 2);
    const cfm = runAirflow(run);
    const recommended = recommendedDuctSize(cfm, "supply");
    return { connected, overloaded: Number(recommended) > Number(run.size), cfm, recommended };
  }

  function rebalanceSelectedFitting() {
    const fitting = drawings.find((drawing) => drawing.id === selectedId && drawing.fitting);
    if (!fitting?.fitting) return;
    const [inletId, outletId, branchId] = fitting.fitting.connectedIds;
    const inlet = drawings.find((drawing) => drawing.id === inletId);
    const outlet = drawings.find((drawing) => drawing.id === outletId);
    const branch = drawings.find((drawing) => drawing.id === branchId);
    if (!outlet || !branch) return;
    const inletCfm = inlet?.cfm || defaultCfm(fitting.fitting.upstreamSize);
    const outletArea = Number(outlet.size) ** 2;
    const branchArea = Number(branch.size) ** 2;
    const totalArea = Math.max(1, outletArea + branchArea);
    setHistory(drawings.map((drawing) => {
      if (drawing.id === outletId) return { ...drawing, cfm: Math.round(inletCfm * outletArea / totalArea / 5) * 5 };
      if (drawing.id === branchId) return { ...drawing, cfm: Math.round(inletCfm * branchArea / totalArea / 5) * 5 };
      return drawing;
    }));
  }

  function autoSizeSelectedBranchNetwork() {
    const fitting = drawings.find((drawing) => drawing.id === selectedId && drawing.fitting);
    if (!fitting?.fitting) return;
    const network = airflowNetwork();
    const rootRunId = fitting.fitting.connectedIds[0];
    const connectedRunIds = new Set<string>();
    const queue = [rootRunId];
    while (queue.length) {
      const runId = queue.shift()!;
      if (connectedRunIds.has(runId)) continue;
      connectedRunIds.add(runId);
      queue.push(...(network.children.get(runId) || []));
    }
    let changes = 0;
    const resized = drawings.map((drawing) => {
      if (!connectedRunIds.has(drawing.id) || drawing.fitting || drawing.type !== "supply") return drawing;
      const calculatedCfm = network.calculated.get(drawing.id) || drawing.cfm || 0;
      if (!calculatedCfm) return drawing;
      const recommended = recommendedDuctSize(calculatedCfm, "supply");
      if (recommended === drawing.size) return drawing;
      changes += 1;
      return { ...drawing, size: recommended, cfm: calculatedCfm };
    });
    if (!changes) {
      setBranchMessage("Connected branch network already matches calculated CFM");
      return;
    }
    setHistory(synchronizeFittingSizes(resized, drawings));
    setBranchMessage(`${changes} connected run${changes === 1 ? "" : "s"} resized · all T/Y ports kept attached`);
  }

  function reshapeSelectedFitting(nextStyle: "wye45" | "tee90", nextSide?: 1 | -1) {
    const fitting = drawings.find((drawing) => drawing.id === selectedId && drawing.fitting);
    if (!fitting?.fitting) return;
    const side = nextSide || fitting.fitting.side;
    const oldStyle = fitting.fitting.style || "wye45";
    const oldAxis = fitting.fitting.branchAngle ?? fitting.fitting.angle + fitting.fitting.side * (oldStyle === "tee90" ? Math.PI / 2 : Math.PI / 4);
    const newAxis = fitting.fitting.angle + side * (nextStyle === "tee90" ? Math.PI / 2 : Math.PI / 4);
    const delta = newAxis - oldAxis;
    const center = fitting.points[0];
    const branchId = fitting.fitting.connectedIds[2];
    setHistory(drawings.map((drawing) => {
      if (drawing.id === fitting.id) return { ...drawing, fitting: { ...fitting.fitting!, style: nextStyle, side, branchAngle: newAxis } };
      if (drawing.id !== branchId) return drawing;
      return {
        ...drawing,
        points: drawing.points.map((point) => {
          const dx = point.x - center.x;
          const dy = point.y - center.y;
          return {
            x: center.x + dx * Math.cos(delta) - dy * Math.sin(delta),
            y: center.y + dx * Math.sin(delta) + dy * Math.cos(delta),
          };
        }),
      };
    }));
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
    const preset = symbolPresets.find((item) => item.id === activePresetId && item.kind === kind);
    const selectedDefaults = preset || defaults[kind];
    const snapped = snapPoint(point);
    const symbol: Drawing = {
      id: crypto.randomUUID(),
      type: "symbol",
      points: [snapped],
      size: selectedDefaults.size,
      page: pageNumber,
      systemId: activeSystem,
      cfm: selectedDefaults.cfm,
      elevation: preset?.elevation || (["diffuser", "returnGrille", "fan"].includes(kind)
        ? "CEILING"
        : kind === "thermostat"
          ? "48 IN AFF"
          : kind === "smoke"
            ? "ABOVE CEILING"
            : ""),
      symbol: {
        kind,
        label: selectedDefaults.label,
        rotation: 0,
        variant: preset?.variant,
      },
    };
    setHistory([...drawings, symbol]);
    setSelectedId(symbol.id);
  }

  function snapPoint(point: Point, ignoredId?: string) {
    if (!snapEnabled) return point;
    const nearbyFitting = drawings
      .filter((drawing) => drawing.page === pageNumber && drawing.id !== ignoredId && drawing.fitting)
      .map((drawing) => ({ point: drawing.points[0], distance: Math.hypot(point.x - drawing.points[0].x, point.y - drawing.points[0].y) }))
      .sort((a, b) => a.distance - b.distance)[0];
    if (nearbyFitting && nearbyFitting.distance <= 26 / zoom) return nearbyFitting.point;
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

  function constrainToDraftAngle(origin: Point, point: Point) {
    const dx = point.x - origin.x;
    const dy = point.y - origin.y;
    const distance = Math.hypot(dx, dy);
    if (!distance) return point;
    const step = Math.PI / 4;
    const angle = Math.round(Math.atan2(dy, dx) / step) * step;
    return { x: origin.x + Math.cos(angle) * distance, y: origin.y + Math.sin(angle) * distance };
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
      const continuing = continuingRunId ? drawings.find((drawing) => drawing.id === continuingRunId) : null;
      if (continuing) {
        const startsAtFirst = Math.hypot(continuing.points[0].x - draft[0].x, continuing.points[0].y - draft[0].y) < 2;
        const extendedPoints = startsAtFirst
          ? [...draft.slice(1).reverse(), ...continuing.points]
          : [...continuing.points, ...draft.slice(1)];
        setHistory(drawings.map((drawing) => drawing.id === continuing.id ? { ...drawing, points: cleanPoints(extendedPoints) } : drawing));
      } else {
        const drawing: Drawing = {
          id: crypto.randomUUID(),
          type: activeTool as DrawType,
          points: draft,
          size: ductSize,
          page: pageNumber,
          cfm: defaultCfm(ductSize),
          systemId: activeSystem,
          elevation: "",
        };
        const connected = addJunctionPoints(drawings, [draft[0], draft[draft.length - 1]]);
        setHistory([...connected, drawing]);
      }
    }
    setContinuingRunId(null);
    setDraft([]);
    setHoverPoint(null);
    setSnapMarker(null);
  }

  function continueFittingOutlet(port: 1 | 2) {
    const fitting = drawings.find((drawing) => drawing.id === selectedId && drawing.fitting);
    if (!fitting?.fitting) return;
    const run = drawings.find((drawing) => drawing.id === fitting.fitting!.connectedIds[port]);
    if (!run) return;
    const portPoint = fittingPortPoints(fitting)[port];
    const firstDistance = Math.hypot(run.points[0].x - portPoint.x, run.points[0].y - portPoint.y);
    const last = run.points[run.points.length - 1];
    const lastDistance = Math.hypot(last.x - portPoint.x, last.y - portPoint.y);
    const endpoint = firstDistance > lastDistance ? run.points[0] : last;
    setActiveTool(run.type);
    setActiveSystem(drawingSystem(run));
    setDuctSize(run.size);
    setDraft([endpoint]);
    setContinuingRunId(run.id);
    setSelectedId(run.id);
    setBranchMessage(`Extending Outlet ${port === 1 ? "A" : "B"} · left-click points · right-click to finish`);
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
    if (event.button !== 0 || spacePanRef.current) return;
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
      event.currentTarget.setPointerCapture(event.pointerId);
      setSelectionBox({ start: rawPoint, end: rawPoint, additive: event.shiftKey });
      if (!event.shiftKey) selectOnly(null);
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
    let point = snapPoint(rawPoint);
    if (event.shiftKey && draft.length) point = constrainToDraftAngle(draft[draft.length - 1], point);
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
    if (selectedIds.length > 1) {
      const ids = connectedSelection(selectedIds).filter((id) => !drawingLocked(drawings.find((drawing) => drawing.id === id)));
      setHistory(drawings.filter((drawing) => !ids.includes(drawing.id)));
      selectOnly(null);
      setBranchMessage(`${ids.length} connected objects deleted · undo restores the full group`);
      return;
    }
    const selected = drawings.find((drawing) => drawing.id === selectedId);
    if (drawingLocked(selected)) return;
    if (selected?.fitting) {
      removeFittingAndHeal(selected);
      return;
    }
    setHistory(drawings.filter((drawing) => drawing.id !== selectedId));
    setSelectedId(null);
  }

  function removeFittingAndHeal(fitting: Drawing) {
    if (!fitting.fitting) return;
    const [inletPort, outletPort] = fittingPortPoints(fitting);
    const [upstreamId, downstreamId, branchId] = fitting.fitting.connectedIds;
    const upstream = drawings.find((drawing) => drawing.id === upstreamId);
    const downstream = drawings.find((drawing) => drawing.id === downstreamId);
    if (!upstream || !downstream) {
      setBranchMessage("Cannot heal main run · reconnect all 3 ports first");
      return;
    }
    const upstreamEndsAtPort = Math.hypot(
      upstream.points[upstream.points.length - 1].x - inletPort.x,
      upstream.points[upstream.points.length - 1].y - inletPort.y,
    ) < 2;
    const downstreamStartsAtPort = Math.hypot(
      downstream.points[0].x - outletPort.x,
      downstream.points[0].y - outletPort.y,
    ) < 2;
    const upstreamPoints = upstreamEndsAtPort ? upstream.points : [...upstream.points].reverse();
    const downstreamPoints = downstreamStartsAtPort ? downstream.points : [...downstream.points].reverse();
    const healedMain: Drawing = {
      ...upstream,
      points: cleanPoints([...upstreamPoints.slice(0, -1), ...downstreamPoints]),
      size: fitting.fitting.upstreamSize,
      cfm: upstream.cfm || defaultCfm(fitting.fitting.upstreamSize),
    };
    setHistory([
      ...drawings.filter((drawing) =>
        drawing.id !== fitting.id &&
        drawing.id !== upstreamId &&
        drawing.id !== downstreamId
      ),
      healedMain,
    ]);
    setSelectedId(branchId);
    setActiveTool("select");
    setBranchMessage("Fitting removed · main run healed · branch route kept for reinsertion");
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
    if (selectedIds.length > 1) {
      const ids = connectedSelection(selectedIds);
      const originals = drawings.filter((drawing) => ids.includes(drawing.id));
      const idMap = new Map(originals.map((drawing) => [drawing.id, crypto.randomUUID()]));
      const duplicates = originals.map((drawing) => ({
        ...structuredClone(drawing),
        id: idMap.get(drawing.id)!,
        page: pageNumber,
        points: drawing.points.map((point) => ({ x: point.x + 18, y: point.y + 18 })),
        fitting: drawing.fitting ? {
          ...structuredClone(drawing.fitting),
          connectedIds: drawing.fitting.connectedIds.map((id) => idMap.get(id) || id),
        } : undefined,
      }));
      setHistory([...drawings, ...duplicates]);
      const nextIds = duplicates.map((drawing) => drawing.id);
      setSelectedIds(nextIds);
      setSelectedId(nextIds.at(-1) || null);
      setBranchMessage(`${duplicates.length} connected objects duplicated · T/Y ports preserved`);
      return;
    }
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

  function mirrorSelectedHorizontal() {
    if (!selectedIds.length) return;
    const ids = connectedSelection(selectedIds);
    const affected = drawings.filter((drawing) => ids.includes(drawing.id));
    if (!affected.length || affected.some(drawingLocked)) return;
    const xs = affected.flatMap((drawing) => drawing.points.map((point) => point.x));
    const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
    setHistory(drawings.map((drawing) => {
      if (!ids.includes(drawing.id)) return drawing;
      return {
        ...drawing,
        points: drawing.points.map((point) => ({ ...point, x: centerX * 2 - point.x })),
        fitting: drawing.fitting ? {
          ...drawing.fitting,
          angle: Math.PI - drawing.fitting.angle,
          branchAngle: drawing.fitting.branchAngle === undefined ? undefined : Math.PI - drawing.fitting.branchAngle,
          side: drawing.fitting.side === 1 ? -1 : 1,
        } : undefined,
        symbol: drawing.symbol ? {
          ...drawing.symbol,
          rotation: (360 - drawing.symbol.rotation) % 360,
        } : undefined,
      };
    }));
    setBranchMessage(`${ids.length} connected object${ids.length === 1 ? "" : "s"} mirrored · network relationships preserved`);
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
      const resized = drawings.map((drawing) => {
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
      });
      setHistory(synchronizeFittingSizes(resized, drawings));
    } else {
      const resized = drawings.map((drawing) => drawing.id === selectedId ? { ...drawing, size, cfm: defaultCfm(size) } : drawing);
      setHistory(synchronizeFittingSizes(resized, drawings));
    }
    setDuctSize(size);
  }

  function updateSelectedCfm(cfm: number) {
    if (!selectedId || !Number.isFinite(cfm)) return;
    setHistory(drawings.map((drawing) => drawing.id === selectedId ? { ...drawing, cfm: Math.max(0, cfm) } : drawing));
  }

  function updateEquipmentTonnage(tons: number) {
    if (!selectedId || !Number.isFinite(tons)) return;
    setHistory(drawings.map((drawing) => {
      if (drawing.id !== selectedId || drawing.symbol?.kind !== "equipment") return drawing;
      return {
        ...drawing,
        size: `${tons} TON`,
        cfm: Math.round(tons * 400),
        symbol: {
          ...drawing.symbol,
          label: `${systemLabel(drawingSystem(drawing)).toUpperCase()} · ${tons} TON`,
        },
      };
    }));
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

  function updateSelectedElevation(elevation: string) {
    if (!selectedId) return;
    const selected = drawings.find((drawing) => drawing.id === selectedId);
    const affected = new Set([selectedId, ...(selected?.fitting?.connectedIds || [])]);
    setHistory(drawings.map((drawing) => affected.has(drawing.id) ? { ...drawing, elevation } : drawing));
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
    if (activeTool !== "select" || event.button !== 0 || spacePanRef.current || drawingLocked(drawings.find((drawing) => drawing.id === drawingId))) return;
    event.stopPropagation();
    if (event.shiftKey) {
      toggleSelection(drawingId);
      return;
    }
    if (selectedIds.length > 1 && isSelected(drawingId)) {
      startGroupDrag(event, drawingId);
      return;
    }
    event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId);
    dragRef.current = { kind: "point", drawingId, pointIndex, before: drawings };
    setSelectedId(drawingId);
    setActiveSystem(drawingSystem(drawings.find((drawing) => drawing.id === drawingId)));
  }

  function startLineDrag(event: PointerEvent<SVGPathElement>, drawing: Drawing) {
    if (activeTool !== "select" || event.button !== 0 || spacePanRef.current || drawingLocked(drawing)) return;
    event.stopPropagation();
    if (event.shiftKey) {
      toggleSelection(drawing.id);
      return;
    }
    if (selectedIds.length > 1 && isSelected(drawing.id)) {
      startGroupDrag(event, drawing.id);
      return;
    }
    event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId);
    dragRef.current = { kind: "line", drawingId: drawing.id, start: canvasPoint(event as unknown as PointerEvent<SVGSVGElement>), original: drawing.points, before: drawings };
    setSelectedId(drawing.id);
    setActiveSystem(drawingSystem(drawing));
  }

  function startFittingDrag(event: PointerEvent<SVGGElement>, drawing: Drawing) {
    if (activeTool !== "select" || !drawing.fitting || event.button !== 0 || spacePanRef.current || drawingLocked(drawing)) return;
    event.stopPropagation();
    if (event.shiftKey) {
      toggleSelection(drawing.id);
      return;
    }
    if (selectedIds.length > 1 && isSelected(drawing.id)) {
      startGroupDrag(event, drawing.id);
      return;
    }
    event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId);
    dragRef.current = {
      kind: "fitting",
      drawingId: drawing.id,
      start: canvasPoint(event as unknown as PointerEvent<SVGSVGElement>),
      originalCenter: drawing.points[0],
      originalPorts: fittingPortPoints(drawing),
      connectedIds: drawing.fitting.connectedIds,
      before: drawings,
    };
    setSelectedId(drawing.id);
    setActiveSystem(drawingSystem(drawing));
  }

  function startSymbolDrag(event: PointerEvent<SVGGElement>, drawing: Drawing) {
    if (activeTool !== "select" || !drawing.symbol || event.button !== 0 || spacePanRef.current || drawingLocked(drawing)) return;
    event.stopPropagation();
    if (event.shiftKey) {
      toggleSelection(drawing.id);
      return;
    }
    if (selectedIds.length > 1 && isSelected(drawing.id)) {
      startGroupDrag(event, drawing.id);
      return;
    }
    event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId);
    dragRef.current = { kind: "symbol", drawingId: drawing.id, before: drawings };
    setSelectedId(drawing.id);
    setActiveSystem(drawingSystem(drawing));
  }

  function startGroupDrag(event: PointerEvent<SVGElement>, drawingId: string) {
    const ids = connectedSelection(selectedIds);
    const originals = Object.fromEntries(
      drawings.filter((drawing) => ids.includes(drawing.id)).map((drawing) => [
        drawing.id,
        drawing.points.map((point) => ({ ...point })),
      ]),
    );
    event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId);
    dragRef.current = {
      kind: "group",
      start: canvasPoint(event as unknown as PointerEvent<SVGSVGElement>),
      ids,
      originals,
      before: drawings,
    };
    setSelectedIds(ids);
    setSelectedId(drawingId);
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    if (panRef.current) return;
    const raw = canvasPoint(event);
    const drag = dragRef.current;
    if (!drag && selectionBox) {
      setSelectionBox((box) => box ? { ...box, end: raw } : null);
      return;
    }
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
            const movedFitting = current.find((item) => item.id === drag.drawingId);
            if (drawing.id === drag.drawingId) return { ...drawing, points: [nextCenter] };
            if (!drag.connectedIds.includes(drawing.id)) return drawing;
            const portIndex = drag.connectedIds.indexOf(drawing.id);
            const nextPorts = movedFitting ? fittingPortPoints(movedFitting, nextCenter) : drag.originalPorts;
            const oldPort = drag.originalPorts[portIndex] || drag.originalCenter;
            const nextPort = nextPorts[portIndex] || nextCenter;
            const firstDistance = Math.min(
              Math.hypot(drawing.points[0].x - oldPort.x, drawing.points[0].y - oldPort.y),
              Math.hypot(drawing.points[0].x - drag.originalCenter.x, drawing.points[0].y - drag.originalCenter.y),
            );
            const lastIndex = drawing.points.length - 1;
            const lastDistance = Math.min(
              Math.hypot(drawing.points[lastIndex].x - oldPort.x, drawing.points[lastIndex].y - oldPort.y),
              Math.hypot(drawing.points[lastIndex].x - drag.originalCenter.x, drawing.points[lastIndex].y - drag.originalCenter.y),
            );
            return {
              ...drawing,
              points: drawing.points.map((point, index) =>
                index === (firstDistance <= lastDistance ? 0 : lastIndex) ? nextPort : point),
            };
          }));
        } else if (drag.kind === "symbol") {
          const nextPoint = snapPoint(raw, drag.drawingId);
          setSnapMarker(nextPoint.x !== raw.x || nextPoint.y !== raw.y ? nextPoint : null);
          setDrawings((current) => current.map((drawing) =>
            drawing.id === drag.drawingId ? { ...drawing, points: [nextPoint] } : drawing));
        } else if (drag.kind === "group") {
          const dx = raw.x - drag.start.x;
          const dy = raw.y - drag.start.y;
          setDrawings((current) => current.map((drawing) => {
            const original = drag.originals[drawing.id];
            return original
              ? { ...drawing, points: original.map((point) => ({ x: point.x + dx, y: point.y + dy })) }
              : drawing;
          }));
        }
      }
      return;
    }
    if (activeTool === "branch") {
      const rawTarget = nearestSupplySegment(raw);
      if (rawTarget && rawTarget.distance <= 42 / zoom) {
        const target = orientMainTowardAirflow(rawTarget);
        const matchedRoute = existingBranchRoute(target.point, target.drawing.id, target.angle);
        const previewStyle = matchedRoute
          ? branchStyle === "auto" ? automaticBranchStyle(target.angle, matchedRoute.angle) : branchStyle
          : branchStyle === "tee90" ? "tee90" : "wye45";
        setBranchPreview({
          center: target.point,
          angle: target.angle,
          branchAngle: matchedRoute?.angle,
          side: matchedRoute?.side || target.side,
          style: previewStyle,
          parentSize: target.drawing.size,
          valid: Boolean(matchedRoute),
          matchedExisting: Boolean(matchedRoute),
          mainRunId: target.drawing.id,
          branchRunId: matchedRoute?.drawing.id,
        });
        setSnapMarker(target.point);
        setBranchMessage(matchedRoute
          ? "3-run connection found · click to insert fitting"
          : "Main run found · move closer to the crossing branch route");
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
      let point = snapPoint(raw);
      if (event.shiftKey && draft.length) point = constrainToDraftAngle(draft[draft.length - 1], point);
      setHoverPoint(point);
      setSnapMarker(point.x !== raw.x || point.y !== raw.y ? point : null);
    }
  }

  function endDrag() {
    if (selectionBox) {
      const minX = Math.min(selectionBox.start.x, selectionBox.end.x);
      const maxX = Math.max(selectionBox.start.x, selectionBox.end.x);
      const minY = Math.min(selectionBox.start.y, selectionBox.end.y);
      const maxY = Math.max(selectionBox.start.y, selectionBox.end.y);
      const isClick = maxX - minX < 3 && maxY - minY < 3;
      if (!isClick) {
        const hits = drawings.filter((drawing) => {
          if (drawing.page !== pageNumber || drawingLocked(drawing)) return false;
          const xs = drawing.points.map((point) => point.x);
          const ys = drawing.points.map((point) => point.y);
          return Math.max(...xs) >= minX && Math.min(...xs) <= maxX
            && Math.max(...ys) >= minY && Math.min(...ys) <= maxY;
        }).map((drawing) => drawing.id);
        const next = selectionBox.additive ? [...new Set([...selectedIds, ...hits])] : hits;
        setSelectedIds(next);
        setSelectedId(next.at(-1) || null);
      }
      setSelectionBox(null);
      return;
    }
    const drag = dragRef.current;
    if (!drag) return;
    setUndoStack((stack) => [...stack, drag.before]);
    setRedoStack([]);
    if (drag.kind === "fitting") {
      setDrawings((current) => {
        const repaired = reattachFittingIn(current, drag.drawingId);
        setBranchMessage(repaired.connected === 3
          ? "Fitting moved · all 3 ports reattached"
          : `${repaired.connected} of 3 nearby ports reattached`);
        return repaired.drawings;
      });
    } else if (drag.kind === "point" || drag.kind === "line") {
      setDrawings((current) => {
        const result = repairFittingsAfterRunEdit(current, drag.drawingId);
        if (result.repaired) {
          setBranchMessage(`${result.repaired} nearby fitting${result.repaired === 1 ? "" : "s"} automatically reattached`);
        }
        return result.drawings;
      });
    }
    dragRef.current = null;
    setSnapMarker(null);
  }

  function renderSymbol(drawing: Drawing, preview = false) {
    if (!drawing.symbol) return null;
    const center = drawing.points[0];
    const { kind, label, rotation, variant } = drawing.symbol;
    const displayLabel = kind === "returnGrille" ? drawing.size.replace(/x/g, "×") : label;
    const selected = isSelected(drawing.id);
    return <g
      className={`hvac-symbol symbol-${kind} ${preview ? "symbol-preview" : ""} ${selected ? "selected-symbol" : ""}`}
      transform={`translate(${center.x} ${center.y}) rotate(${rotation})`}
      onPointerDown={preview ? undefined : (event) => startSymbolDrag(event, drawing)}
    >
      <circle className="symbol-hit" cx="0" cy="0" r="24" />
      {kind === "diffuser" && variant === "round" ? <>
        <circle cx="0" cy="0" r="11" /><circle cx="0" cy="0" r="6" /><path d="M -8 0 L 8 0 M 0 -8 L 0 8" />
      </> : kind === "diffuser" && variant === "slot" ? <>
        <rect x="-18" y="-6" width="36" height="12" rx="1" /><path d="M -14 -2 L 14 -2 M -14 2 L 14 2" />
      </> : kind === "diffuser" && <>
        <rect x="-10" y="-10" width="20" height="20" rx="1" />
        <path d={variant === "1way" ? "M -8 6 L 8 -6 M -8 2 L 4 -7" : variant === "2way" ? "M -8 7 L 8 -7 M 8 7 L -8 -7" : variant === "3way" ? "M -8 7 L 8 -7 M 8 7 L -8 -7 M 0 -9 L 0 9" : "M -7 -7 L 7 7 M 7 -7 L -7 7 M 0 -9 L 0 9 M -9 0 L 9 0"} />
      </>}
      {kind === "returnGrille" && <>
        <rect x="-15" y="-10" width="30" height="20" rx="1" />
        <path d="M -11 -7 L -11 7 M -6 -7 L -6 7 M -1 -7 L -1 7 M 4 -7 L 4 7 M 9 -7 L 9 7" />
      </>}
      {kind === "equipment" && variant === "furnace" ? <>
        <rect x="-18" y="-15" width="36" height="30" rx="2" />
        <path d="M -13 -9 L 13 -9 M -13 9 L 13 9 M -7 5 C -12 0 -6 -7 0 -10 C 1 -4 9 -1 6 5 C 4 10 -3 11 -7 5 Z" />
        <text className="equipment-code" x="9" y="6" textAnchor="middle">F</text>
      </> : kind === "equipment" && variant === "air-handler" ? <>
        <rect x="-22" y="-12" width="44" height="24" rx="2" />
        <circle cx="-10" cy="0" r="7" /><path d="M -10 -6 L -7 1 L -14 3 Z M 2 -7 L 17 -7 L 17 7 L 2 7 M 5 -4 L 14 4 M 14 -4 L 5 4" />
      </> : kind === "equipment" && variant === "fan-coil" ? <>
        <rect x="-20" y="-11" width="40" height="22" rx="6" />
        <circle cx="-9" cy="0" r="6" /><path d="M -9 -5 L -6 1 L -12 2 Z M 2 -6 C 7 -2 7 2 2 6 M 8 -6 C 13 -2 13 2 8 6" />
      </> : kind === "equipment" && variant === "package" ? <>
        <rect x="-23" y="-14" width="46" height="28" rx="2" />
        <path d="M -18 -8 L -2 -8 L -2 8 L -18 8 Z M 4 -8 L 18 -8 L 18 8 L 4 8 Z M -15 -4 L -5 4 M -5 -4 L -15 4" />
        <circle cx="11" cy="0" r="5" />
      </> : kind === "equipment" && ["heat-pump", "condenser"].includes(variant || "") ? <>
        <circle cx="0" cy="0" r="15" /><circle cx="0" cy="0" r="3" />
        <path d="M 0 -3 C 11 -12 14 -1 5 2 M 3 2 C 7 14 -6 14 -5 4 M -3 1 C -15 -2 -9 -13 -2 -7" />
        <rect x="-19" y="-19" width="38" height="38" rx="3" />
      </> : kind === "equipment" && variant === "mini-split" ? <>
        <rect x="-24" y="-8" width="48" height="16" rx="5" />
        <path d="M -17 1 L 17 1 M -13 5 C -8 10 -3 10 0 5 M 2 5 C 7 10 12 10 15 5" />
      </> : kind === "equipment" && ["erv", "hrv"].includes(variant || "") ? <>
        <rect x="-21" y="-13" width="42" height="26" rx="2" />
        <path d="M -16 -7 L 16 7 M -16 7 L 16 -7 M -21 -5 L -27 -5 M -21 5 L -27 5 M 21 -5 L 27 -5 M 21 5 L 27 5" />
        <text className="equipment-code" x="0" y="4" textAnchor="middle">{variant === "hrv" ? "H" : "E"}</text>
      </> : kind === "equipment" && variant === "rtu" ? <>
        <rect x="-24" y="-15" width="48" height="30" rx="2" />
        <path d="M -18 -9 L -3 -9 L -3 9 L -18 9 Z M 4 -9 L 18 -9 L 18 9 L 4 9 Z" />
        <circle cx="11" cy="0" r="5" /><path d="M 8 -3 L 14 3 M 14 -3 L 8 3" />
      </> : kind === "equipment" && variant === "makeup-air" ? <>
        <path d="M -24 -12 L 16 -12 L 24 0 L 16 12 L -24 12 Z" />
        <path d="M -17 -6 L -5 -6 L -5 6 L -17 6 M 1 0 L 16 0 M 10 -5 L 16 0 L 10 5" />
      </> : kind === "equipment" && variant === "humidifier" ? <>
        <rect x="-15" y="-15" width="30" height="30" rx="5" />
        <path d="M 0 -10 C -8 0 -8 3 -8 6 C -8 12 8 12 8 6 C 8 2 5 -2 0 -10 Z M -4 5 C -2 8 2 8 4 5" />
      </> : kind === "equipment" && variant === "dehumidifier" ? <>
        <rect x="-21" y="-11" width="42" height="22" rx="4" />
        <circle cx="-10" cy="0" r="6" /><path d="M 6 -7 C 0 1 1 7 6 7 C 11 7 12 1 6 -7 Z" />
      </> : kind === "equipment" && variant === "boiler" ? <>
        <circle cx="0" cy="0" r="15" /><path d="M -8 6 C -12 0 -5 -7 0 -11 C 1 -4 9 -1 7 6 C 5 12 -5 12 -8 6 Z M -18 -5 L -13 -5 M 13 -5 L 18 -5" />
        <text className="equipment-code" x="0" y="6" textAnchor="middle">B</text>
      </> : kind === "equipment" && <>
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
      <text className="symbol-label" x="0" y={kind === "equipment" ? -27 : kind === "airflow" ? -10 : -16} textAnchor="middle">{displayLabel}</text>
      {drawing.elevation && <text className="symbol-elevation" x="0" y={kind === "equipment" ? 29 : 21} textAnchor="middle">EL {drawing.elevation}</text>}
      {selected && <circle className="rotation-ring" cx="0" cy="0" r="23" />}
    </g>;
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, select, textarea")) return;
      const key = event.key.toLowerCase();
      if (event.code === "Space") {
        event.preventDefault();
        spacePanRef.current = true;
        canvasViewportRef.current?.classList.add("pan-ready");
      }
      if (event.key === "Escape") {
        setDraft([]);
        setContinuingRunId(null);
        setHoverPoint(null);
        setSnapMarker(null);
        setMeasureDraft([]);
        setCalibrating(false);
        setShowSheetNavigator(false);
        selectOnly(null);
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
      if (event.shiftKey && key === "f") {
        event.preventDefault();
        setFieldMode((enabled) => !enabled);
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
      if (pdf && event.key === "PageUp") {
        event.preventDefault();
        goToPage(pageNumber - 1);
      }
      if (pdf && event.key === "PageDown") {
        event.preventDefault();
        goToPage(pageNumber + 1);
      }
      if (pdf && event.key === "Home") {
        event.preventDefault();
        goToPage(1);
      }
      if (pdf && event.key === "End") {
        event.preventDefault();
        goToPage(pdf.numPages);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      spacePanRef.current = false;
      canvasViewportRef.current?.classList.remove("pan-ready");
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  });

  const selectedDrawing = drawings.find((drawing) => drawing.id === selectedId);
  const selectedFitting = selectedDrawing?.fitting ? selectedDrawing : undefined;
  const selectedRun = selectedDrawing && !selectedDrawing.fitting && ["supply", "return", "fresh"].includes(selectedDrawing.type) ? selectedDrawing : undefined;
  const branchTrace = branchNetworkTrace(selectedFitting);
  const branchHealth = branchNetworkConnectionHealth(selectedFitting);
  const branchRepairPreview = branchNetworkRepairPreview(selectedFitting);
  const runTrace = ductNetworkTrace(selectedRun);
  const runAttachment = runAttachmentStatus(selectedRun);
  const activeTrace = selectedFitting ? branchTrace : runTrace;
  const liveDraftPoints = [...draft, ...(hoverPoint ? [hoverPoint] : [])];
  const liveDraftFeet = liveDraftPoints.length > 1
    ? liveDraftPoints.slice(1).reduce((total, point, index) => total + Math.hypot(point.x - liveDraftPoints[index].x, point.y - liveDraftPoints[index].y), 0) * scaleFeetPerUnit
    : 0;
  const liveDraftCfm = defaultCfm(ductSize);
  const liveDraftVelocity = velocityFpm(ductSize, liveDraftCfm);

  return (
    <main className={`app-shell ${fieldMode ? "field-mode" : ""} ${leftPanelOpen ? "" : "left-closed"} ${rightPanelOpen ? "" : "right-closed"}`}>
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
          <button aria-label={`Delete ${selectedIds.length || ""} selected object${selectedIds.length === 1 ? "" : "s"}`} disabled={!selectedId} onClick={deleteSelected}><Trash2 size={17} /></button>
          <button aria-label={`Duplicate ${selectedIds.length || ""} selected object${selectedIds.length === 1 ? "" : "s"}`} disabled={!selectedId} onClick={duplicateSelected}><Copy size={16} /></button>
          <span className="divider" />
          <button className="save-button" onClick={saveProject}><Save size={16} /> {saveState === "saving" ? "Saving…" : "Saved"}</button>
          <button className="drive-button" onClick={() => void openFromDrive()}><HardDrive size={16} /> Open Drive</button>
          <button
            className={`field-mode-button ${fieldMode ? "active" : ""}`}
            onClick={() => setFieldMode((enabled) => !enabled)}
            title="Field Drawing Mode · Shift+F"
          >
            {fieldMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            {fieldMode ? "Exit field mode" : "Field mode"}
          </button>
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
            <button aria-label="Collapse design tools" onClick={() => setLeftPanelOpen(false)}><PanelLeftClose size={17} /></button>
          </div>
          <div className="tool-list">
            {tools.filter(({ id }) => ["select", "supply", "branch", "return", "fresh"].includes(id)).map(({ id, label, icon: Icon, tone }) => (
              <button className={`tool ${activeTool === id ? "active" : ""}`} key={label} onClick={() => { finishDrawing(); setActiveTool(id); setSelectedId(null); setBranchPreview(null); setSymbolPreview(null); }}>
                <span className={`tool-icon ${tone || ""}`}><Icon size={19} /></span>
                <span>{label}</span>
                {activeTool === id && <kbd>{id === "select" ? "V" : "●"}</kbd>}
              </button>
            ))}
            <div className={`branch-designer ${activeTool === "branch" ? "active" : ""}`}>
              <div className="library-title"><DraftingCompass size={14} /><span>SMART BRANCH BUILDER</span><b>3 PORTS · NETWORK CFM</b></div>
              <label>Fitting style
                <select value={branchStyle} onChange={(event) => setBranchStyle(event.target.value as "auto" | "wye45" | "tee90")}>
                  <option value="auto">Auto-select from run angle</option>
                  <option value="wye45">45° Wye / lateral branch</option>
                  <option value="tee90">90° Tee branch</option>
                </select>
              </label>
              <button className="branch-arm" onClick={() => { finishDrawing(); setActiveTool("branch"); setSelectedId(null); }}>
                <span className={`mini-fitting ${branchStyle === "auto" ? "wye45" : branchStyle}`}><i /><i /><i /></span>
                Find routes and insert fitting
              </button>
              <small>Draw complete routes first. Fittings reconnect automatically after endpoint or run changes; select one for manual repair.</small>
            </div>
            <div className="symbol-library">
              <div className="library-title"><Sparkles size={14} /><span>HVAC SYMBOL LIBRARY</span><b>{symbolPresets.length}+ presets</b></div>
              <label>Category
                <select value={symbolCategory} onChange={(event) => {
                  const category = event.target.value as (typeof symbolCategories)[number];
                  const first = symbolPresets.find((preset) => preset.category === category)!;
                  setSymbolCategory(category);
                  setActivePresetId(first.id);
                }}>
                  {symbolCategories.map((category) => <option key={category}>{category}</option>)}
                </select>
              </label>
              <label>Symbol
                <select value={activePresetId} onChange={(event) => setActivePresetId(event.target.value)}>
                  {symbolPresets.filter((preset) => preset.category === symbolCategory).map((preset) => (
                    <option key={preset.id} value={preset.id}>{preset.label} · {preset.size}</option>
                  ))}
                </select>
              </label>
              <button className={`place-symbol ${symbolTools.includes(activeTool as SymbolKind) ? "active" : ""}`} onClick={() => {
                const preset = symbolPresets.find((item) => item.id === activePresetId)!;
                finishDrawing();
                setActiveTool(preset.kind);
                setSelectedId(null);
                setBranchPreview(null);
                setSymbolPreview(null);
              }}>
                <Grid3X3 size={16} />
                Place {symbolPresets.find((preset) => preset.id === activePresetId)?.label}
              </button>
              <small>Choose a family, then a field-ready symbol. Size, CFM and elevation remain editable after placement.</small>
            </div>
            {tools.filter(({ id }) => id === "measure").map(({ id, label, icon: Icon, tone }) => (
              <button className={`tool ${activeTool === id ? "active" : ""}`} key={label} onClick={() => { finishDrawing(); setActiveTool(id); setSelectedId(null); }}>
                <span className={`tool-icon ${tone || ""}`}><Icon size={19} /></span><span>{label}</span>
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
              {drawings.find((drawing) => drawing.id === selectedId)?.symbol?.kind === "equipment" && <label>Equipment size
                <select
                  value={Number(drawings.find((drawing) => drawing.id === selectedId)?.size.match(/[\d.]+/)?.[0] || 3)}
                  onChange={(event) => updateEquipmentTonnage(Number(event.target.value))}
                >
                  {[1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((tons) => <option key={tons} value={tons}>{tons} ton · {tons * 400} CFM</option>)}
                </select>
              </label>}
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
            </> : drawings.find((drawing) => drawing.id === selectedId)?.fitting ? <div className="fitting-properties">
              <div className="fitting-property-title"><DraftingCompass size={14} /><span>3-RUN FITTING</span><b>{drawings.find((drawing) => drawing.id === selectedId)?.fitting?.style === "tee90" ? "90° TEE" : "45° WYE"}</b></div>
              <div className="network-trace-summary">
                <span>CONNECTED NETWORK</span>
                <strong>{branchTrace.runCount} runs · {branchTrace.fittingCount} T/Y · {Math.round(branchTrace.totalCfm)} CFM</strong>
                <small>{branchHealth.attached}/{branchHealth.total} fitting ports attached · Red guides preview repairs</small>
                {(branchHealth.detached > 0 || branchHealth.missing > 0) && <div className="network-health-warning">
                  {branchHealth.detached > 0 && <b>{branchHealth.detached} detached</b>}
                  {branchHealth.missing > 0 && <b>{branchHealth.missing} missing run</b>}
                </div>}
                {branchRepairPreview.missing.filter((item) => item.candidates.length > 1).map((item) => <div className="branch-match-review" key={item.id}>
                  <div className="branch-match-heading">
                    <span>PORT {item.port + 1} MATCH REVIEW</span>
                    <b>CHOOSE EXISTING RUN</b>
                  </div>
                  <div className="branch-match-options">
                    {item.candidates.map((candidate, index) => <button
                      className={item.candidate?.key === candidate.key ? "selected" : ""}
                      key={candidate.key}
                      onClick={() => setBranchMatchChoices((current) => ({ ...current, [item.id]: candidate.key }))}
                    >
                      <b>{String.fromCharCode(65 + index)}</b>
                      <span>{candidate.size}&quot; · {candidate.destination}</span>
                      <small>{(candidate.distance * scaleFeetPerUnit).toFixed(1)} ft away · {Math.round(candidate.angleError * 180 / Math.PI)}° alignment</small>
                    </button>)}
                  </div>
                </div>)}
                <button
                  className="network-repair-action"
                  onClick={repairSelectedBranchNetworkConnections}
                  disabled={!branchHealth.detached}
                >Repair entire connected network</button>
                {branchRepairPreview.missing.some((item) => item.candidate) && <button
                  className="missing-run-action"
                  onClick={reconnectMissingBranchRuns}
                >Reconnect {branchRepairPreview.missing.filter((item) => item.candidate).length} existing nearby run{branchRepairPreview.missing.filter((item) => item.candidate).length === 1 ? "" : "s"}</button>}
              </div>
              <label>Fitting geometry
                <select
                  value={drawings.find((drawing) => drawing.id === selectedId)?.fitting?.style || "wye45"}
                  onChange={(event) => reshapeSelectedFitting(event.target.value as "wye45" | "tee90")}
                >
                  <option value="wye45">45° Wye / lateral</option>
                  <option value="tee90">90° Tee</option>
                </select>
              </label>
              <div className="fitting-actions">
                <button onClick={() => {
                  const selected = drawings.find((drawing) => drawing.id === selectedId)!;
                  reshapeSelectedFitting(selected.fitting?.style || "wye45", selected.fitting?.side === 1 ? -1 : 1);
                }}>Flip left / right</button>
                <button onClick={rebalanceSelectedFitting}>Auto-split CFM</button>
                <button className="network-size-action" onClick={autoSizeSelectedBranchNetwork}>Auto-size connected network</button>
                <button className="reattach-action" onClick={reattachSelectedFitting}>Reattach nearby runs</button>
                <button
                  className="remove-fitting-action"
                  onClick={() => {
                    const fitting = drawings.find((drawing) => drawing.id === selectedId && drawing.fitting);
                    if (fitting) removeFittingAndHeal(fitting);
                  }}
                >Remove fitting · keep routes</button>
              </div>
              <div className="outlet-actions">
                <button onClick={() => continueFittingOutlet(1)}>Continue Outlet A</button>
                <button onClick={() => continueFittingOutlet(2)}>Continue Outlet B</button>
              </div>
              {(["Upstream / inlet", "Outlet A / straight", "Outlet B / branch"] as const).map((label, port) => {
                const fitting = drawings.find((drawing) => drawing.id === selectedId)!.fitting!;
                const value = [fitting.upstreamSize, fitting.downstreamSize, fitting.branchSize][port];
                return <label key={label}>{label}
                  <select value={value} onChange={(event) => updateFittingPortSize(port as 0 | 1 | 2, event.target.value)}>
                    {["16", "14", "12", "10", "8", "7", "6", "4"].map((size) => <option key={size}>{size}</option>)}
                  </select>
                </label>;
              })}
              <div className="port-status">
                {([0, 1, 2] as const).map((port) => {
                  const fitting = drawings.find((drawing) => drawing.id === selectedId)!;
                  const state = fittingPortState(fitting, port);
                  return <span className={`${state.connected ? "connected" : "disconnected"} ${state.overloaded ? "overloaded" : ""}`} key={port}>
                    ● Port {port + 1} {state.connected ? "connected" : "disconnected"} · {state.cfm} CFM{state.overloaded ? ` · NEEDS ${state.recommended}"` : ""}
                  </span>;
                })}
              </div>
            </div> : drawings.find((drawing) => drawing.id === selectedId)?.measurement ? <div className="engineering-card">
              <span>MEASURED DISTANCE</span>
              <strong>{drawings.find((drawing) => drawing.id === selectedId)?.measurement?.feet.toFixed(1)} FT</strong>
              <small>{scaleLabel}</small>
            </div> : <>
              <label>{selectedId ? "Selected duct size" : "New duct size"}
                <select value={selectedId ? drawings.find((drawing) => drawing.id === selectedId)?.fitting?.upstreamSize || drawings.find((drawing) => drawing.id === selectedId)?.size || ductSize : ductSize} onChange={(event) => updateSelectedSize(event.target.value)}><option>16</option><option>14</option><option>12</option><option>10</option><option>8</option><option>7</option><option>6</option><option>4</option></select>
              </label>
              {selectedId && !drawings.find((drawing) => drawing.id === selectedId)?.fitting && <div className="engineering-properties">
                <div className="duct-trace-summary">
                  <div>
                    <span>CONNECTED DUCT PATH</span>
                    <b className={runTrace.sourceConnected || selectedRun?.type !== "supply" ? "connected" : "disconnected"}>
                      {runTrace.sourceConnected || selectedRun?.type !== "supply" ? "● CONNECTED" : "● NO UNIT SOURCE"}
                    </b>
                  </div>
                  <strong>{runTrace.runCount} runs · {runTrace.fittingCount} T/Y · {runTrace.terminalCount} terminals</strong>
                  <small>{Math.round(runTrace.totalCfm)} CFM on selected run · Full path highlighted</small>
                </div>
                <div className={`run-connection-card ${runAttachment.detached ? "needs-repair" : ""}`}>
                  <div>
                    <span>FITTING CONNECTIONS</span>
                    <strong>{runAttachment.attached} attached{runAttachment.detached ? ` · ${runAttachment.detached} detached` : ""}</strong>
                  </div>
                  <button onClick={repairSelectedRunConnections} disabled={!runAttachment.detached && !runAttachment.nearbyOpen}>
                    Repair nearby connections
                  </button>
                  <small>Reconnects existing or empty ports only · no branch stubs</small>
                </div>
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
              <label>Install height / elevation
                <input
                  className="property-input"
                  placeholder={'Example: 8\'-0" AFF'}
                  value={drawings.find((drawing) => drawing.id === selectedId)?.elevation || ""}
                  onChange={(event) => updateSelectedElevation(event.target.value)}
                />
              </label>
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
            {!leftPanelOpen && <button className="panel-restore" onClick={() => setLeftPanelOpen(true)}><PanelLeftClose size={16} /> Tools</button>}
            <button onClick={() => setActiveTool("select")}><MousePointer2 size={16} /> {activeTool === "select" ? "Select" : tools.find((tool) => tool.id === activeTool)?.label}</button>
            <span className="divider" />
            <button aria-label="Pan drawing" title="Right-click and drag anywhere on the plan"><Hand size={16} /> Right-drag pan</button>
            <button aria-label="Zoom out" onClick={zoomOut} disabled={!pdf}><ZoomOut size={17} /></button>
            <strong>{Math.round(zoom * 100)}%</strong>
            <button aria-label="Zoom in" onClick={zoomIn} disabled={!pdf}><ZoomIn size={17} /></button>
            <button className="view-button" disabled={!pdf} onClick={fitPage} title="Fit the entire sheet in the workspace">Fit</button>
            <button className="view-button" disabled={!pdf} onClick={fitWidth} title="Fit sheet width to the workspace">Width</button>
            <button className="view-button" disabled={!pdf} onClick={() => applyViewportZoom(1)} title="Return to 100% zoom">100%</button>
            <button
              className={`precision-toggle ${showGrid ? "active" : ""}`}
              onClick={() => setShowGrid((visible) => !visible)}
              aria-pressed={showGrid}
              title="Show or hide the drafting grid"
            ><Grid3X3 size={16} /> Grid</button>
            <button
              className={`precision-toggle ${snapEnabled ? "active" : ""}`}
              onClick={() => setSnapEnabled((enabled) => !enabled)}
              aria-pressed={snapEnabled}
              title="Snap to endpoints, duct segments, and grid points"
            ><CircleDot size={14} /> Snap</button>
            <button
              className={`display-toggle ${showCfmLabels ? "active" : ""}`}
              disabled={!pdf}
              onClick={() => setShowCfmLabels((visible) => !visible)}
              title="Show or hide CFM values on duct labels"
              aria-pressed={showCfmLabels}
            >
              <Gauge size={14} /> CFM
            </button>
            <button
              className={`display-toggle ${showLengthLabels ? "active" : ""}`}
              disabled={!pdf}
              onClick={() => setShowLengthLabels((visible) => !visible)}
              title="Show or hide duct lengths and orange distance dimensions"
              aria-pressed={showLengthLabels}
            >
              <Ruler size={14} /> Length
            </button>
            <button
              className={`sheets-button ${showSheetNavigator ? "active" : ""}`}
              disabled={!pdf}
              onClick={() => setShowSheetNavigator((visible) => !visible)}
              title="Open the complete sheet navigator"
            >
              <FileText size={15} /> Sheets
            </button>
            {pdf && <div className="page-controls">
              <button aria-label="First page" disabled={pageNumber === 1} onClick={() => goToPage(1)}>«</button>
              <button aria-label="Previous page" disabled={pageNumber === 1} onClick={() => goToPage(pageNumber - 1)}><ChevronLeft size={16} /></button>
              <select className="page-select" aria-label="Jump to page" value={pageNumber} onChange={(event) => goToPage(Number(event.target.value))}>
                {Array.from({ length: pdf.numPages }, (_, index) => <option key={index + 1} value={index + 1}>Page {index + 1} of {pdf.numPages}</option>)}
              </select>
              <button aria-label="Next page" disabled={pageNumber === pdf.numPages} onClick={() => goToPage(pageNumber + 1)}><ChevronRight size={16} /></button>
              <button aria-label="Last page" disabled={pageNumber === pdf.numPages} onClick={() => goToPage(pdf.numPages)}>»</button>
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
            {!rightPanelOpen && <button className="panel-restore" onClick={() => setRightPanelOpen(true)}>Inspector <PanelRightClose size={16} /></button>}
          </div>

          <div
            ref={canvasViewportRef}
            className={`canvas ${pdf ? "has-plan" : ""} ${showGrid ? "" : "grid-hidden"}`}
            onDragOver={(event) => event.preventDefault()}
            onDrop={onDrop}
            onWheel={handleWheelZoom}
            onPointerDownCapture={startPlanPan}
            onPointerMoveCapture={movePlanPan}
            onPointerUpCapture={endPlanPan}
            onPointerCancelCapture={endPlanPan}
            onContextMenu={(event) => {
              event.preventDefault();
              if (draft.length) finishDrawing();
            }}
          >
            <input ref={inputRef} className="file-input" type="file" accept="application/pdf,.pdf" onChange={onFileChange} />
            {selectedId && <div className="field-context-toolbar" role="toolbar" aria-label="Selected HVAC object actions">
              <strong>{selectedIds.length > 1 ? `${selectedIds.length} OBJECTS` : selectedDrawing?.fitting ? "T/Y FITTING" : selectedDrawing?.symbol ? "HVAC SYMBOL" : selectedDrawing?.measurement ? "MEASUREMENT" : "DUCT RUN"}</strong>
              {!selectedDrawing?.symbol && !selectedDrawing?.measurement && <select
                aria-label="Quick duct size"
                value={selectedDrawing?.fitting?.upstreamSize || selectedDrawing?.size || ductSize}
                onChange={(event) => updateSelectedSize(event.target.value)}
              >
                {["16", "14", "12", "10", "8", "7", "6", "4"].map((size) => <option key={size} value={size}>{size}&quot;</option>)}
              </select>}
              {selectedDrawing?.symbol && <button onClick={() => rotateSelectedSymbol(-15)}>−15°</button>}
              {selectedDrawing?.symbol && <button onClick={() => rotateSelectedSymbol(15)}>+15°</button>}
              <button title="Mirror selection" onClick={mirrorSelectedHorizontal}><FlipHorizontal2 size={15} /> Mirror</button>
              <button title="Duplicate selection" onClick={duplicateSelected}><Copy size={15} /> Duplicate</button>
              <button className="danger" title="Delete selection" onClick={deleteSelected}><Trash2 size={15} /></button>
              <button title="Clear selection" onClick={() => selectOnly(null)}><X size={15} /></button>
            </div>}
            {draft.length > 0 && ["supply", "return", "fresh"].includes(activeTool) && <div className="live-draft-hud">
              <span>LIVE RUN</span>
              <strong>{ductSize}&quot; · {liveDraftFeet.toFixed(1)} LF</strong>
              <b>{liveDraftCfm} CFM · {liveDraftVelocity} FPM</b>
              <small>Left-click direction · Shift locks angle · Right-click finishes</small>
            </div>}
            {pdf && showSheetNavigator && <div className="sheet-navigator" role="dialog" aria-label="PDF sheet navigator">
              <div className="sheet-navigator-heading">
                <div><strong>SHEET NAVIGATOR</strong><small>{pdf.numPages} pages · select any sheet</small></div>
                <button aria-label="Close sheet navigator" onClick={() => setShowSheetNavigator(false)}>×</button>
              </div>
              <div className="sheet-grid">
                {Array.from({ length: pdf.numPages }, (_, index) => {
                  const page = index + 1;
                  const markupCount = drawings.filter((drawing) => drawing.page === page).length;
                  return <button
                    className={page === pageNumber ? "active" : ""}
                    key={page}
                    onClick={() => { goToPage(page); setShowSheetNavigator(false); }}
                  >
                    <span className="sheet-paper"><FileText size={20} /></span>
                    <strong>Page {page}</strong>
                    <small>{markupCount ? `${markupCount} HVAC ${markupCount === 1 ? "object" : "objects"}` : "No markups"}</small>
                    {page === pageNumber && <b>CURRENT</b>}
                  </button>;
                })}
              </div>
              <div className="sheet-navigator-footer">Tip: Page Up / Page Down changes sheets · Home / End jumps to the first or last page.</div>
            </div>}
            {pdf ? (
              <div className="pdf-stage">
                <div ref={planSheetRef} className="plan-sheet" style={{ width: renderSize.width * zoom, height: renderSize.height * zoom }}>
                  <canvas ref={canvasRef} aria-label={`PDF page ${pageNumber}`} style={{ opacity: backgroundOpacity / 100 }} />
                  <svg
                    className={`drawing-layer tool-${activeTool}`}
                    viewBox={`0 0 ${renderSize.width || 1} ${renderSize.height || 1}`}
                    onPointerDown={handleDrawingClick}
                    onPointerMove={handlePointerMove}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    onPointerLeave={() => { if (!dragRef.current) { setHoverPoint(null); setSnapMarker(null); setBranchPreview(null); setSymbolPreview(null); } }}
                    onContextMenu={(event) => event.preventDefault()}
                  >
                    {drawings.filter((drawing) => {
                      if (drawing.page !== pageNumber) return false;
                      const layer = drawingLayer(drawing);
                      return !layer || visibleLayers[layer];
                    }).map((drawing) => {
                      if (drawing.measurement) {
                        if (!showLengthLabels) return null;
                        const [a, b] = drawing.points;
                        const middle = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
                        return <g key={drawing.id} className={`measurement ${isSelected(drawing.id) ? "selected-measurement" : ""}`} onPointerDown={(event) => {
                          if (activeTool !== "select" || drawingLocked(drawing)) return;
                          event.stopPropagation();
                          event.shiftKey ? toggleSelection(drawing.id) : selectOnly(drawing.id);
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
                        const branchAxis = drawing.fitting.branchAngle ?? axis + drawing.fitting.side * (drawing.fitting.style === "tee90" ? Math.PI / 2 : Math.PI / 4);
                        const [inlet, outlet, branchPort] = fittingPortPoints(drawing);
                        const shoulderA = { x: center.x + Math.cos(axis) * 7, y: center.y + Math.sin(axis) * 7 };
                        const shoulderB = { x: center.x + Math.cos(branchAxis) * 8, y: center.y + Math.sin(branchAxis) * 8 };
                        const outletArrow = {
                          tip: { x: center.x + Math.cos(axis) * 13, y: center.y + Math.sin(axis) * 13 },
                          left: { x: center.x + Math.cos(axis) * 7 + Math.cos(axis + Math.PI / 2) * 3, y: center.y + Math.sin(axis) * 7 + Math.sin(axis + Math.PI / 2) * 3 },
                          right: { x: center.x + Math.cos(axis) * 7 + Math.cos(axis - Math.PI / 2) * 3, y: center.y + Math.sin(axis) * 7 + Math.sin(axis - Math.PI / 2) * 3 },
                        };
                        const branchArrow = {
                          tip: { x: center.x + Math.cos(branchAxis) * 16, y: center.y + Math.sin(branchAxis) * 16 },
                          left: { x: center.x + Math.cos(branchAxis) * 10 + Math.cos(branchAxis + Math.PI / 2) * 3, y: center.y + Math.sin(branchAxis) * 10 + Math.sin(branchAxis + Math.PI / 2) * 3 },
                          right: { x: center.x + Math.cos(branchAxis) * 10 + Math.cos(branchAxis - Math.PI / 2) * 3, y: center.y + Math.sin(branchAxis) * 10 + Math.sin(branchAxis - Math.PI / 2) * 3 },
                        };
                        const portSizes = [drawing.fitting.upstreamSize, drawing.fitting.downstreamSize, drawing.fitting.branchSize];
                        const portStates = ([0, 1, 2] as const).map((port) => fittingPortState(drawing, port));
                        return <g
                          key={drawing.id}
                          className={`branch-fitting ${activeTrace.fittingIds.has(drawing.id) ? "traced-fitting" : ""} ${isSelected(drawing.id) ? "selected-fitting" : ""}`}
                          onPointerDown={(event) => startFittingDrag(event, drawing)}
                        >
                          <circle className="fitting-hit" cx={center.x} cy={center.y} r="22" />
                          <path className={`fitting-leg ${portStates[0].overloaded ? "overloaded" : ""}`} style={{ strokeWidth: fittingLegWidth(drawing.fitting.upstreamSize) }} d={`M ${inlet.x} ${inlet.y} L ${center.x} ${center.y}`} />
                          <path className={`fitting-leg ${portStates[1].overloaded ? "overloaded" : ""}`} style={{ strokeWidth: fittingLegWidth(drawing.fitting.downstreamSize) }} d={`M ${center.x} ${center.y} L ${outlet.x} ${outlet.y}`} />
                          <path className={`fitting-leg ${portStates[2].overloaded ? "overloaded" : ""}`} style={{ strokeWidth: fittingLegWidth(drawing.fitting.branchSize) }} d={`M ${shoulderA.x} ${shoulderA.y} Q ${center.x} ${center.y} ${shoulderB.x} ${shoulderB.y} L ${branchPort.x} ${branchPort.y}`} />
                          {[outletArrow, branchArrow].map((arrow, index) => <path
                            className="fitting-flow-arrow"
                            key={`flow-${index}`}
                            d={`M ${arrow.left.x} ${arrow.left.y} L ${arrow.tip.x} ${arrow.tip.y} L ${arrow.right.x} ${arrow.right.y}`}
                          />)}
                          {[inlet, outlet, branchPort].map((port, index) => <g className={portStates[index].overloaded ? "overloaded-port" : ""} key={index}>
                            <circle className="fitting-port" cx={port.x} cy={port.y} r="4.2" />
                            <text className="port-number" x={port.x} y={port.y + 2.4} textAnchor="middle">{index + 1}</text>
                            <text className="fitting-port-size" x={port.x} y={port.y - 7} textAnchor="middle">{portSizes[index]}&quot;</text>
                            {showCfmLabels && <text className="fitting-port-cfm" x={port.x} y={port.y + 12} textAnchor="middle">{portStates[index].cfm} CFM</text>}
                          </g>)}
                          <circle className="fitting-core" cx={center.x} cy={center.y} r="5.5" />
                          <text className="fitting-label" x={branchPort.x + 9} y={branchPort.y - 7}>{drawing.fitting.style === "tee90" ? "TEE" : "WYE"} · {drawing.size}{drawing.elevation ? ` · EL ${drawing.elevation}` : ""}</text>
                        </g>;
                      }
                      const path = drawing.points.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ");
                      const middle = drawing.points[Math.floor(drawing.points.length / 2)];
                      const branchCandidateClass = branchPreview?.mainRunId === drawing.id
                        ? "branch-candidate-main"
                        : branchPreview?.branchRunId === drawing.id
                          ? "branch-candidate-route"
                          : "";
                      return <g key={drawing.id} className={`${activeTrace.runIds.has(drawing.id) ? "traced-run" : ""} ${isSelected(drawing.id) ? "selected-drawing" : ""} ${branchCandidateClass}`.trim()} onPointerDown={(event) => {
                        if (activeTool !== "select" || drawingLocked(drawing)) return;
                        event.stopPropagation();
                        event.shiftKey ? toggleSelection(drawing.id) : selectOnly(drawing.id);
                      }}>
                        <path className="hit-line" d={path} onPointerDown={(event) => startLineDrag(event, drawing)} />
                        <path className="duct-line" d={path} stroke={drawingColors[drawing.type as DrawType]} />
                        {drawing.points.map((point, index) => <circle
                          className={isSelected(drawing.id) ? "edit-handle" : ""}
                          key={index}
                          cx={point.x}
                          cy={point.y}
                          r={isSelected(drawing.id) ? 6 : 3.5}
                          fill={drawingColors[drawing.type as DrawType]}
                          onPointerDown={(event) => startPointDrag(event, drawing.id, index)}
                        />)}
                        <text x={middle.x + 8} y={middle.y - 8}>
                          {drawing.size}"
                          {showLengthLabels ? ` · ${drawingLengthFeet(drawing).toFixed(1)} LF` : ""}
                          {showCfmLabels ? ` · ${runAirflow(drawing)} CFM${airflowNetwork().calculated.get(drawing.id) ? " AUTO" : ""}` : ""}
                          {drawing.elevation ? ` · EL ${drawing.elevation}` : ""}
                        </text>
                      </g>;
                    })}
                    {selectionBox && <rect
                      className="selection-box"
                      x={Math.min(selectionBox.start.x, selectionBox.end.x)}
                      y={Math.min(selectionBox.start.y, selectionBox.end.y)}
                      width={Math.abs(selectionBox.end.x - selectionBox.start.x)}
                      height={Math.abs(selectionBox.end.y - selectionBox.start.y)}
                    />}
                    {(branchRepairPreview.detached.length > 0 || branchRepairPreview.missing.length > 0) && <g className="network-repair-preview">
                      {branchRepairPreview.detached.map((gap) => <g key={gap.id}>
                        <path d={`M ${gap.endpoint.x} ${gap.endpoint.y} L ${gap.portPoint.x} ${gap.portPoint.y}`} />
                        <circle className="detached-end" cx={gap.endpoint.x} cy={gap.endpoint.y} r="5" />
                        <circle className="target-port" cx={gap.portPoint.x} cy={gap.portPoint.y} r="7" />
                        <text x={(gap.endpoint.x + gap.portPoint.x) / 2} y={(gap.endpoint.y + gap.portPoint.y) / 2 - 5} textAnchor="middle">PORT {gap.port + 1}</text>
                      </g>)}
                      {branchRepairPreview.missing.map((gap) => <g className={`missing-run-preview ${gap.candidate ? "has-candidate" : ""}`} key={gap.id}>
                        {gap.candidate && <path className="candidate-guide" d={`M ${gap.candidate.endpoint.x} ${gap.candidate.endpoint.y} L ${gap.portPoint.x} ${gap.portPoint.y}`} />}
                        {gap.candidate && <circle className="candidate-end" cx={gap.candidate.endpoint.x} cy={gap.candidate.endpoint.y} r="5" />}
                        <circle cx={gap.portPoint.x} cy={gap.portPoint.y} r="8" />
                        <path d={`M ${gap.portPoint.x - 4} ${gap.portPoint.y - 4} L ${gap.portPoint.x + 4} ${gap.portPoint.y + 4} M ${gap.portPoint.x + 4} ${gap.portPoint.y - 4} L ${gap.portPoint.x - 4} ${gap.portPoint.y + 4}`} />
                        <text x={gap.portPoint.x} y={gap.portPoint.y - 11} textAnchor="middle">{gap.candidate ? "EXISTING RUN FOUND" : "MISSING RUN"}</text>
                      </g>)}
                    </g>}
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
                      const previewStyle = branchPreview.style || "wye45";
                      const branchAxis = branchPreview.branchAngle ?? branchPreview.angle + branchPreview.side * (previewStyle === "tee90" ? Math.PI / 2 : Math.PI / 4);
                      const inlet = { x: center.x - Math.cos(branchPreview.angle) * 13, y: center.y - Math.sin(branchPreview.angle) * 13 };
                      const outlet = { x: center.x + Math.cos(branchPreview.angle) * 13, y: center.y + Math.sin(branchPreview.angle) * 13 };
                      const branchPort = { x: center.x + Math.cos(branchAxis) * 18, y: center.y + Math.sin(branchAxis) * 18 };
                      return <g className={`branch-preview ${branchPreview.valid ? "" : "invalid"}`}>
                        <circle cx={center.x} cy={center.y} r="22" />
                        <path d={`M ${inlet.x} ${inlet.y} L ${center.x} ${center.y} L ${outlet.x} ${outlet.y} M ${center.x} ${center.y} L ${branchPort.x} ${branchPort.y}`} />
                        {[inlet, outlet, branchPort].map((port, index) => <circle
                          key={index}
                          className={`preview-port ${branchPreview.valid ? "ready" : index < 2 ? "ready" : "missing"}`}
                          cx={port.x}
                          cy={port.y}
                          r="4.5"
                        />)}
                        <text x={branchPort.x + 7} y={branchPort.y - 6}>{branchPreview.matchedExisting ? `READY · ${previewStyle === "tee90" ? "TEE" : "WYE"} · 3 RUNS` : "BRANCH RUN NEEDED"} · {branchPreview.parentSize}×{steppedSize(branchPreview.parentSize, 1)}×{steppedSize(branchPreview.parentSize, 2)}</text>
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
                        variant: symbolPresets.find((preset) => preset.id === activePresetId && preset.kind === symbolPreview.kind)?.variant,
                        label: symbolPresets.find((preset) => preset.id === activePresetId && preset.kind === symbolPreview.kind)?.label || {
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
            <button className={rightTab === "network" ? "active" : ""} onClick={() => setRightTab("network")}>Network</button>
            <button className={rightTab === "takeoff" ? "active" : ""} onClick={() => setRightTab("takeoff")}>Takeoff</button>
            <button className={rightTab === "checks" ? "active" : ""} onClick={() => setRightTab("checks")}>Checks</button>
            <button className="right-collapse" aria-label="Collapse inspector" onClick={() => setRightPanelOpen(false)}><PanelRightClose size={15} /></button>
          </div>
          {rightTab === "layers" ? <>
            <div className="search"><Search size={15} /><input aria-label="Search layers" placeholder="Search layers" /></div>
            <div className="background-control">
              <div><strong>PLAN BACKGROUND</strong><b>{backgroundOpacity}%</b></div>
              <input
                aria-label="Plan background opacity"
                type="range"
                min="15"
                max="100"
                step="5"
                value={backgroundOpacity}
                onChange={(event) => setBackgroundOpacity(Number(event.target.value))}
              />
              <div className="background-presets">
                <button className={backgroundOpacity === 100 ? "active" : ""} onClick={() => setBackgroundOpacity(100)}>Full</button>
                <button className={backgroundOpacity === 60 ? "active" : ""} onClick={() => setBackgroundOpacity(60)}>Fade</button>
                <button className={backgroundOpacity === 30 ? "active" : ""} onClick={() => setBackgroundOpacity(30)}>Light</button>
              </div>
              <small>Fades only the imported PDF. HVAC drawing colors and labels stay at full strength.</small>
            </div>
            <div className="layer-actions">
              <button onClick={() => setVisibleLayers({ ...defaultVisibleLayers })}>Show all</button>
              <button onClick={() => setVisibleLayers({ supply: false, branch: false, return: false, fresh: false, notes: false })}>Hide all</button>
            </div>
            <div className="layer-list">
              {layers.map(({ id, label, tone }) => (
                <div className={`layer ${visibleLayers[id] ? "" : "hidden-layer"}`} key={id}>
                  <label className="layer-visibility">
                    <input
                      type="checkbox"
                      checked={visibleLayers[id]}
                      onChange={(event) => setVisibleLayers((current) => ({ ...current, [id]: event.target.checked }))}
                    />
                    <i className={tone} />
                    <span>{label}</span>
                  </label>
                  <small>{drawings.filter((drawing) => drawingLayer(drawing) === id).length}</small>
                  <button
                    className={lockedLayers[id] ? "locked" : ""}
                    onClick={() => toggleLayerLock(id)}
                    aria-label={`${lockedLayers[id] ? "Unlock" : "Lock"} ${label}`}
                    title={`${lockedLayers[id] ? "Unlock" : "Lock"} this layer`}
                  >
                    {lockedLayers[id] ? <Lock size={12} /> : <Unlock size={12} />}
                  </button>
                </div>
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
            <div className="room-schedule-actions">
              <button disabled={!roomSchedule().length} onClick={() => window.print()}>Print / PDF</button>
              <button disabled={!roomSchedule().length} onClick={exportRoomScheduleCsv}>Export CSV</button>
            </div>
            <div className="room-summary-grid">
              <div><span>Supply</span><strong>{roomScheduleSummary().supplyCfm} CFM</strong></div>
              <div><span>Return</span><strong>{roomScheduleSummary().returnCfm} CFM</strong></div>
              <div className={roomScheduleSummary().bedrooms === roomScheduleSummary().bedroomsWithReturn ? "good" : "attention"}>
                <span>Bedroom returns</span>
                <strong>{roomScheduleSummary().bedroomsWithReturn}/{roomScheduleSummary().bedrooms}</strong>
              </div>
              <div className={roomScheduleSummary().missingCfm ? "attention" : "good"}>
                <span>Missing CFM</span><strong>{roomScheduleSummary().missingCfm}</strong>
              </div>
            </div>
            {roomSchedule().length ? <div className="room-list">
              {roomSchedule().map((room) => <button
                className={`room-row ${room.needsReturn ? "needs-return" : ""}`}
                key={room.name}
                onClick={() => { setSelectedId(room.drawingIds[0] || null); setActiveTool("select"); }}
                title={`Select ${room.name} on the plan`}
              >
                <div className="room-row-heading"><strong>{room.name}</strong><span>{room.type}</span></div>
                <div className="room-airflow-grid">
                  <div><span>Supply</span><b>{room.supplyCfm} CFM</b><small>{room.diffusers} diffusers</small></div>
                  <div><span>Return</span><b>{room.returnCfm} CFM</b><small>{room.returns} grilles</small></div>
                  <div className={`room-balance ${Math.abs(room.balanceCfm) <= Math.max(25, room.supplyCfm * .1) ? "good" : "attention"}`}>
                    <span>Room balance</span><b>{room.balanceCfm > 0 ? "+" : ""}{room.balanceCfm} CFM</b><small>Supply minus return</small>
                  </div>
                </div>
                {room.needsReturn && <p><AlertTriangle size={12} /> Add or verify a return path for door-closed comfort.</p>}
                {!!room.missingCfm && <p><CircleDot size={12} /> {room.missingCfm} terminal{room.missingCfm === 1 ? "" : "s"} need scheduled CFM.</p>}
              </button>)}
            </div> : <div className="empty-takeoff">Select a diffuser, return, or duct and enter its room name to build the room schedule.</div>}
            <div className="takeoff-note">Click a room to select its first assigned plan object. Room balance is a coordination indicator—not a room-load calculation. Final airflow still requires field balancing.</div>
          </div> : rightTab === "network" ? <div className="network-balance-panel">
            <div className="checks-heading">
              <div><strong>NETWORK BALANCE</strong><small>{systemLabel(activeSystem)} · connected airflow</small></div>
              <span className={`check-pill ${networkBalanceRows().every((row) => row.balanced) && networkBalanceRows().length ? "clear" : "warning"}`}>
                {networkBalanceRows().length ? networkBalanceRows().filter((row) => !row.balanced).length || "OK" : "—"}
              </span>
            </div>
            {networkBalanceRows().length ? <div className="network-balance-list">
              {networkBalanceRows().map((row) => <div className={`network-balance-card ${row.balanced ? "balanced" : "attention"}`} key={row.unit.id}>
                <button className="network-unit-heading" onClick={() => { setSelectedId(row.unit.id); setActiveTool("select"); }}>
                  <span><strong>{row.unit.symbol?.label || "HVAC EQUIPMENT"}</strong><small>{row.rootRunId ? `${row.runCount} runs · ${row.fittingCount} fittings · ${row.terminalCount} diffusers` : "Supply trunk not connected"}</small></span>
                  <b>{row.balanced ? "BALANCED" : row.rootRunId ? "REVIEW" : "DISCONNECTED"}</b>
                </button>
                <div className="network-airflow-grid">
                  <div><span>Design</span><strong>{row.designCfm} CFM</strong></div>
                  <div><span>Connected supply</span><strong>{row.assignedCfm} CFM</strong></div>
                  <div className={Math.abs(row.remainingCfm) <= Math.max(25, row.designCfm * .1) ? "good" : "attention"}>
                    <span>Remaining</span><strong>{row.remainingCfm > 0 ? "+" : ""}{row.remainingCfm} CFM</strong>
                  </div>
                  <div><span>System return</span><strong>{row.returnCfm} CFM</strong></div>
                </div>
                <div className="network-progress" aria-label={`${row.percent}% of equipment airflow assigned`}>
                  <i style={{ width: `${Math.min(100, Math.max(0, row.percent))}%` }} />
                  <span>{row.percent}% assigned</span>
                </div>
                <div className="network-problem-grid">
                  <span className={row.detachedPorts ? "warning" : "clear"}>{row.detachedPorts} detached</span>
                  <span className={row.missingPorts ? "warning" : "clear"}>{row.missingPorts} missing</span>
                  <span className={row.overloadedPorts ? "warning" : "clear"}>{row.overloadedPorts} undersized</span>
                  <span className={row.progressionCount ? "warning" : "clear"}>{row.progressionCount} progression</span>
                </div>
                {row.firstProblemFittingId && <button className="network-problem-action" onClick={() => { setSelectedId(row.firstProblemFittingId!); setActiveTool("select"); }}>
                  Select first problem branch
                </button>}
              </div>)}
            </div> : <div className="empty-takeoff">Place equipment and connect it to a supply trunk to build the network balance panel.</div>}
            <div className="network-system-overview">
              <strong>16-SYSTEM OVERVIEW</strong>
              {systems.filter((system) => systemStats(system.id).objects).map((system) => {
                const stats = systemStats(system.id);
                const percent = stats.designCfm ? Math.round(stats.supplyCfm / stats.designCfm * 100) : 0;
                return <button className={system.id === activeSystem ? "active" : ""} key={system.id} onClick={() => { setActiveSystem(system.id); setSelectedId(null); }}>
                  <b>{system.id.replace("system-", "S")}</b>
                  <span><strong>{systemLabel(system.id)}</strong><small>{stats.designCfm} design · {stats.supplyCfm} supply · {stats.returnCfm} return</small></span>
                  <i>{percent}%</i>
                </button>;
              })}
            </div>
            <div className="takeoff-note">Review-only. The panel follows connected runs and T/Y relationships; it never changes duct sizes, routes, CFM, or fittings automatically.</div>
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
            <div className="reducer-review-card">
              <div><DraftingCompass size={16} /><span><strong>MANUAL REDUCER RECOMMENDATIONS</strong><small>Approve each transition individually</small></span></div>
              <button onClick={() => setShowReducerReview((visible) => !visible)}>
                {showReducerReview ? "Hide recommendations" : `Review ${reducerRecommendations().length} locations`}
              </button>
              {showReducerReview && <div className="reducer-review-list">
                {reducerRecommendations().length ? reducerRecommendations().map((recommendation) => <div key={recommendation.id}>
                  <button className="reducer-select" onClick={() => { setSelectedId(recommendation.id); setActiveTool("select"); }}>
                    <span><strong>{recommendation.reducing ? "REDUCER" : "TRANSITION"} · {recommendation.current}″ → {recommendation.recommended}″</strong><small>{recommendation.type.toUpperCase()} · {recommendation.cfm} CFM · {recommendation.run.roomName?.trim() || "Room unassigned"}</small></span>
                    <b>{recommendation.currentVelocity} → {recommendation.velocity} FPM</b>
                  </button>
                  <button className="place-reducer-action" onClick={() => placeRecommendedReducer(recommendation)}>
                    Place labeled {recommendation.reducing ? "reducer" : "transition"}
                  </button>
                </div>) : <div className="reducer-review-clear"><CheckCircle2 size={17} /> No unplaced size transitions are recommended.</div>}
              </div>}
              <p>Placement adds only a labeled fitting symbol. It does not resize, reroute, split, or reconnect any duct run.</p>
            </div>
            <div className={`progression-card ${sizeProgressionIssues().some((issue) => issue.severity === "critical") ? "critical" : ""}`}>
              <div><Route size={16} /><span><strong>SIZE-PROGRESSION CHECK</strong><small>Review only · never changes your ductwork</small></span></div>
              <button onClick={() => setShowProgressionReview((visible) => !visible)}>
                {showProgressionReview ? "Hide review" : `Review ${sizeProgressionIssues().length} transitions`}
              </button>
              {showProgressionReview && <div className="progression-review">
                {sizeProgressionIssues().length ? sizeProgressionIssues().map((issue) => (
                  <button
                    className={issue.severity}
                    key={issue.id}
                    onClick={() => { setSelectedId(issue.fittingId); setActiveTool("select"); }}
                  >
                    <AlertTriangle size={13} />
                    <span><strong>{issue.title}</strong><small>{issue.detail}</small></span>
                  </button>
                )) : <div className="progression-clear"><CheckCircle2 size={17} /> Connected T/Y sizes progress correctly.</div>}
              </div>}
              <p>Checks for downstream size growth, overly aggressive reductions, and CFM that does not reconcile across a fitting.</p>
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
          <div className="status-card"><span className="pulse" /><div><strong>{calibrating && pdf ? "Scale calibration" : activeTool === "measure" && pdf ? "Measurement tool" : symbolTools.includes(activeTool as SymbolKind) && pdf ? "HVAC symbol placement" : activeTool === "branch" && pdf ? "Smart T/Y placement" : continuingRunId ? "Extending connected branch run" : draft.length ? "Drawing in progress" : pdf ? "Construction plan loaded" : "Drawing engine ready"}</strong><small>{calibrating && pdf ? `Pick two points exactly ${referenceFeet} ft apart` : activeTool === "measure" && pdf ? "Pick two points to place a field dimension" : symbolTools.includes(activeTool as SymbolKind) && pdf ? "One click places · V selects · [ ] rotates" : activeTool === "branch" && pdf ? branchMessage || "Move over a blue supply run · one click places the fitting" : continuingRunId ? "Left-click: add route points · Shift: lock 45°/90° · Right-click: finish on the same run" : draft.length ? "Left-click: add point · Shift: lock 45°/90° · Right-click: finish · Esc: cancel" : pdf ? `${pdf.numPages} page PDF · ${drawings.length} drawing objects` : "Upload a plan to start drafting"}</small></div></div>
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
          <span>Verify structure, lighting, plumbing, ceiling height, and access before installation.</span>
          <span>Elevation labels marked EL VERIFY must be coordinated before duct installation.</span>
          <span>Final duct sizes, routing, fabricated dimensions, and airflow must be field verified.</span>
        </div>
        <div className="print-checks">
          <strong>AIRFLOW & VALIDATION SUMMARY</strong>
          <div>
            <span>Design airflow: {designAirflow().targetCfm} CFM</span>
            <span>Assigned diffusers: {designAirflow().supplyCfm} CFM ({designAirflow().percent}%)</span>
            <span>Assigned return: {designAirflow().returnCfm} CFM</span>
            <span>Duct elevations assigned: {drawings.filter((drawing) => drawingSystem(drawing) === activeSystem && ["supply", "return", "fresh"].includes(drawing.type) && !drawing.fitting && drawing.elevation?.trim()).length} of {drawings.filter((drawing) => drawingSystem(drawing) === activeSystem && ["supply", "return", "fresh"].includes(drawing.type) && !drawing.fitting).length}</span>
          </div>
          {validationIssues().filter((issue) => issue.severity !== "info").map((issue, index) => <span key={`${issue.title}-print-${index}`}>• {issue.title}: {issue.detail}</span>)}
          {!validationIssues().filter((issue) => issue.severity !== "info").length && <span>✓ No critical airflow or velocity issues detected.</span>}
        </div>
        {roomSchedule().length > 0 && <>
          <div className="print-section-heading room-print-heading">
            <strong>ROOM AIRFLOW SCHEDULE · {systemLabel(activeSystem)}</strong>
            <span>Supply, return, terminal count, and bedroom return-path review</span>
          </div>
          <table className="print-room-schedule">
            <thead>
              <tr><th>Room</th><th>Type</th><th>Supply</th><th>Return</th><th>Balance</th><th>Devices</th><th>Return path</th></tr>
            </thead>
            <tbody>
              {roomSchedule().map((room) => <tr key={`${room.name}-print`}>
                <td>{room.name}</td>
                <td>{room.type}</td>
                <td>{room.supplyCfm} CFM</td>
                <td>{room.returnCfm} CFM</td>
                <td>{room.balanceCfm > 0 ? "+" : ""}{room.balanceCfm} CFM</td>
                <td>{room.diffusers} S / {room.returns} R</td>
                <td>{room.needsReturn ? "REVIEW" : "OK"}</td>
              </tr>)}
            </tbody>
          </table>
        </>}
      </section>

      <footer>
        <span><i className="online" /> Ready</span>
        <span>{selectedIds.length ? `${selectedIds.length} object${selectedIds.length === 1 ? "" : "s"} selected · Shift-click adds · Ctrl+D duplicates` : "0 objects selected · drag a box to select"}</span>
        <span><Ruler size={11} /> {scaleLabel}</span>
        <span className="footer-right">{saveState === "saving" ? "Autosaving…" : "All changes saved"} · HVAC Plan Studio v0.2.0</span>
      </footer>
    </main>
  );
}
