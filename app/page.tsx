"use client";

import { ChangeEvent, Component, DragEvent, ErrorInfo, PointerEvent, ReactNode, WheelEvent as ReactWheelEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { checkDriveConfiguration, loadPdfFromDriveId, pickPdfFromDrive } from "./googleDrive";
import CloudProjectsPanel, { type CloudProjectRisk } from "./CloudProjectsPanel";
import GuidedProjectSetup, { type ProjectSetupValues } from "./GuidedProjectSetup";
import ProjectCommandPalette, { type ProjectCommand } from "./ProjectCommandPalette";
import ProjectHome from "./ProjectHome";
import {
  listCloudApprovals,
  listCloudRevisions,
  listCloudWorkItems,
  issueCloudFieldRelease,
  type CloudProject,
  type CloudRevision,
} from "./cloudProjects";
import { buildSystemWorkflow, type WorkflowStageId, type WorkflowSummary } from "./workflowEngine";
import {
  AirVent,
  AlertTriangle,
  ArrowRight,
  Box,
  CircleDot,
  Cloud,
  CloudUpload,
  Copy,
  DraftingCompass,
  Fan,
  FileText,
  FolderOpen,
  HardDrive,
  Home as HomeIcon,
  Grid3X3,
  Gauge,
  Lock,
  MousePointer2,
  PanelTop,
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
  Scissors,
  Search,
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
  { id: "returnGrille", label: "Return grille", icon: PanelTop, tone: "red" },
  { id: "equipment", label: "Equipment", icon: Box },
  { id: "fan", label: "Exhaust fan", icon: Fan },
  { id: "damper", label: "Balance damper", icon: Gauge, tone: "yellow" },
  { id: "motorDamper", label: "Motorized OA damper", icon: ToggleLeft, tone: "green" },
  { id: "reducer", label: "Reducer / transition", icon: FlipHorizontal2, tone: "yellow" },
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
type SnapKind = "endpoint" | "fitting port" | "equipment port" | "intersection" | "midpoint" | "nearest" | "grid";
type SnapInfo = { point: Point; kind: SnapKind; label: string };
type AlignmentGuide = { axis: "x" | "y"; value: number };
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
  { id: "supply-sidewall-14x6", category: "Supply air", kind: "diffuser", label: "WIDE SIDEWALL REGISTER", size: "14×6", cfm: 225, variant: "register", elevation: "HIGH WALL" },
  { id: "supply-sidewall-10x6", category: "Supply air", kind: "diffuser", label: "SIDEWALL REGISTER", size: "10×6", cfm: 150, variant: "register", elevation: "HIGH WALL" },
  { id: "supply-square-8", category: "Supply air", kind: "diffuser", label: "SMALL 4-WAY SUPPLY", size: "8×8", cfm: 100, variant: "4way", elevation: "CEILING" },
  { id: "supply-square-10", category: "Supply air", kind: "diffuser", label: "4-WAY SUPPLY", size: "10×10", cfm: 150, variant: "4way", elevation: "CEILING" },
  { id: "supply-square-14", category: "Supply air", kind: "diffuser", label: "LARGE 4-WAY SUPPLY", size: "14×14", cfm: 300, variant: "4way", elevation: "CEILING" },
  { id: "supply-can-square", category: "Supply air", kind: "diffuser", label: "SQUARE SUPPLY CAN", size: "12×12", cfm: 225, variant: "supply-can", elevation: "CEILING" },
  { id: "supply-boot", category: "Supply air", kind: "diffuser", label: "REGISTER BOOT", size: "12×4", cfm: 125, variant: "boot", elevation: "HIGH WALL" },
  { id: "supply-floor", category: "Supply air", kind: "diffuser", label: "FLOOR REGISTER", size: "4×10", cfm: 100, variant: "floor", elevation: "FLOOR" },
  { id: "supply-perforated", category: "Supply air", kind: "diffuser", label: "PERFORATED SUPPLY", size: "24×24", cfm: 300, variant: "perforated", elevation: "CEILING" },
  { id: "supply-swirl", category: "Supply air", kind: "diffuser", label: "SWIRL DIFFUSER", size: "12×12", cfm: 250, variant: "swirl", elevation: "CEILING" },
  { id: "supply-jet", category: "Supply air", kind: "diffuser", label: "JET NOZZLE", size: "10", cfm: 300, variant: "jet", elevation: "HIGH WALL" },
  { id: "supply-curved-1way", category: "Supply air", kind: "diffuser", label: "1-WAY CURVED BLADE REGISTER", size: "12×6", cfm: 150, variant: "curved-1", elevation: "HIGH WALL" },
  { id: "supply-curved-2way", category: "Supply air", kind: "diffuser", label: "2-WAY CURVED BLADE REGISTER", size: "12×6", cfm: 175, variant: "curved-2", elevation: "HIGH WALL" },
  { id: "supply-curved-3way", category: "Supply air", kind: "diffuser", label: "3-WAY CURVED BLADE REGISTER", size: "12×12", cfm: 200, variant: "curved-3", elevation: "CEILING" },
  { id: "supply-curved-4way", category: "Supply air", kind: "diffuser", label: "4-WAY CURVED BLADE REGISTER", size: "12×12", cfm: 225, variant: "curved-4", elevation: "CEILING" },
  { id: "supply-single-deflection", category: "Supply air", kind: "diffuser", label: "SINGLE DEFLECTION GRILLE", size: "12×6", cfm: 175, variant: "single-deflection", elevation: "HIGH WALL" },
  { id: "supply-double-deflection", category: "Supply air", kind: "diffuser", label: "DOUBLE DEFLECTION GRILLE", size: "12×6", cfm: 200, variant: "double-deflection", elevation: "HIGH WALL" },
  { id: "supply-modular-1way", category: "Supply air", kind: "diffuser", label: "1-WAY MODULAR CORE DIFFUSER", size: "24×24", cfm: 275, variant: "modular-1", elevation: "CEILING" },
  { id: "supply-modular-2way", category: "Supply air", kind: "diffuser", label: "2-WAY MODULAR CORE DIFFUSER", size: "24×24", cfm: 325, variant: "modular-2", elevation: "CEILING" },
  { id: "supply-modular-3way", category: "Supply air", kind: "diffuser", label: "3-WAY MODULAR CORE DIFFUSER", size: "24×24", cfm: 350, variant: "modular-3", elevation: "CEILING" },
  { id: "supply-modular-4way", category: "Supply air", kind: "diffuser", label: "4-WAY MODULAR CORE DIFFUSER", size: "24×24", cfm: 400, variant: "modular-4", elevation: "CEILING" },
  { id: "supply-high-velocity", category: "Supply air", kind: "diffuser", label: "HIGH VELOCITY DIFFUSER", size: "12×12", cfm: 250, variant: "high-velocity", elevation: "CEILING" },
  { id: "supply-plaque", category: "Supply air", kind: "diffuser", label: "PLAQUE FACE DIFFUSER", size: "24×24", cfm: 350, variant: "plaque", elevation: "CEILING" },
  { id: "supply-cone", category: "Supply air", kind: "diffuser", label: "CONE DIFFUSER", size: "12×12", cfm: 250, variant: "cone", elevation: "CEILING" },
  { id: "supply-tbar-round", category: "Supply air", kind: "diffuser", label: "T-BAR ROUND NECK DIFFUSER", size: "24×24", cfm: 350, variant: "tbar-round", elevation: "CEILING" },
  { id: "supply-spiral-single", category: "Supply air", kind: "diffuser", label: "SPIRAL DUCT SINGLE DEFLECTION", size: "16×6", cfm: 250, variant: "spiral-single", elevation: "EXPOSED DUCT" },
  { id: "supply-spiral-double", category: "Supply air", kind: "diffuser", label: "SPIRAL DUCT DOUBLE DEFLECTION", size: "16×6", cfm: 300, variant: "spiral-double", elevation: "EXPOSED DUCT" },
  { id: "supply-baseboard", category: "Supply air", kind: "diffuser", label: "BASEBOARD SUPPLY REGISTER", size: "14×6", cfm: 150, variant: "baseboard-supply", elevation: "BASEBOARD" },
  { id: "supply-toe-space", category: "Supply air", kind: "diffuser", label: "TOE SPACE SUPPLY REGISTER", size: "4×12", cfm: 75, variant: "toe-space", elevation: "TOE SPACE" },
  { id: "supply-slot-1", category: "Supply air", kind: "diffuser", label: "1-SLOT LINEAR DIFFUSER", size: "1-SLOT", cfm: 100, variant: "slot-1", elevation: "CEILING" },
  { id: "supply-slot-4", category: "Supply air", kind: "diffuser", label: "4-SLOT LINEAR DIFFUSER", size: "4-SLOT", cfm: 300, variant: "slot-4", elevation: "CEILING" },
  { id: "return-standard", category: "Return air", kind: "returnGrille", label: "RETURN GRILLE", size: "14×14", cfm: 400, variant: "grille", elevation: "CEILING" },
  { id: "return-can-rect", category: "Return air", kind: "returnGrille", label: "RECTANGULAR RETURN CAN", size: "20×12", cfm: 600, variant: "return-can", elevation: "CEILING" },
  { id: "return-filter", category: "Return air", kind: "returnGrille", label: "FILTER RETURN", size: "20×20", cfm: 800, variant: "filter", elevation: "CEILING" },
  { id: "return-eggcrate", category: "Return air", kind: "returnGrille", label: "EGGCRATE RETURN", size: "14×14", cfm: 400, variant: "eggcrate", elevation: "CEILING" },
  { id: "return-door", category: "Return air", kind: "returnGrille", label: "DOOR TRANSFER GRILLE", size: "12×12", cfm: 250, variant: "transfer", elevation: "HIGH WALL" },
  { id: "return-highwall-14x6", category: "Return air", kind: "returnGrille", label: "HIGH-WALL RETURN", size: "14×6", cfm: 250, variant: "bar", elevation: "HIGH WALL" },
  { id: "return-wide-20x12", category: "Return air", kind: "returnGrille", label: "WIDE RETURN GRILLE", size: "20×12", cfm: 600, variant: "grille", elevation: "HIGH WALL" },
  { id: "return-floor-12x6", category: "Return air", kind: "returnGrille", label: "FLOOR RETURN", size: "12×6", cfm: 200, variant: "floor", elevation: "FLOOR" },
  { id: "return-jump", category: "Return air", kind: "returnGrille", label: "JUMP DUCT GRILLE", size: "12×12", cfm: 250, variant: "jump", elevation: "CEILING" },
  { id: "return-perforated", category: "Return air", kind: "returnGrille", label: "PERFORATED RETURN", size: "24×24", cfm: 600, variant: "perforated", elevation: "CEILING" },
  { id: "return-slot", category: "Return air", kind: "returnGrille", label: "LINEAR SLOT RETURN", size: "2-SLOT", cfm: 200, variant: "slot-return", elevation: "CEILING" },
  { id: "return-fixed-bar", category: "Return air", kind: "returnGrille", label: "FIXED BAR RETURN GRILLE", size: "20×12", cfm: 600, variant: "fixed-bar", elevation: "HIGH WALL" },
  { id: "return-filter-bar", category: "Return air", kind: "returnGrille", label: "FILTER BAR RETURN GRILLE", size: "20×20", cfm: 800, variant: "filter-bar", elevation: "HIGH WALL" },
  { id: "return-baseboard", category: "Return air", kind: "returnGrille", label: "BASEBOARD RETURN GRILLE", size: "24×8", cfm: 350, variant: "baseboard-return", elevation: "BASEBOARD" },
  { id: "return-toe-space", category: "Return air", kind: "returnGrille", label: "TOE SPACE RETURN GRILLE", size: "4×12", cfm: 100, variant: "toe-return", elevation: "TOE SPACE" },
  { id: "return-heavy-floor", category: "Return air", kind: "returnGrille", label: "HEAVY DUTY FLOOR RETURN", size: "12×6", cfm: 250, variant: "heavy-floor", elevation: "FLOOR" },
  { id: "return-tbar-eggcrate", category: "Return air", kind: "returnGrille", label: "T-BAR EGGCRATE RETURN", size: "24×24", cfm: 650, variant: "tbar-eggcrate", elevation: "CEILING" },
  { id: "return-door-louver", category: "Return air", kind: "returnGrille", label: "DOOR LOUVER RETURN", size: "12×12", cfm: 250, variant: "door-louver", elevation: "DOOR" },
  { id: "return-slot-1", category: "Return air", kind: "returnGrille", label: "1-SLOT LINEAR RETURN", size: "1-SLOT", cfm: 125, variant: "slot-return-1", elevation: "CEILING" },
  { id: "return-slot-4", category: "Return air", kind: "returnGrille", label: "4-SLOT LINEAR RETURN", size: "4-SLOT", cfm: 350, variant: "slot-return-4", elevation: "CEILING" },
  { id: "equipment-airhandler", category: "Equipment", kind: "equipment", label: "SYSTEM 1 · 3 TON AHU", size: "3 TON", cfm: 1200, variant: "air-handler" },
  { id: "equipment-vertical-airhandler", category: "Equipment", kind: "equipment", label: "VERTICAL AIR HANDLER · 3 TON", size: "3 TON", cfm: 1200, variant: "vertical-air-handler" },
  { id: "equipment-vertical-furnace", category: "Equipment", kind: "equipment", label: "VERTICAL UPFLOW FURNACE · 3 TON", size: "3 TON", cfm: 1200, variant: "vertical-furnace" },
  { id: "equipment-furnace", category: "Equipment", kind: "equipment", label: "SYSTEM 1 · 3 TON FURNACE", size: "3 TON", cfm: 1200, variant: "furnace" },
  { id: "equipment-package", category: "Equipment", kind: "equipment", label: "SYSTEM 1 · 3 TON PACKAGE UNIT", size: "3 TON", cfm: 1200, variant: "package" },
  { id: "equipment-fancoil", category: "Equipment", kind: "equipment", label: "SYSTEM 1 · 3 TON FAN COIL", size: "3 TON", cfm: 1200, variant: "fan-coil" },
  { id: "equipment-heatpump-airhandler", category: "Equipment", kind: "equipment", label: "SYSTEM 1 · 3 TON HEAT-PUMP AHU", size: "3 TON", cfm: 1200, variant: "heat-pump-air-handler" },
  { id: "equipment-heatpump", category: "Equipment", kind: "equipment", label: "OUTDOOR HEAT PUMP · 3 TON", size: "3 TON", cfm: 0, variant: "heat-pump" },
  { id: "equipment-erv", category: "Equipment", kind: "equipment", label: "ERV-1", size: "ERV", cfm: 150, variant: "erv" },
  { id: "equipment-hrv", category: "Equipment", kind: "equipment", label: "HRV-1", size: "HRV", cfm: 150, variant: "hrv" },
  { id: "equipment-condenser", category: "Equipment", kind: "equipment", label: "CONDENSER · SYSTEM 1", size: "3 TON", cfm: 0, variant: "condenser" },
  { id: "equipment-minisplit", category: "Equipment", kind: "equipment", label: "MINI-SPLIT HEAD", size: "1 TON", cfm: 400, variant: "mini-split" },
  { id: "equipment-rtu", category: "Equipment", kind: "equipment", label: "RTU-1 · 3 TON", size: "3 TON", cfm: 1200, variant: "rtu" },
  { id: "equipment-makeup", category: "Equipment", kind: "equipment", label: "MAKE-UP AIR UNIT", size: "MAU-1", cfm: 1000, variant: "makeup-air" },
  { id: "equipment-humidifier", category: "Equipment", kind: "equipment", label: "HUMIDIFIER", size: "HUM-1", cfm: 0, variant: "humidifier" },
  { id: "equipment-dehumidifier", category: "Equipment", kind: "equipment", label: "DEHUMIDIFIER", size: "DH-1", cfm: 200, variant: "dehumidifier" },
  { id: "equipment-boiler", category: "Equipment", kind: "equipment", label: "BOILER", size: "B-1", cfm: 0, variant: "boiler" },
  { id: "equipment-supply-plenum", category: "Equipment", kind: "equipment", label: "SUPPLY PLENUM BOX", size: "PLENUM", cfm: 0, variant: "supply-plenum-box" },
  { id: "equipment-return-plenum", category: "Equipment", kind: "equipment", label: "RETURN PLENUM BOX", size: "PLENUM", cfm: 0, variant: "return-plenum-box" },
  { id: "device-exhaust", category: "Air devices", kind: "fan", label: "EF-1", size: "EF-1", cfm: 80, variant: "exhaust", elevation: "CEILING" },
  { id: "device-inline", category: "Air devices", kind: "fan", label: "INLINE FAN", size: "IF-1", cfm: 150, variant: "inline", elevation: "ABOVE CEILING" },
  { id: "device-roof-fan", category: "Air devices", kind: "fan", label: "ROOF EXHAUST FAN", size: "REF-1", cfm: 600, variant: "roof", elevation: "ROOF" },
  { id: "device-wall-fan", category: "Air devices", kind: "fan", label: "WALL EXHAUST FAN", size: "WEF-1", cfm: 350, variant: "wall", elevation: "HIGH WALL" },
  { id: "device-ceiling-fan", category: "Air devices", kind: "fan", label: "CEILING EXHAUST FAN", size: "CEF-1", cfm: 110, variant: "ceiling", elevation: "CEILING" },
  { id: "device-centrifugal-fan", category: "Air devices", kind: "fan", label: "CENTRIFUGAL FAN", size: "CF-1", cfm: 1200, variant: "centrifugal", elevation: "FLOOR" },
  { id: "device-cabinet-fan", category: "Air devices", kind: "fan", label: "CABINET SUPPLY FAN", size: "SF-1", cfm: 800, variant: "cabinet", elevation: "ABOVE CEILING" },
  { id: "device-plenum-fan", category: "Air devices", kind: "fan", label: "PLENUM FAN", size: "PF-1", cfm: 1500, variant: "plenum", elevation: "MECHANICAL ROOM" },
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

function symbolFamily(preset: SymbolPreset) {
  const variant = preset.variant;
  if (preset.category === "Supply air") {
    if (variant.startsWith("curved")) return "Curved blade registers";
    if (variant.includes("deflection") || variant.startsWith("spiral")) return "Adjustable & spiral grilles";
    if (variant.startsWith("slot")) return "Linear slot diffusers";
    if (["modular-1", "modular-2", "modular-3", "modular-4", "high-velocity", "plaque", "cone", "tbar-round", "perforated", "round", "swirl"].includes(variant)) return "Ceiling diffusers";
    return "Residential registers";
  }
  if (preset.category === "Return air") {
    if (variant.includes("filter")) return "Filter returns";
    if (variant.startsWith("slot-return")) return "Linear returns";
    if (["eggcrate", "tbar-eggcrate", "perforated"].includes(variant)) return "Ceiling returns";
    if (["baseboard-return", "toe-return", "floor", "heavy-floor", "transfer", "door-louver"].includes(variant)) return "Floor, door & baseboard";
    return "Fixed bar & louvered returns";
  }
  if (preset.category === "Equipment") return "Equipment assemblies";
  if (preset.kind === "fan") return "Fans";
  if (["damper", "motorDamper", "reducer"].includes(preset.kind)) return "Dampers & fittings";
  return "Controls & notes";
}

function symbolDimensions(size: string) {
  const parts = size.replace(/"/g, "").split(/[x×]/i).map(Number).filter(Number.isFinite);
  const ratio = parts.length > 1 ? Math.max(.35, Math.min(2.85, parts[0] / parts[1])) : 1;
  const nominalScale = parts.length > 1
    ? Math.max(.78, Math.min(1.25, Math.sqrt((parts[0] * parts[1]) / 144)))
    : 1;
  const width = (ratio >= 1 ? 24 * Math.sqrt(ratio) : 24) * nominalScale;
  const height = (ratio >= 1 ? 24 / Math.sqrt(ratio) : 24 / ratio) * nominalScale;
  return {
    width: Math.max(16, Math.min(42, width)),
    height: Math.max(11, Math.min(34, height)),
  };
}

function SymbolArtwork({ kind, variant = "", width = 24, height = 24 }: { kind: SymbolKind; variant?: string; width?: number; height?: number }) {
  const x = -width / 2;
  const y = -height / 2;
  const verticals = Array.from({ length: Math.max(3, Math.min(7, Math.round(width / 5))) }, (_, index) =>
    x + ((index + 1) * width) / (Math.max(3, Math.min(7, Math.round(width / 5))) + 1));
  const horizontals = [-.3, 0, .3].map((position) => position * height);
  const fanBlades = <path className="fan-blades" d="M 0 -2.5 C 9 -12 14 -3 6 2 M 2 1 C 6 14 -6 14 -6 5 M -2 1 C -14 -2 -9 -12 -2 -8" />;
  const supplyArrows = (directions: string[]) => directions.map((direction) => {
    const paths: Record<string, string> = {
      up: "M 0 -3 L 0 -13 M -4 -9 L 0 -13 L 4 -9",
      right: "M 3 0 L 13 0 M 9 -4 L 13 0 L 9 4",
      down: "M 0 3 L 0 13 M -4 9 L 0 13 L 4 9",
      left: "M -3 0 L -13 0 M -9 -4 L -13 0 L -9 4",
    };
    return <path className="air-pattern" key={direction} d={paths[direction]} />;
  });

  if (kind === "diffuser") {
    if (variant === "supply-can") return <>
      <rect className="supply-can-body" x={x} y={y + 3} width={width} height={height - 3} rx="2" />
      <circle className="supply-can-collar" cx="0" cy={y + 3} r={Math.max(4, Math.min(7, width / 4))} />
      <path className="supply-detail" d={`M ${x + 4} ${y + 9} L ${width / 2 - 4} ${y + 9} M ${x + 4} ${y + 14} L ${width / 2 - 4} ${y + 14} M ${x + 4} ${y + 19} L ${width / 2 - 4} ${y + 19}`} />
      <path className="air-pattern" d={`M 0 ${height / 2} L 0 ${height / 2 + 10} M -4 ${height / 2 + 6} L 0 ${height / 2 + 10} L 4 ${height / 2 + 6}`} />
      <text className="can-code supply-code" x={width / 2 - 5} y={height / 2 - 3} textAnchor="middle">S</text>
    </>;
    if (variant === "round") return <>
      <circle className="supply-face" cx="0" cy="0" r="11" />
      <circle className="supply-detail" cx="0" cy="0" r="6.5" />
      <path className="supply-detail" d="M -8 0 L 8 0 M 0 -8 L 0 8" />
      {supplyArrows(["up", "right", "down", "left"])}
    </>;
    if (variant === "jet") return <>
      <path className="supply-face" d="M -12 -8 L 4 -6 L 11 0 L 4 6 L -12 8 Z" />
      <ellipse className="supply-detail" cx="5" cy="0" rx="6" ry="5" />
      <path className="air-pattern" d="M 10 0 L 20 0 M 15 -4 L 20 0 L 15 4" />
    </>;
    if (variant.startsWith("curved-")) {
      const count = Number(variant.split("-")[1]) || 1;
      const directions = count === 1 ? ["right"] : count === 2 ? ["left", "right"] : count === 3 ? ["left", "right", "down"] : ["up", "right", "down", "left"];
      return <>
        <rect className="supply-face" x={x} y={y} width={width} height={height} rx="1.5" />
        {[-6, -2, 2, 6].map((offset) => <path className="supply-detail curved-vane" key={offset} d={`M ${x + 3} ${offset - 2} Q 0 ${offset + 3} ${width / 2 - 3} ${offset - 2}`} />)}
        <circle className="supply-detail curved-hub" cx="0" cy="0" r="2" />
        {supplyArrows(directions)}
      </>;
    }
    if (["single-deflection", "double-deflection"].includes(variant)) return <>
      <rect className="supply-face" x={x} y={y} width={width} height={height} rx="1" />
      {verticals.map((lineX, index) => <line className="supply-detail adjustable-vane" key={`v-${index}`} x1={lineX - 1.5} y1={y + 2} x2={lineX + 1.5} y2={height / 2 - 2} />)}
      {variant === "double-deflection" && horizontals.map((lineY, index) => <line className="supply-detail adjustable-vane secondary" key={`h-${index}`} x1={x + 2} y1={lineY + 1} x2={width / 2 - 2} y2={lineY - 1} />)}
      <path className="air-pattern" d={`M ${width / 2} 0 L ${width / 2 + 10} 0 M ${width / 2 + 6} -4 L ${width / 2 + 10} 0 L ${width / 2 + 6} 4`} />
    </>;
    if (variant.startsWith("modular-")) {
      const count = Number(variant.split("-")[1]) || 4;
      const directions = count === 1 ? ["down"] : count === 2 ? ["left", "right"] : count === 3 ? ["left", "right", "down"] : ["up", "right", "down", "left"];
      return <>
        <rect className="supply-face tbar-panel" x={x} y={y} width={width} height={height} rx="1" />
        <path className="supply-detail modular-core" d={`M ${x + 4} ${y + 4} L 0 -2 L ${width / 2 - 4} ${y + 4} L 4 0 L ${width / 2 - 4} ${height / 2 - 4} L 0 2 L ${x + 4} ${height / 2 - 4} L -4 0 Z`} />
        {supplyArrows(directions)}
      </>;
    }
    if (variant === "high-velocity") return <>
      <rect className="supply-face" x={x} y={y} width={width} height={height} rx="1" />
      <rect className="supply-detail high-velocity-ring" x={x + 4} y={y + 4} width={width - 8} height={height - 8} rx="1" />
      <rect className="supply-detail high-velocity-ring" x={x + 8} y={y + 8} width={width - 16} height={height - 16} rx="1" />
      <circle className="supply-detail" cx="0" cy="0" r="2.2" />
      {supplyArrows(["up", "right", "down", "left"])}
    </>;
    if (variant === "plaque") return <>
      <rect className="supply-face tbar-panel" x={x} y={y} width={width} height={height} rx="1" />
      <rect className="supply-detail plaque-face" x={x + 5} y={y + 5} width={width - 10} height={height - 10} rx="1" />
      <path className="supply-detail" d={`M ${x + 5} ${y + 5} L ${x + 2} ${y + 2} M ${width / 2 - 5} ${y + 5} L ${width / 2 - 2} ${y + 2} M ${x + 5} ${height / 2 - 5} L ${x + 2} ${height / 2 - 2} M ${width / 2 - 5} ${height / 2 - 5} L ${width / 2 - 2} ${height / 2 - 2}`} />
    </>;
    if (variant === "cone") return <>
      <rect className="supply-face" x={x} y={y} width={width} height={height} rx="1" />
      <circle className="supply-detail cone-ring" cx="0" cy="0" r="9" />
      <circle className="supply-detail cone-ring" cx="0" cy="0" r="4.5" />
      <path className="supply-detail" d="M -6 -6 L 6 6 M 6 -6 L -6 6" />
    </>;
    if (variant === "tbar-round") return <>
      <rect className="supply-face tbar-panel" x={x} y={y} width={width} height={height} rx="1" />
      <circle className="supply-detail" cx="0" cy="0" r="9" />
      <circle className="supply-detail" cx="0" cy="0" r="4" />
      <path className="supply-detail" d={`M ${x + 3} 0 L -9 0 M 9 0 L ${width / 2 - 3} 0 M 0 ${y + 3} L 0 -9 M 0 9 L 0 ${height / 2 - 3}`} />
    </>;
    if (variant.startsWith("spiral-")) return <>
      <path className="spiral-saddle supply-face" d={`M ${x} ${y + 3} Q 0 ${y - 4} ${width / 2} ${y + 3} L ${width / 2} ${height / 2} L ${x} ${height / 2} Z`} />
      {verticals.map((lineX, index) => <line className="supply-detail adjustable-vane" key={`v-${index}`} x1={lineX - 1.5} y1={y + 3} x2={lineX + 1.5} y2={height / 2 - 2} />)}
      {variant === "spiral-double" && <path className="supply-detail" d={`M ${x + 3} -1 L ${width / 2 - 3} 1 M ${x + 3} 4 L ${width / 2 - 3} 2`} />}
      <path className="air-pattern" d={`M ${width / 2} 2 L ${width / 2 + 10} 2 M ${width / 2 + 6} -2 L ${width / 2 + 10} 2 L ${width / 2 + 6} 6`} />
    </>;
    if (variant === "baseboard-supply") return <>
      <path className="baseboard-body supply-face" d={`M ${x} ${height / 2} L ${x + 4} ${y} L ${width / 2 - 4} ${y} L ${width / 2} ${height / 2} Z`} />
      {horizontals.map((lineY, index) => <line className="supply-detail" key={index} x1={x + 5} y1={lineY} x2={width / 2 - 5} y2={lineY} />)}
      <path className="air-pattern" d={`M 0 ${y} L 0 ${y - 10} M -4 ${y - 6} L 0 ${y - 10} L 4 ${y - 6}`} />
    </>;
    if (variant === "toe-space") return <>
      <rect className="supply-face" x="-20" y="-5" width="40" height="10" rx="1" />
      {[-12, -6, 0, 6, 12].map((lineX) => <line className="supply-detail" key={lineX} x1={lineX} y1="-3" x2={lineX} y2="3" />)}
      <path className="air-pattern" d="M 0 -5 L 0 -15 M -4 -11 L 0 -15 L 4 -11" />
    </>;
    if (variant === "slot" || variant.startsWith("slot-")) {
      const slotCount = variant === "slot" ? 2 : Math.max(1, Number(variant.split("-")[1]) || 1);
      const slotLines = Array.from({ length: slotCount }, (_, index) => ((index + 1) * 12) / (slotCount + 1) - 6);
      return <>
      <rect className="supply-face" x="-19" y="-6" width="38" height="12" rx="1" />
      {slotLines.map((lineY) => <line className="supply-detail slot-blade" key={lineY} x1="-15" y1={lineY} x2="15" y2={lineY} />)}
      <path className="air-pattern" d="M -11 6 L -11 12 M -14 9 L -11 12 L -8 9 M 11 6 L 11 12 M 8 9 L 11 12 L 14 9" />
      </>;
    }
    if (variant === "perforated") return <>
      <rect className="supply-face" x={x} y={y} width={width} height={height} rx="1" />
      {[-6, 0, 6].map((cx) => [-6, 0, 6].map((cy) => <circle className="perforation supply-detail" key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.15" />))}
      {supplyArrows(["up", "right", "down", "left"])}
    </>;
    if (variant === "swirl") return <>
      <rect className="supply-face" x={x} y={y} width={width} height={height} rx="1" />
      <circle className="supply-detail" cx="0" cy="0" r="2.5" />
      <path className="supply-detail" d="M 1 -2 C 9 -11 13 -5 8 0 M 2 1 C 10 7 5 12 0 8 M -1 2 C -9 11 -13 5 -8 0 M -2 -1 C -10 -7 -5 -12 0 -8" />
    </>;
    if (["register", "floor", "boot"].includes(variant)) return <>
      {variant === "boot" && <path className="boot-body" d={`M ${x + 3} ${y} L ${x + 7} ${y - 7} L ${width / 2 - 7} ${y - 7} L ${width / 2 - 3} ${y}`} />}
      <rect className="supply-face" x={x} y={y} width={width} height={height} rx={variant === "boot" ? 3 : 1} />
      {variant === "floor"
        ? verticals.map((lineX, index) => <line className="supply-detail floor-slat" key={index} x1={lineX - 2} y1={y + 2} x2={lineX + 2} y2={height / 2 - 2} />)
        : horizontals.map((lineY, index) => <line className="supply-detail register-vane" key={index} x1={x + 3} y1={lineY} x2={width / 2 - 3} y2={lineY} />)}
      {variant === "register" && <path className="air-pattern" d={`M ${width / 2} 0 L ${width / 2 + 9} 0 M ${width / 2 + 5} -4 L ${width / 2 + 9} 0 L ${width / 2 + 5} 4`} />}
    </>;
    const directions = variant === "1way" ? ["down"] : variant === "2way" ? ["left", "right"] : variant === "3way" ? ["left", "right", "down"] : ["up", "right", "down", "left"];
    return <>
      <rect className="supply-face" x={x} y={y} width={width} height={height} rx="1" />
      <path className="supply-detail" d={`M ${x + 3} ${y + 3} L 0 0 L ${width / 2 - 3} ${y + 3} M ${width / 2 - 3} ${height / 2 - 3} L 0 0 L ${x + 3} ${height / 2 - 3}`} />
      {supplyArrows(directions)}
    </>;
  }

  if (kind === "returnGrille") {
    if (variant === "return-can") return <>
      <rect className="return-can-body" x={x} y={y} width={width - 4} height={height} rx="2" />
      <circle className="return-can-collar" cx={width / 2 - 3} cy="0" r={Math.max(4, Math.min(7, height / 3))} />
      {verticals.slice(0, 5).map((lineX, index) => <line className="return-detail" key={index} x1={lineX - 2} y1={y + 4} x2={lineX - 2} y2={height / 2 - 4} />)}
      <path className="return-intake" d={`M ${x - 9} 0 L ${x - 2} 0 M ${x - 6} -4 L ${x - 2} 0 L ${x - 6} 4`} />
      <text className="can-code return-code" x={x + 5} y={height / 2 - 3} textAnchor="middle">R</text>
    </>;
    if (variant.startsWith("slot-return")) {
      const slotCount = variant === "slot-return" ? 2 : Math.max(1, Number(variant.split("-").at(-1)) || 1);
      const slotLines = Array.from({ length: slotCount }, (_, index) => ((index + 1) * 12) / (slotCount + 1) - 6);
      return <>
        <rect className="return-face" x="-19" y="-6" width="38" height="12" rx="1" />
        {slotLines.map((lineY) => <line className="return-detail slot-blade" key={lineY} x1="-15" y1={lineY} x2="15" y2={lineY} />)}
        <path className="return-intake" d="M -11 -13 L -11 -7 M -14 -10 L -11 -7 L -8 -10 M 11 -13 L 11 -7 M 8 -10 L 11 -7 L 14 -10" />
        <text className="return-badge" x="0" y="3" textAnchor="middle">R</text>
      </>;
    }
    if (variant === "jump") return <>
      <rect className="return-face" x="-18" y="-11" width="14" height="22" rx="1" />
      <rect className="return-face" x="4" y="-11" width="14" height="22" rx="1" />
      <path className="return-detail" d="M -15 -7 L -7 -7 M -15 -2 L -7 -2 M -15 3 L -7 3 M -15 8 L -7 8 M 7 -7 L 15 -7 M 7 -2 L 15 -2 M 7 3 L 15 3 M 7 8 L 15 8" />
      <path className="return-intake" d="M -4 -4 C 0 -10 0 -10 4 -4 M -4 4 C 0 10 0 10 4 4" />
    </>;
    if (variant === "filter-bar") return <>
      <rect className="return-face" x={x} y={y} width={width} height={height} rx="3" />
      <rect className="filter-media" x={x + 3} y={y + 3} width={width - 6} height={height - 6} rx="1" />
      {horizontals.map((lineY, index) => <line className="return-detail fixed-bar" key={index} x1={x + 4} y1={lineY - 1} x2={width / 2 - 4} y2={lineY + 1} />)}
      <text className="return-badge" x="0" y="3" textAnchor="middle">F</text>
    </>;
    if (variant === "fixed-bar") return <>
      <rect className="return-face" x={x} y={y} width={width} height={height} rx="1" />
      {horizontals.map((lineY, index) => <line className="return-detail fixed-bar" key={index} x1={x + 3} y1={lineY - 1.5} x2={width / 2 - 3} y2={lineY + 1.5} />)}
      <path className="return-intake" d={`M 0 ${y - 8} L 0 ${y - 2} M -4 ${y - 6} L 0 ${y - 2} L 4 ${y - 6}`} />
      <text className="return-badge" x={width / 2 - 4} y={height / 2 - 3} textAnchor="middle">R</text>
    </>;
    if (variant === "tbar-eggcrate") return <>
      <rect className="return-face tbar-panel" x={x} y={y} width={width} height={height} rx="1" />
      <rect className="return-detail" x={x + 4} y={y + 4} width={width - 8} height={height - 8} rx=".5" />
      {verticals.map((lineX, index) => <line className="return-detail" key={`v-${index}`} x1={lineX} y1={y + 5} x2={lineX} y2={height / 2 - 5} />)}
      {horizontals.map((lineY, index) => <line className="return-detail" key={`h-${index}`} x1={x + 5} y1={lineY} x2={width / 2 - 5} y2={lineY} />)}
      <text className="return-badge" x={width / 2 - 4} y={height / 2 - 3} textAnchor="middle">R</text>
    </>;
    if (variant === "door-louver") return <>
      <rect className="return-face" x="-12" y="-18" width="24" height="36" rx="1" />
      {[-12, -7, -2, 3, 8, 13].map((lineY) => <path className="return-detail door-louver" key={lineY} d={`M -9 ${lineY - 2} L 0 ${lineY + 1} L 9 ${lineY - 2}`} />)}
      <path className="return-intake" d="M -19 0 L -13 0 M -17 -4 L -13 0 L -17 4" />
      <text className="return-badge" x="0" y="3" textAnchor="middle">R</text>
    </>;
    if (["baseboard-return", "toe-return"].includes(variant)) return <>
      {variant === "baseboard-return"
        ? <path className="baseboard-body return-face" d={`M ${x} ${height / 2} L ${x + 4} ${y} L ${width / 2 - 4} ${y} L ${width / 2} ${height / 2} Z`} />
        : <rect className="return-face" x="-20" y="-5" width="40" height="10" rx="1" />}
      {variant === "baseboard-return"
        ? horizontals.map((lineY, index) => <line className="return-detail" key={index} x1={x + 5} y1={lineY} x2={width / 2 - 5} y2={lineY} />)
        : [-12, -6, 0, 6, 12].map((lineX) => <line className="return-detail" key={lineX} x1={lineX} y1="-3" x2={lineX} y2="3" />)}
      <path className="return-intake" d={`M 0 ${y - 9} L 0 ${y - 2} M -4 ${y - 6} L 0 ${y - 2} L 4 ${y - 6}`} />
      <text className="return-badge" x={width / 2 - 4} y={height / 2 - 3} textAnchor="middle">R</text>
    </>;
    if (variant === "heavy-floor") return <>
      <rect className="return-face heavy-floor-frame" x={x} y={y} width={width} height={height} rx="1" />
      {verticals.map((lineX, index) => <line className="return-detail heavy-floor-bar" key={`v-${index}`} x1={lineX - 2} y1={y + 2} x2={lineX + 2} y2={height / 2 - 2} />)}
      <line className="return-detail heavy-floor-bar" x1={x + 2} y1="0" x2={width / 2 - 2} y2="0" />
      <path className="return-intake" d={`M 0 ${y - 8} L 0 ${y - 2} M -4 ${y - 6} L 0 ${y - 2} L 4 ${y - 6}`} />
      <text className="return-badge" x={width / 2 - 4} y={height / 2 - 3} textAnchor="middle">R</text>
    </>;
    return <>
      <rect className="return-face" x={x} y={y} width={width} height={height} rx={variant === "filter" ? 3 : 1} />
      {variant === "eggcrate" ? <>
        {verticals.map((lineX, index) => <line className="return-detail" key={`v-${index}`} x1={lineX} y1={y + 2} x2={lineX} y2={height / 2 - 2} />)}
        {horizontals.map((lineY, index) => <line className="return-detail" key={`h-${index}`} x1={x + 2} y1={lineY} x2={width / 2 - 2} y2={lineY} />)}
      </> : variant === "filter" ? <>
        <rect className="filter-media" x={x + 3} y={y + 3} width={width - 6} height={height - 6} rx="1" />
        <path className="return-detail" d={`M ${x + 5} ${y + 5} L ${width / 2 - 5} ${height / 2 - 5} M ${width / 2 - 5} ${y + 5} L ${x + 5} ${height / 2 - 5}`} />
        <text className="return-badge" x="0" y="3" textAnchor="middle">F</text>
      </> : variant === "perforated" ? <>
        {[-6, 0, 6].map((cx) => [-6, 0, 6].map((cy) => <circle className="perforation return-detail" key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.15" />))}
      </> : variant === "transfer" ? <>
        <path className="return-detail" d={`M ${x + 3} -5 L ${width / 2 - 3} -5 M ${x + 3} 0 L ${width / 2 - 3} 0 M ${x + 3} 5 L ${width / 2 - 3} 5`} />
        <path className="return-intake" d="M -6 -9 L 0 -5 L 6 -9 M -6 9 L 0 5 L 6 9" />
      </> : variant === "floor" ? verticals.map((lineX, index) =>
        <line className="return-detail floor-slat" key={index} x1={lineX - 2} y1={y + 2} x2={lineX + 2} y2={height / 2 - 2} />
      ) : horizontals.map((lineY, index) =>
        <line className="return-detail return-louver" key={index} x1={x + 3} y1={lineY - 2} x2={width / 2 - 3} y2={lineY + 2} />
      )}
      {!["filter", "transfer"].includes(variant) && <text className="return-badge" x={width / 2 - 4} y={height / 2 - 3} textAnchor="middle">R</text>}
      {["grille", "bar", "floor", "perforated"].includes(variant) && <path className="return-intake" d={`M 0 ${y - 8} L 0 ${y - 2} M -4 ${y - 6} L 0 ${y - 2} L 4 ${y - 6}`} />}
    </>;
  }

  if (kind === "equipment") {
    const horizontalUnit = (code: string, internals: "coil" | "flame" | "fan" | "split") => <>
      <path className="return-plenum" d="M -37 -8 L -17 -11 L -17 11 L -37 8 Z" />
      <rect className="equipment-body" x="-17" y="-13" width="34" height="26" rx="2" />
      <path className="supply-plenum" d="M 17 -11 L 37 -8 L 37 8 L 17 11 Z" />
      <path className="return-flow" d="M -33 0 L -20 0 M -24 -4 L -20 0 L -24 4" />
      <path className="supply-flow" d="M 20 0 L 33 0 M 29 -4 L 33 0 L 29 4" />
      {internals === "coil" && <path className="unit-detail" d="M -11 -8 L -2 -8 L -2 8 L -11 8 M 2 -8 L 12 -8 L 12 8 L 2 8 M 4 -6 L 10 6 M 10 -6 L 4 6" />}
      {internals === "fan" && <><circle className="unit-fan" cx="-6" cy="0" r="7" />{fanBlades}<path className="unit-detail" d="M 5 -8 L 12 -8 L 12 8 L 5 8 M 7 -6 L 10 6" /></>}
      {internals === "flame" && <path className="unit-detail flame" d="M -7 7 C -13 0 -5 -7 0 -10 C 1 -4 10 -1 7 7 C 4 13 -4 12 -7 7 Z M 5 -8 L 12 -8 L 12 8 L 5 8" />}
      {internals === "split" && <path className="unit-detail" d="M -12 -8 L -1 -8 L -1 8 L -12 8 M 3 -8 L 12 -8 L 12 8 L 3 8 M 5 -5 L 10 5 M 10 -5 L 5 5" />}
      <text className="plenum-code return-code" x="-28" y="3" textAnchor="middle">R</text>
      <text className="plenum-code supply-code" x="28" y="3" textAnchor="middle">S</text>
      <text className="equipment-code" x="0" y="4" textAnchor="middle">{code}</text>
    </>;
    const verticalUnit = (code: string, heat: boolean) => <>
      <path className="supply-plenum vertical-plenum" d="M -10 -40 L 10 -40 L 14 -21 L -14 -21 Z" />
      <rect className="equipment-body vertical-unit-body" x="-16" y="-21" width="32" height="42" rx="2" />
      <path className="return-plenum vertical-plenum" d="M -14 21 L 14 21 L 10 40 L -10 40 Z" />
      <path className="supply-flow vertical-flow" d="M 0 -23 L 0 -35 M -4 -31 L 0 -35 L 4 -31" />
      <path className="return-flow vertical-flow" d="M 0 35 L 0 23 M -4 27 L 0 23 L 4 27" />
      <path className="unit-detail vertical-coil" d="M -11 -16 L 11 -16 L 11 -4 L -11 -4 Z M -8 -14 L 8 -6 M 8 -14 L -8 -6" />
      <circle className="unit-fan vertical-unit-fan" cx="0" cy="9" r="7" />
      <path className="fan-blades vertical-unit-blades" d="M 0 6 C 7 0 11 7 5 10 M 2 10 C 5 18 -5 18 -5 12 M -2 10 C -11 8 -7 1 -1 4" />
      {heat && <path className="unit-detail flame vertical-flame" d="M -5 18 C -9 13 -3 8 0 5 C 1 9 7 11 5 17 C 3 21 -3 21 -5 18 Z" />}
      <text className="plenum-code supply-code" x="0" y="-27" textAnchor="middle">S</text>
      <text className="plenum-code return-code" x="0" y="33" textAnchor="middle">R</text>
      <text className="equipment-code vertical-unit-code" x="0" y="1" textAnchor="middle">{code}</text>
    </>;
    if (variant === "air-handler") return horizontalUnit("AHU", "coil");
    if (variant === "heat-pump-air-handler") return horizontalUnit("HPAH", "coil");
    if (variant === "vertical-air-handler") return verticalUnit("VAH", false);
    if (variant === "vertical-furnace") return verticalUnit("VUF", true);
    if (variant === "fan-coil") return horizontalUnit("FCU", "fan");
    if (variant === "package") return horizontalUnit("PKG", "split");
    if (variant === "furnace") return horizontalUnit("FUR", "flame");
    if (variant === "supply-plenum-box") return <>
      <path className="supply-plenum standalone-plenum" d="M -24 -13 L 19 -10 L 27 -6 L 27 6 L 19 10 L -24 13 Z" />
      <path className="supply-flow" d="M -14 0 L 18 0 M 13 -5 L 19 0 L 13 5" />
      <text className="plenum-code supply-code" x="-7" y="3" textAnchor="middle">SUPPLY</text>
    </>;
    if (variant === "return-plenum-box") return <>
      <path className="return-plenum standalone-plenum" d="M -27 -6 L -19 -10 L 24 -13 L 24 13 L -19 10 L -27 6 Z" />
      <path className="return-flow" d="M 18 0 L -18 0 M -13 -5 L -19 0 L -13 5" />
      <text className="plenum-code return-code" x="6" y="3" textAnchor="middle">RETURN</text>
    </>;
    if (variant === "rtu") return <>
      <rect className="roof-curb" x="-25" y="-17" width="50" height="34" rx="2" />
      <rect className="equipment-body" x="-21" y="-13" width="42" height="26" rx="2" />
      <path className="return-plenum" d="M -18 13 L -3 13 L -3 23 L -18 23 Z" />
      <path className="supply-plenum" d="M 3 13 L 18 13 L 18 23 L 3 23 Z" />
      <circle className="unit-fan" cx="10" cy="-1" r="7" />
      <path className="unit-detail" d="M -17 -8 L -4 -8 L -4 8 L -17 8 M -14 -5 L -7 5 M -7 -5 L -14 5" />
      <text className="plenum-code return-code" x="-10.5" y="20" textAnchor="middle">R</text>
      <text className="plenum-code supply-code" x="10.5" y="20" textAnchor="middle">S</text>
      <text className="equipment-code" x="10" y="3" textAnchor="middle">RTU</text>
    </>;
    if (variant === "makeup-air") return <>
      <path className="outdoor-intake" d="M -38 -10 L -22 -10 L -17 0 L -22 10 L -38 10 Z" />
      <rect className="equipment-body" x="-22" y="-12" width="38" height="24" rx="2" />
      <path className="supply-plenum" d="M 16 -9 L 37 -6 L 37 6 L 16 9 Z" />
      <path className="unit-detail" d="M -17 -7 L -7 -7 L -7 7 L -17 7 M -4 -7 L 3 -7 L 3 7 L -4 7" />
      <path className="supply-flow" d="M 19 0 L 33 0 M 29 -4 L 33 0 L 29 4" />
      <text className="equipment-code" x="9" y="4" textAnchor="middle">MAU</text>
      <text className="oa-code" x="-29" y="3" textAnchor="middle">OA</text>
      <text className="plenum-code supply-code" x="27" y="3" textAnchor="middle">S</text>
    </>;
    if (["heat-pump", "condenser"].includes(variant)) return <>
      <rect className="outdoor-unit" x="-20" y="-20" width="40" height="40" rx="3" />
      <circle className="condenser-ring" cx="0" cy="0" r="14" />
      <circle className="unit-fan" cx="0" cy="0" r="2.5" />
      {fanBlades}
      <path className="coil-mark" d="M -16 -16 L -12 -12 M -8 -16 L -4 -12 M 0 -16 L 4 -12 M 8 -16 L 12 -12" />
      <text className="equipment-code" x="0" y="4" textAnchor="middle">{variant === "heat-pump" ? "HP" : "CU"}</text>
    </>;
    if (variant === "mini-split") return <>
      <rect className="mini-split-body" x="-25" y="-9" width="50" height="18" rx="6" />
      <path className="unit-detail" d="M -19 1 L 19 1 M -15 5 C -10 10 -5 10 -2 5 M 2 5 C 7 10 12 10 16 5" />
      <circle className="status-light" cx="17" cy="-4" r="1.5" />
      <text className="equipment-code" x="-12" y="-2" textAnchor="middle">MS</text>
    </>;
    if (["erv", "hrv"].includes(variant)) return <>
      <rect className="equipment-body" x="-22" y="-14" width="44" height="28" rx="2" />
      <path className="return-plenum" d="M -34 -10 L -22 -10 M -34 8 L -22 8" />
      <path className="supply-plenum" d="M 22 -8 L 34 -8 M 22 10 L 34 10" />
      <path className="energy-wheel" d="M -12 -9 L 12 9 M -12 9 L 12 -9 M -5 -12 L 5 12" />
      <path className="return-flow" d="M -32 -10 L -24 -10 M 24 10 L 32 10" />
      <path className="supply-flow" d="M -24 8 L -32 8 M 32 -8 L 24 -8" />
      <text className="equipment-code" x="0" y="4" textAnchor="middle">{variant === "hrv" ? "HRV" : "ERV"}</text>
      <text className="stream-code return-code" x="-29" y="-2" textAnchor="middle">RA</text>
      <text className="stream-code supply-code" x="29" y="2" textAnchor="middle">SA</text>
    </>;
    if (variant === "humidifier") return <>
      <rect className="equipment-body utility-body" x="-16" y="-16" width="32" height="32" rx="5" />
      <path className="water-mark" d="M 0 -11 C -9 0 -9 5 -9 8 C -9 15 9 15 9 8 C 9 3 5 -3 0 -11 Z M -5 7 C -2 11 3 11 5 7" />
      <path className="steam-mark" d="M -8 -21 C -11 -17 -5 -15 -8 -11 M 0 -21 C -3 -17 3 -15 0 -11 M 8 -21 C 5 -17 11 -15 8 -11" />
      <text className="equipment-code" x="0" y="5" textAnchor="middle">HUM</text>
    </>;
    if (variant === "dehumidifier") return <>
      <rect className="equipment-body utility-body" x="-22" y="-12" width="44" height="24" rx="4" />
      <circle className="unit-fan" cx="-10" cy="0" r="7" />
      <path className="water-mark" d="M 8 -8 C 1 1 2 8 8 8 C 14 8 15 1 8 -8 Z" />
      <path className="unit-detail" d="M 2 0 L 14 0" />
      <text className="equipment-code" x="-10" y="4" textAnchor="middle">DH</text>
    </>;
    if (variant === "boiler") return <>
      <circle className="boiler-body" cx="0" cy="0" r="17" />
      <path className="unit-detail flame" d="M -8 8 C -13 1 -5 -8 0 -12 C 1 -5 10 -1 8 8 C 5 14 -5 14 -8 8 Z" />
      <path className="pipe-mark" d="M -26 -6 L -17 -6 M 17 -6 L 26 -6 M -26 6 L -17 6 M 17 6 L 26 6" />
      <text className="equipment-code" x="0" y="7" textAnchor="middle">B</text>
    </>;
    return horizontalUnit("UNIT", "split");
  }

  if (kind === "fan") {
    if (variant === "inline") return <>
      <path className="fan-duct" d="M -25 -8 L -13 -8 M -25 8 L -13 8 M 13 -8 L 25 -8 M 13 8 L 25 8" />
      <path className="inline-housing" d="M -13 -10 L 13 -10 L 18 0 L 13 10 L -13 10 L -18 0 Z" />
      <circle className="fan-ring" cx="0" cy="0" r="8" />{fanBlades}
      <path className="fan-flow" d="M 18 0 L 27 0 M 23 -4 L 27 0 L 23 4" />
    </>;
    if (variant === "roof") return <>
      <path className="roof-line" d="M -24 13 L 24 13 M -18 13 L -15 7 L 15 7 L 18 13" />
      <path className="roof-cap" d="M -17 3 Q 0 -16 17 3 L 13 7 L -13 7 Z" />
      <circle className="fan-ring" cx="0" cy="2" r="7" />{fanBlades}
      <path className="exhaust-flow" d="M -8 -10 L -8 -19 M -12 -15 L -8 -19 L -4 -15 M 8 -10 L 8 -19 M 4 -15 L 8 -19 L 12 -15" />
    </>;
    if (variant === "wall") return <>
      <rect className="fan-frame" x="-16" y="-16" width="32" height="32" rx="2" />
      <path className="wall-louvers" d="M -13 -10 L 13 -10 M -13 -5 L 13 -5 M -13 0 L 13 0 M -13 5 L 13 5 M -13 10 L 13 10" />
      <circle className="fan-ring" cx="0" cy="0" r="10" />{fanBlades}
      <path className="fan-flow" d="M 17 0 L 26 0 M 22 -4 L 26 0 L 22 4" />
    </>;
    if (variant === "ceiling") return <>
      <rect className="fan-frame" x="-16" y="-16" width="32" height="32" rx="2" />
      <path className="ceiling-grille" d="M -12 -10 L 12 -10 M -12 -5 L 12 -5 M -12 0 L 12 0 M -12 5 L 12 5 M -12 10 L 12 10" />
      <circle className="fan-ring" cx="0" cy="0" r="9" />{fanBlades}
      <text className="fan-code" x="0" y="4" textAnchor="middle">CEF</text>
    </>;
    if (variant === "centrifugal") return <>
      <path className="scroll-housing" d="M 13 7 C 8 16 -10 16 -16 5 C -23 -9 -9 -21 6 -15 C 15 -12 17 -3 13 7 L 24 7 L 24 -3 L 14 -3" />
      <circle className="fan-ring" cx="-5" cy="0" r="8" />{fanBlades}
      <path className="fan-flow" d="M 15 2 L 26 2 M 22 -2 L 26 2 L 22 6" />
    </>;
    if (variant === "cabinet") return <>
      <rect className="fan-cabinet" x="-23" y="-13" width="46" height="26" rx="2" />
      <circle className="fan-ring" cx="-8" cy="0" r="8" />{fanBlades}
      <path className="fan-filter" d="M 5 -9 L 12 -9 L 12 9 L 5 9 M 7 -7 L 10 7" />
      <path className="fan-flow supply-flow" d="M 14 0 L 28 0 M 24 -4 L 28 0 L 24 4" />
      <text className="fan-code" x="18" y="-5" textAnchor="middle">SF</text>
    </>;
    if (variant === "plenum") return <>
      <path className="plenum-chamber" d="M -25 -15 L 18 -15 L 25 -8 L 25 15 L -25 15 Z" />
      <circle className="fan-ring" cx="-5" cy="0" r="10" />{fanBlades}
      <path className="fan-flow supply-flow" d="M 7 0 L 28 0 M 24 -4 L 28 0 L 24 4" />
      <text className="fan-code" x="16" y="-6" textAnchor="middle">PF</text>
    </>;
    return <>
      <rect className="fan-frame" x="-15" y="-15" width="30" height="30" rx="2" />
      <circle className="fan-ring" cx="0" cy="0" r="11" />{fanBlades}
      <path className="exhaust-flow" d="M -6 -17 L -6 -24 M -10 -20 L -6 -24 L -2 -20 M 6 -17 L 6 -24 M 2 -20 L 6 -24 L 10 -20" />
      <text className="fan-code" x="0" y="4" textAnchor="middle">EF</text>
    </>;
  }

  if (kind === "damper") {
    if (variant === "fire") return <>
      <rect className="damper-frame fire-damper" x="-14" y="-9" width="28" height="18" />
      <path className="damper-blade fire-blade" d="M -11 6 L 11 -6 M -7 7 L 7 -7 M -3 8 L 11 -6" />
      <text className="damper-code" x="0" y="4" textAnchor="middle">FD</text>
    </>;
    if (variant === "backdraft") return <>
      <rect className="damper-frame" x="-14" y="-9" width="28" height="18" />
      <path className="damper-blade" d="M -11 -6 L 0 0 L -11 6 M 11 -6 L 0 0 L 11 6" />
      <text className="damper-code" x="0" y="-11" textAnchor="middle">BDD</text>
    </>;
    return <>
      <circle className="damper-frame" cx="0" cy="0" r="11" />
      <path className="damper-blade" d="M -10 0 L 10 0 M -7 7 L 7 -7" />
      <text className="damper-code" x="0" y="-13" textAnchor="middle">VD</text>
    </>;
  }
  if (kind === "motorDamper") return <>
    <rect className="motor-frame" x="-15" y="-8" width="30" height="16" rx="2" />
    <path className="motor-blade" d="M -11 5 L 11 -5" />
    <path className="actuator-link" d="M 0 -8 L 0 -15 L 10 -15" />
    <rect className="actuator-box" x="8" y="-19" width="11" height="8" rx="1" />
    <text className="motor-code" x="13.5" y="-13" textAnchor="middle">M</text>
  </>;
  if (kind === "reducer") return <>
    <path className="transition-body" d="M -17 -11 L -17 11 L 17 6 L 17 -6 Z" />
    <path className="transition-center" d="M -11 0 L 11 0" />
    <text className="transition-code" x="0" y="-13" textAnchor="middle">RED</text>
  </>;
  if (kind === "thermostat") return <>
    <rect className="control-body" x="-10" y="-13" width="20" height="26" rx="3" />
    <rect className="control-screen" x="-6" y="-8" width="12" height="7" rx="1" />
    <circle className="control-button" cx="0" cy="6" r="3" />
    <text className="symbol-letter" x="0" y="-16" textAnchor="middle">T</text>
  </>;
  if (kind === "smoke") return <>
    <rect className="detector-body" x="-14" y="-9" width="28" height="18" rx="2" />
    <circle className="detector-sensor" cx="-4" cy="0" r="4" />
    <path className="detector-probe" d="M 14 0 L 25 0 M 20 -4 L 25 0 L 20 4" />
    <text className="detector-code" x="7" y="3" textAnchor="middle">SD</text>
  </>;
  if (kind === "airflow") return <path className="airflow-arrow" d="M -20 0 L 18 0 M 9 -8 L 18 0 L 9 8" />;
  return <>
    <path className="note-body" d="M -13 -12 L 7 -12 L 13 -6 L 13 12 L -13 12 Z M 7 -12 L 7 -6 L 13 -6" />
    <path className="note-lines" d="M -8 -5 L 7 -5 M -8 0 L 8 0 M -8 5 L 3 5" />
  </>;
}

type SymbolMeta = {
  kind: SymbolKind;
  label: string;
  rotation: number;
  scaleX?: number;
  scaleY?: number;
  variant?: string;
  neckSize?: string;
  connectedRunId?: string;
  connectedEnd?: "start" | "end";
  returnRunId?: string;
  returnEnd?: "start" | "end";
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
  lineWeight?: number;
  page: number;
  fitting?: FittingMeta;
  symbol?: SymbolMeta;
  measurement?: MeasurementMeta;
  cfm?: number;
  systemId?: string;
  roomName?: string;
  roomType?: "general" | "bedroom" | "bathroom" | "closet";
  elevation?: string;
  labelOffset?: Point;
};
type RoomAirflowPriority = "standard" | "high" | "low";
type RoomAirflowTarget = {
  supplyCfm: number;
  returnCfm: number;
  priority: RoomAirflowPriority;
};
type TerminalCfmProposal = {
  id: string;
  drawingId: string;
  kind: "supply" | "return";
  room: string;
  label: string;
  current: number;
  proposed: number;
  target: number;
  terminalCount: number;
  connected: boolean;
};
const primaryAirflowEquipmentVariants = new Set([
  "air-handler",
  "heat-pump-air-handler",
  "vertical-air-handler",
  "vertical-furnace",
  "furnace",
  "package",
  "fan-coil",
  "rtu",
]);
const runSizeOptions = ["4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16"];
const allowedResidentialFlexSizes = ["4", "6", "7", "8", "10", "12", "14", "16"];

function isPrimaryAirflowEquipment(drawing?: Drawing) {
  return Boolean(
    drawing?.symbol?.kind === "equipment" &&
    primaryAirflowEquipmentVariants.has(drawing.symbol.variant || "")
  );
}

function equipmentTypeName(variant = "") {
  const names: Record<string, string> = {
    "air-handler": "AHU",
    "heat-pump-air-handler": "HEAT-PUMP AHU",
    "vertical-air-handler": "VERTICAL AHU",
    "vertical-furnace": "VERTICAL FURNACE",
    furnace: "FURNACE",
    package: "PACKAGE UNIT",
    "fan-coil": "FAN COIL",
    "heat-pump": "OUTDOOR HEAT PUMP",
    condenser: "CONDENSER",
    rtu: "RTU",
  };
  return names[variant] || "";
}

export default function Home() {
  return <WorkspaceErrorBoundary>
    <HVACPlanStudioApp />
  </WorkspaceErrorBoundary>;
}
type DragState =
  | { kind: "point"; drawingId: string; pointIndex: number; before: Drawing[] }
  | { kind: "line"; drawingId: string; start: Point; original: Point[]; before: Drawing[] }
  | { kind: "label"; drawingId: string; start: Point; originalOffset: Point; before: Drawing[] }
  | { kind: "fitting"; drawingId: string; start: Point; originalCenter: Point; originalPorts: Point[]; connectedIds: string[]; before: Drawing[] }
  | { kind: "symbol"; drawingId: string; before: Drawing[] }
  | { kind: "symbol-resize"; drawingId: string; center: Point; rotation: number; halfWidth: number; halfHeight: number; before: Drawing[] }
  | { kind: "group"; start: Point; ids: string[]; originals: Record<string, Point[]>; before: Drawing[] };
type PanState = {
  pointerId: number;
  startX: number;
  startY: number;
  cameraX: number;
  cameraY: number;
  latestX: number;
  latestY: number;
  frameId: number | null;
  moved: boolean;
};

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
  runIds?: string[];
  mode?: "three-runs" | "split-trunk" | "attach-run";
  candidateEndpoint?: Point;
  candidateProjected?: Point;
  candidateEndpointDistance?: number;
};

type ThreeRunBranchMatch = {
  center: Point;
  angle: number;
  branchAngle: number;
  side: 1 | -1;
  style: "wye45" | "tee90";
  ports: Array<{ drawing: Drawing; endpointIndex: number }>;
};

type BranchOpportunity = {
  id: string;
  center: Point;
  angle: number;
  branchAngle: number;
  side: 1 | -1;
  style: "wye45" | "tee90";
  parentSize: string;
  mainRunId: string;
  branchRunId: string;
  score: number;
};

type SavedProject = {
  version: 1 | 2 | 3;
  fileName: string;
  drawings: Drawing[];
  savedAt: string;
  pdfFingerprint?: string;
  scaleFeetPerUnit?: number;
  scaleLabel?: string;
  scaleVerified?: boolean;
  systemNames?: Record<string, string>;
  showCfmLabels?: boolean;
  showLengthLabels?: boolean;
  showFittingLabels?: boolean;
  visibleLayers?: Partial<Record<LayerId, boolean>>;
  backgroundOpacity?: number;
  showGrid?: boolean;
  snapEnabled?: boolean;
  lockedLayers?: Partial<Record<LayerId, boolean>>;
  supplyVelocityLimit?: number;
  returnVelocityLimit?: number;
  freshVelocityLimit?: number;
  residentialFlexMax?: string;
  fieldChecklist?: Record<string, boolean>;
  fieldChecklistBySystem?: Record<string, Record<string, boolean>>;
  materialWastePercent?: number;
  commissioningBySystem?: Record<string, CommissioningRecord>;
  punchItems?: PunchItem[];
  rfiItems?: RfiItem[];
  roomAirflowTargets?: Record<string, Record<string, RoomAirflowTarget>>;
  reviewDecisionsBySystem?: Record<string, Record<string, ReviewDecision>>;
  releaseRecords?: SystemReleaseRecord[];
  workflowSummary?: WorkflowSummary;
  cloudProjectId?: string;
  cloudRevisionId?: string;
  cloudReleaseFingerprint?: string;
};

type CommissioningRecord = {
  model: string;
  serial: string;
  filterSize: string;
  measuredCfm: string;
  supplyStatic: string;
  returnStatic: string;
  ratedMaxStatic: string;
  temperatureSplit: string;
  technician: string;
  date: string;
  notes: string;
  checklist: Record<string, boolean>;
};

type PunchItem = {
  id: string;
  systemId: string;
  drawingId?: string;
  title: string;
  category: "Installation" | "Coordination" | "Airflow" | "Equipment" | "Closeout";
  priority: "critical" | "normal" | "low";
  assignedTo: string;
  note: string;
  status: "open" | "resolved";
  createdAt: string;
  resolvedAt?: string;
};

type RfiItem = {
  id: string;
  number: number;
  systemId: string;
  drawingId?: string;
  subject: string;
  category: "Coordination" | "Design" | "Equipment" | "Access" | "Change order";
  priority: "critical" | "normal" | "low";
  question: string;
  proposedSolution: string;
  assignedTo: string;
  costImpact: string;
  scheduleImpact: string;
  response: string;
  status: "draft" | "submitted" | "answered" | "approved" | "closed";
  createdAt: string;
  updatedAt: string;
  approvalBy?: string;
  approvedAt?: string;
};

type ValidationSeverity = "critical" | "warning" | "info";
type ValidationIssue = {
  id: string;
  severity: ValidationSeverity;
  title: string;
  detail: string;
  drawingId?: string;
};
type ReviewDecisionStatus = "accepted" | "rfi" | "punch";
type ReviewDecision = {
  issueId: string;
  status: ReviewDecisionStatus;
  reviewer: string;
  note: string;
  updatedAt: string;
  linkedRecordId?: string;
};
type SystemReleaseRecord = {
  id: string;
  systemId: string;
  revision: string;
  releasedBy: string;
  releasedAt: string;
  note: string;
  drawingSignature: string;
  releaseSignature?: string;
  checklistComplete: number;
  acceptedIssueCount: number;
  runCount: number;
  designCfm: number;
  pdfFingerprint?: string;
  gateSnapshot?: Array<{ id: string; label: string; clear: boolean; detail: string }>;
  checklistSnapshot?: Array<{ id: string; label: string; checked: boolean }>;
  issueSnapshot?: Array<{ id: string; severity: ValidationSeverity; title: string; detail: string; disposition: string; reviewer: string; note: string }>;
  rulesSnapshot?: {
    scaleLabel: string;
    scaleFeetPerUnit: number;
    supplyVelocityLimit: number;
    returnVelocityLimit: number;
    freshVelocityLimit: number;
    residentialFlexMax: string;
  };
};

const STORAGE_PREFIX = "hvac-plan-studio:";
const systems = Array.from({ length: 16 }, (_, index) => ({ id: `system-${index + 1}`, label: `System ${index + 1}` }));
const defaultSystemNames = Object.fromEntries(systems.map((system) => [system.id, system.label]));
const fieldChecklistItems = [
  { id: "approved-plan", label: "Approved plan and latest revisions verified" },
  { id: "equipment-access", label: "Equipment location and service clearance verified" },
  { id: "elevations", label: "Duct elevations and ceiling conflicts coordinated" },
  { id: "supports", label: "Hangers, supports, and flex routing reviewed" },
  { id: "dampers", label: "Manual dampers and access locations confirmed" },
  { id: "outside-air", label: "Fresh-air controls and motorized damper confirmed" },
  { id: "photos", label: "Photo verification required before ceiling close-up" },
  { id: "startup", label: "Startup, airflow, and final balance assigned" },
] as const;
const commissioningChecklistItems = [
  { id: "electrical", label: "Electrical, disconnect, breaker, and controls verified" },
  { id: "condensate", label: "Condensate, trap, slope, float protection, and drain verified" },
  { id: "filter", label: "Correct filter installed and access confirmed" },
  { id: "blower", label: "Blower setting and measured airflow recorded" },
  { id: "thermostat", label: "Thermostat operation and system staging confirmed" },
  { id: "dampers", label: "Manual dampers adjusted and final positions marked" },
  { id: "photos", label: "Equipment, duct, controls, and above-ceiling photos captured" },
  { id: "balance", label: "Final diffuser and return balance completed" },
] as const;
const emptyCommissioningRecord: CommissioningRecord = {
  model: "",
  serial: "",
  filterSize: "",
  measuredCfm: "",
  supplyStatic: "",
  returnStatic: "",
  ratedMaxStatic: ".5",
  temperatureSplit: "",
  technician: "",
  date: "",
  notes: "",
  checklist: {},
};

const drawingColors: Record<DrawType, string> = {
  supply: "#2b83ff",
  branch: "#f5c543",
  return: "#ef5350",
  fresh: "#45d18b",
};

type WorkspaceErrorBoundaryState = {
  failed: boolean;
};

class WorkspaceErrorBoundary extends Component<{ children: ReactNode }, WorkspaceErrorBoundaryState> {
  state: WorkspaceErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): WorkspaceErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("HVAC Plan Studio recovered from a workspace error", error, info);
  }

  render() {
    if (this.state.failed) {
      return <main className="workspace-recovery-screen">
        <div className="workspace-recovery-card">
          <ShieldAlert size={34} />
          <span>WORKSPACE SAFETY RECOVERY</span>
          <h1>Your plan is still saved</h1>
          <p>A drawing action was stopped before it could leave the screen dark. Reload the last autosaved plan and continue working.</p>
          <button onClick={() => window.location.reload()}>Reload saved plan</button>
        </div>
      </main>;
    }
    return this.props.children;
  }
}

function HVACPlanStudioApp() {
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasViewportRef = useRef<HTMLDivElement>(null);
  const planSheetRef = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pdfFingerprint, setPdfFingerprint] = useState("");
  const [sourceDriveFileId, setSourceDriveFileId] = useState<string | null>(null);
  const [sourceFileName, setSourceFileName] = useState<string | null>(null);
  const [fileName, setFileName] = useState("Untitled HVAC Plan");
  const [workingCloudProjectId, setWorkingCloudProjectId] = useState<string | null>(null);
  const [workingCloudRevisionId, setWorkingCloudRevisionId] = useState<string | null>(null);
  const [workingCloudRevisionFingerprint, setWorkingCloudRevisionFingerprint] = useState<string | null>(null);
  const [cloudProjectRisk, setCloudProjectRisk] = useState<CloudProjectRisk | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [camera, setCamera] = useState({ x: 0, y: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTool, setActiveTool] = useState("select");
  const [symbolCategory, setSymbolCategory] = useState<(typeof symbolCategories)[number]>("Supply air");
  const [activePresetId, setActivePresetId] = useState("supply-4way");
  const [symbolSearch, setSymbolSearch] = useState("");
  const [placementRotation, setPlacementRotation] = useState(0);
  const [ductSize, setDuctSize] = useState("14");
  const [runLineWeight, setRunLineWeight] = useState(0.2);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [undoStack, setUndoStack] = useState<Drawing[][]>([]);
  const [redoStack, setRedoStack] = useState<Drawing[][]>([]);
  const [draft, setDraft] = useState<Point[]>([]);
  const [continuingRunId, setContinuingRunId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectionBox, setSelectionBox] = useState<{ start: Point; end: Point; additive: boolean } | null>(null);
  const [renderSize, setRenderSize] = useState({ width: 0, height: 0 });
  const [renderedPageNumber, setRenderedPageNumber] = useState(0);
  const [hoverPoint, setHoverPoint] = useState<Point | null>(null);
  const [snapMarker, setSnapMarker] = useState<Point | null>(null);
  const [snapInfo, setSnapInfo] = useState<SnapInfo | null>(null);
  const [alignmentGuides, setAlignmentGuides] = useState<AlignmentGuide[]>([]);
  const [branchPreview, setBranchPreview] = useState<BranchPreview | null>(null);
  const [pendingBranchFittingId, setPendingBranchFittingId] = useState<string | null>(null);
  const [symbolPreview, setSymbolPreview] = useState<{ kind: SymbolKind; point: Point } | null>(null);
  const [branchMessage, setBranchMessage] = useState("");
  const [branchPlacementResult, setBranchPlacementResult] = useState<{ fittingId: string; message: string } | null>(null);
  const [branchOpportunityCursor, setBranchOpportunityCursor] = useState(0);
  const [branchWorkflow, setBranchWorkflow] = useState<"run-first" | "place-first">("run-first");
  const [queuedBranchRunId, setQueuedBranchRunId] = useState<string | null>(null);
  const [branchHoverRunId, setBranchHoverRunId] = useState<string | null>(null);
  const [branchStyle, setBranchStyle] = useState<"auto" | "wye45" | "tee90">("auto");
  const [branchMatchChoices, setBranchMatchChoices] = useState<Record<string, string>>({});
  const [scaleFeetPerUnit, setScaleFeetPerUnit] = useState(1 / 24.3);
  const [scaleLabel, setScaleLabel] = useState('1/4" = 1\'-0"');
  const [scaleLocked, setScaleLocked] = useState(true);
  const [scaleVerified, setScaleVerified] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  const [referenceFeet, setReferenceFeet] = useState("10");
  const [measureDraft, setMeasureDraft] = useState<Point[]>([]);
  const [rightTab, setRightTab] = useState<"builder" | "layers" | "rooms" | "network" | "takeoff" | "field" | "checks">("builder");
  const [balanceView, setBalanceView] = useState<"system" | "rooms" | "runs">("system");
  const [saveState, setSaveState] = useState<"saved" | "saving">("saved");
  const [showCloudProjects, setShowCloudProjects] = useState(false);
  const [cloudInitialProjectId, setCloudInitialProjectId] = useState<string | null>(null);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showProjectHome, setShowProjectHome] = useState(true);
  const [showProjectSetup, setShowProjectSetup] = useState(false);
  const [driveConfigured, setDriveConfigured] = useState<boolean | null>(null);
  const [showSizingReview, setShowSizingReview] = useState(false);
  const [selectedSizingIds, setSelectedSizingIds] = useState<string[]>([]);
  const [supplyVelocityLimit, setSupplyVelocityLimit] = useState(900);
  const [returnVelocityLimit, setReturnVelocityLimit] = useState(700);
  const [freshVelocityLimit, setFreshVelocityLimit] = useState(600);
  const [residentialFlexMax, setResidentialFlexMax] = useState("16");
  const [showProgressionReview, setShowProgressionReview] = useState(true);
  const [showReducerReview, setShowReducerReview] = useState(true);
  const [validationFilter, setValidationFilter] = useState<"all" | "critical" | "warning" | "info">("all");
  const [validationCursor, setValidationCursor] = useState(0);
  const [reviewView, setReviewView] = useState<"overview" | "issues" | "engineering">("overview");
  const [reviewQueueFilter, setReviewQueueFilter] = useState<"open" | "accepted" | "all">("open");
  const [showReviewMarkers, setShowReviewMarkers] = useState(true);
  const [activeReviewIssueId, setActiveReviewIssueId] = useState<string | null>(null);
  const [reviewerName, setReviewerName] = useState("");
  const [reviewDecisionNote, setReviewDecisionNote] = useState("");
  const pendingProjectSetupRef = useRef<ProjectSetupValues | null>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const handleFilePickerCancel = () => {
      pendingProjectSetupRef.current = null;
      setShowProjectHome(true);
    };
    input.addEventListener("cancel", handleFilePickerCancel);
    return () => input.removeEventListener("cancel", handleFilePickerCancel);
  }, []);

  useEffect(() => {
    setCloudProjectRisk((current) =>
      current?.projectId === workingCloudProjectId ? current : null);
  }, [workingCloudProjectId]);

  const refreshWorkingCloudRisk = useCallback(async () => {
    if (!workingCloudProjectId) {
      setCloudProjectRisk(null);
      return null;
    }
    try {
      const [cloudRevisions, cloudWorkItems, cloudApprovals] = await Promise.all([
        listCloudRevisions(workingCloudProjectId),
        listCloudWorkItems(workingCloudProjectId),
        listCloudApprovals(workingCloudProjectId),
      ]);
      const latestRevisionId = cloudRevisions[0]?.id || null;
      const risk: CloudProjectRisk = {
        projectId: workingCloudProjectId,
        verification: "verified",
        latestRevisionId,
        latestRevisionNumber: cloudRevisions[0]?.revision_number || 0,
        latestReleaseFingerprint: cloudRevisions[0]?.release_fingerprint || null,
        openCriticalWork: cloudWorkItems.filter((item) =>
          item.priority === "critical" && !["resolved", "closed"].includes(item.status)).length,
        pendingApprovals: cloudApprovals.filter((approval) =>
          approval.revision_id === latestRevisionId && approval.status === "requested").length,
        changesRequested: cloudApprovals.filter((approval) =>
          approval.revision_id === latestRevisionId && approval.status === "changes_requested").length,
        approvedApprovals: cloudApprovals.filter((approval) =>
          approval.revision_id === latestRevisionId && approval.status === "approved").length,
      };
      setCloudProjectRisk(risk);
      return risk;
    } catch {
      const risk: CloudProjectRisk = {
        projectId: workingCloudProjectId,
        verification: "unverified",
        latestRevisionId: null,
        latestRevisionNumber: 0,
        latestReleaseFingerprint: null,
        openCriticalWork: 0,
        pendingApprovals: 0,
        changesRequested: 0,
        approvedApprovals: 0,
      };
      setCloudProjectRisk(risk);
      return risk;
    }
  }, [workingCloudProjectId]);

  const [reviewDecisionsBySystem, setReviewDecisionsBySystem] = useState<Record<string, Record<string, ReviewDecision>>>({});
  const [fieldView, setFieldView] = useState<"release" | "installer" | "coordination" | "startup">("release");
  const [fieldChecklistBySystem, setFieldChecklistBySystem] = useState<Record<string, Record<string, boolean>>>({});
  const [releaseRecords, setReleaseRecords] = useState<SystemReleaseRecord[]>([]);
  const [releaseRevision, setReleaseRevision] = useState("");
  const [releaseBy, setReleaseBy] = useState("");
  const [releaseNote, setReleaseNote] = useState("");
  const [materialWastePercent, setMaterialWastePercent] = useState(10);
  const [commissioningBySystem, setCommissioningBySystem] = useState<Record<string, CommissioningRecord>>({});
  const [punchItems, setPunchItems] = useState<PunchItem[]>([]);
  const [punchTitle, setPunchTitle] = useState("");
  const [punchCategory, setPunchCategory] = useState<PunchItem["category"]>("Installation");
  const [punchPriority, setPunchPriority] = useState<PunchItem["priority"]>("normal");
  const [punchAssignedTo, setPunchAssignedTo] = useState("");
  const [punchNote, setPunchNote] = useState("");
  const [rfiItems, setRfiItems] = useState<RfiItem[]>([]);
  const [rfiSubject, setRfiSubject] = useState("");
  const [rfiCategory, setRfiCategory] = useState<RfiItem["category"]>("Coordination");
  const [rfiPriority, setRfiPriority] = useState<RfiItem["priority"]>("normal");
  const [rfiQuestion, setRfiQuestion] = useState("");
  const [rfiSolution, setRfiSolution] = useState("");
  const [rfiAssignedTo, setRfiAssignedTo] = useState("");
  const [rfiCostImpact, setRfiCostImpact] = useState("None identified");
  const [rfiScheduleImpact, setRfiScheduleImpact] = useState("None identified");
  const [projectSystemFilter, setProjectSystemFilter] = useState<"all" | "blocked" | "ready">("all");
  const [showSheetNavigator, setShowSheetNavigator] = useState(false);
  const [fieldMode, setFieldMode] = useState(false);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [showCfmLabels, setShowCfmLabels] = useState(false);
  const [showLengthLabels, setShowLengthLabels] = useState(false);
  const [showFittingLabels, setShowFittingLabels] = useState(false);
  const [visibleLayers, setVisibleLayers] = useState<Record<LayerId, boolean>>(defaultVisibleLayers);
  const [backgroundOpacity, setBackgroundOpacity] = useState(100);
  const [showGrid, setShowGrid] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [splitMode, setSplitMode] = useState(false);
  const [lockedLayers, setLockedLayers] = useState<Record<LayerId, boolean>>(defaultLockedLayers);
  const [activeSystem, setActiveSystem] = useState("system-1");
  const [systemNames, setSystemNames] = useState<Record<string, string>>(defaultSystemNames);
  const [roomAirflowTargets, setRoomAirflowTargets] = useState<Record<string, Record<string, RoomAirflowTarget>>>({});
  const [selectedCfmProposalIds, setSelectedCfmProposalIds] = useState<string[]>([]);

  const currentCloudReleaseFingerprint = useMemo(() => cloudReleaseFingerprintFromProject({
    drawings,
    pdfFingerprint,
    scaleFeetPerUnit,
    scaleLabel,
    scaleVerified,
    systemNames,
    supplyVelocityLimit,
    returnVelocityLimit,
    freshVelocityLimit,
    residentialFlexMax,
    fieldChecklistBySystem,
    punchItems,
    rfiItems,
    roomAirflowTargets,
    reviewDecisionsBySystem,
  }), [drawings, fieldChecklistBySystem, freshVelocityLimit, pdfFingerprint, punchItems, residentialFlexMax, returnVelocityLimit, reviewDecisionsBySystem, rfiItems, roomAirflowTargets, scaleFeetPerUnit, scaleLabel, scaleVerified, supplyVelocityLimit, systemNames]);

  useEffect(() => {
    if (!workingCloudProjectId || rightTab !== "field" || fieldView !== "release") return;
    void refreshWorkingCloudRisk();
    const timer = window.setInterval(() => void refreshWorkingCloudRisk(), 60_000);
    return () => window.clearInterval(timer);
  }, [fieldView, refreshWorkingCloudRisk, rightTab, workingCloudProjectId]);

  const dragRef = useRef<DragState | null>(null);
  const panRef = useRef<PanState | null>(null);
  const pendingFocusRef = useRef<{ page: number; point: Point } | null>(null);
  const zoomRef = useRef(zoom);
  const cameraRef = useRef(camera);
  const clipboardRef = useRef<Drawing | null>(null);
  const placementWheelAtRef = useRef(0);
  const airflowNetworkModel = useMemo(() => calculateAirflowNetwork(), [drawings]);
  const activeValidationIssues = useMemo(
    () => validationIssues(),
    [activeSystem, drawings, freshVelocityLimit, residentialFlexMax, returnVelocityLimit, scaleFeetPerUnit, supplyVelocityLimit, systemNames],
  );
  const activeReviewedIssueRows = useMemo(
    () => reviewedIssueRows(activeValidationIssues),
    [activeSystem, activeValidationIssues, punchItems, reviewDecisionsBySystem, rfiItems],
  );
  const activeReviewSummary = useMemo(
    () => reviewSummary(activeReviewedIssueRows),
    [activeReviewedIssueRows],
  );
  const activeValidationDashboard = useMemo(
    () => validationDashboard(activeValidationIssues),
    [activeSystem, activeValidationIssues, drawings, roomAirflowTargets],
  );
  const activeFieldConnections = useMemo(
    () => buildFieldConnectionModel(activeSystem),
    [activeSystem, drawings],
  );
  const activeFieldPackage = useMemo(
    () => fieldPackageSummary(activeReviewSummary, activeFieldConnections),
    [activeFieldConnections, activeReviewSummary, activeSystem, cloudProjectRisk, currentCloudReleaseFingerprint, drawings, fieldChecklistBySystem, freshVelocityLimit, pdfFingerprint, punchItems, releaseRecords, residentialFlexMax, returnVelocityLimit, rfiItems, roomAirflowTargets, scaleFeetPerUnit, scaleLabel, scaleVerified, supplyVelocityLimit, workingCloudProjectId, workingCloudRevisionFingerprint, workingCloudRevisionId],
  );
  const activeBuilderSummary = useMemo(
    () => systemBuilderSummary(activeValidationDashboard, activeFieldPackage),
    [activeFieldPackage, activeSystem, activeValidationDashboard, drawings, residentialFlexMax, returnVelocityLimit, supplyVelocityLimit],
  );
  const projectCommandSnapshot = useMemo(
    () => projectCommandSummary(),
    [activeFieldPackage, activeSystem, commissioningBySystem, drawings, fieldChecklistBySystem, punchItems, releaseRecords, reviewDecisionsBySystem, rfiItems, scaleVerified],
  );
  const filteredProjectRowsSnapshot = useMemo(
    () => {
      const rows = projectCommandSnapshot?.rows || [];
      if (projectSystemFilter === "ready") return rows.filter((row) => row.closeoutReady);
      if (projectSystemFilter === "blocked") return rows.filter((row) => !row.closeoutReady);
      return rows;
    },
    [projectCommandSnapshot, projectSystemFilter],
  );

  useEffect(() => {
    setSelectedIds((current) => {
      if (!selectedId) return [];
      return current.includes(selectedId) ? current : [selectedId];
    });
  }, [selectedId]);

  useEffect(() => {
    let cancelled = false;
    void checkDriveConfiguration().then((configured) => {
      if (!cancelled) setDriveConfigured(configured);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (selectedId && !drawings.some((drawing) => drawing.id === selectedId)) {
      setSelectedId(null);
      setSelectedIds([]);
    }
  }, [drawings, selectedId]);

  useEffect(() => {
    if (activeTool === "branch") return;
    setPendingBranchFittingId(null);
    setBranchPreview(null);
    setBranchPlacementResult(null);
    setQueuedBranchRunId(null);
    setBranchHoverRunId(null);
  }, [activeTool]);

  useEffect(() => {
    if (!branchPlacementResult) return;
    const timer = window.setTimeout(() => {
      setBranchPlacementResult(null);
      if (activeTool === "branch") {
        setBranchMessage(branchWorkflow === "run-first"
          ? "Run-first branch pass continues · click the next completed diffuser run"
          : "Branch pass continues · choose another trunk or jump to the next suggested junction");
      }
    }, 4500);
    return () => window.clearTimeout(timer);
  }, [activeTool, branchPlacementResult, branchWorkflow]);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    cameraRef.current = camera;
  }, [camera]);

  useEffect(() => {
    setReleaseRevision("");
    setReleaseBy("");
    setReleaseNote("");
    setActiveReviewIssueId(null);
    setReviewerName("");
    setReviewDecisionNote("");
  }, [activeSystem]);

  useEffect(() => () => {
    const pan = panRef.current;
    if (pan && pan.frameId !== null) cancelAnimationFrame(pan.frameId);
  }, []);

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

  function resetProjectWorkflowState() {
    setScaleFeetPerUnit(1 / 24.3);
    setScaleLabel('1/4" = 1\'-0"');
    setScaleLocked(true);
    setScaleVerified(false);
    setSystemNames(defaultSystemNames);
    setActiveSystem("system-1");
    setShowCfmLabels(false);
    setShowLengthLabels(false);
    setShowFittingLabels(false);
    setVisibleLayers(defaultVisibleLayers);
    setBackgroundOpacity(100);
    setShowGrid(true);
    setSnapEnabled(true);
    setLockedLayers(defaultLockedLayers);
    setSupplyVelocityLimit(900);
    setReturnVelocityLimit(700);
    setFreshVelocityLimit(600);
    setResidentialFlexMax("16");
    setMaterialWastePercent(10);
    setFieldChecklistBySystem({});
    setCommissioningBySystem({});
    setPunchItems([]);
    setRfiItems([]);
    setRoomAirflowTargets({});
    setReviewDecisionsBySystem({});
    setReleaseRecords([]);
    setSelectedCfmProposalIds([]);
    setActiveReviewIssueId(null);
    setReviewerName("");
    setReviewDecisionNote("");
    setReleaseRevision("");
    setReleaseBy("");
    setReleaseNote("");
  }

  function applyProjectSnapshot(project: SavedProject, sourceFingerprint?: string) {
    const restoredDrawings = Array.isArray(project.drawings) ? project.drawings : [];
    setDrawings(synchronizeFittingSizes(restoredDrawings, restoredDrawings));
    setScaleFeetPerUnit(project.scaleFeetPerUnit || 1 / 24.3);
    setScaleLabel(project.scaleLabel || '1/4" = 1\'-0"');
    setScaleLocked(true);
    setScaleVerified(project.scaleVerified ?? false);
    setCalibrating(false);
    if (sourceFingerprint && project.pdfFingerprint && project.pdfFingerprint !== sourceFingerprint) {
      setBranchMessage("A revised PDF was detected. Existing markups were restored, but every prior field release is now stale");
    }
    setSystemNames({ ...defaultSystemNames, ...(project.systemNames || {}) });
    setShowCfmLabels(project.showCfmLabels ?? false);
    setShowLengthLabels(project.showLengthLabels ?? false);
    setShowFittingLabels(project.showFittingLabels ?? false);
    setVisibleLayers({ ...defaultVisibleLayers, ...(project.visibleLayers || {}) });
    setBackgroundOpacity(project.backgroundOpacity ?? 100);
    setShowGrid(project.showGrid ?? true);
    setSnapEnabled(project.snapEnabled ?? true);
    setLockedLayers({ ...defaultLockedLayers, ...(project.lockedLayers || {}) });
    setSupplyVelocityLimit(project.supplyVelocityLimit ?? 900);
    setReturnVelocityLimit(project.returnVelocityLimit ?? 700);
    setFreshVelocityLimit(project.freshVelocityLimit ?? 600);
    setResidentialFlexMax(project.residentialFlexMax || "16");
    setFieldChecklistBySystem(project.fieldChecklistBySystem || (project.fieldChecklist ? { "system-1": project.fieldChecklist } : {}));
    setMaterialWastePercent(project.materialWastePercent ?? 10);
    setCommissioningBySystem(project.commissioningBySystem || {});
    setPunchItems(project.punchItems || []);
    setRfiItems(project.rfiItems || []);
    setRoomAirflowTargets(project.roomAirflowTargets || {});
    setReviewDecisionsBySystem(project.reviewDecisionsBySystem || {});
    setReleaseRecords(project.releaseRecords || []);
    setWorkingCloudProjectId(project.cloudProjectId || null);
    setWorkingCloudRevisionId(project.cloudRevisionId || null);
    setWorkingCloudRevisionFingerprint(
      project.cloudReleaseFingerprint ||
      (project.cloudProjectId ? cloudReleaseFingerprintFromProject(project) : null),
    );
    setSelectedCfmProposalIds([]);
    setActiveReviewIssueId(null);
    setUndoStack([]);
    setRedoStack([]);
  }

  function restoreProject(name: string, sourceFingerprint: string) {
    try {
      const stored = localStorage.getItem(`${STORAGE_PREFIX}${name.toLowerCase()}`);
      if (!stored) {
        setDrawings([]);
        setWorkingCloudProjectId(null);
        setWorkingCloudRevisionId(null);
        setWorkingCloudRevisionFingerprint(null);
        resetProjectWorkflowState();
        setUndoStack([]);
        setRedoStack([]);
        return;
      }
      applyProjectSnapshot(JSON.parse(stored) as SavedProject, sourceFingerprint);
    } catch {
      setDrawings([]);
      setWorkingCloudProjectId(null);
      setWorkingCloudRevisionId(null);
      setWorkingCloudRevisionFingerprint(null);
      resetProjectWorkflowState();
      setUndoStack([]);
      setRedoStack([]);
    }
  }

  function applyPendingProjectSetup() {
    const setup = pendingProjectSetupRef.current;
    if (!setup) return;
    const unitsPerFoot: Record<ProjectSetupValues["scale"], number> = {
      '1/8" = 1\'-0"': 12.15,
      '3/16" = 1\'-0"': 18.225,
      '1/4" = 1\'-0"': 24.3,
      '1/2" = 1\'-0"': 48.6,
    };
    setDuctSize(setup.defaultDuctSize);
    setScaleFeetPerUnit(1 / unitsPerFoot[setup.scale]);
    setScaleLabel(setup.scale);
    setScaleLocked(true);
    setScaleVerified(false);
    setCalibrating(false);
    setMeasureDraft([]);
    setBranchMessage(
      `Project setup ready · ${setup.tonnage} ton / ${Number(setup.tonnage) * 400} CFM reference · verify the drawing scale before measurement`,
    );
    setShowProjectHome(false);
    if (setup.collaboration === "cloud") setShowCloudProjects(true);
    pendingProjectSetupRef.current = null;
  }

  function startGuidedProject(setup: ProjectSetupValues) {
    pendingProjectSetupRef.current = setup;
    setShowProjectSetup(false);
    if (setup.source === "drive") {
      void openFromDrive();
    } else {
      inputRef.current?.click();
    }
  }

  async function openPdf(file?: File) {
    if (!file) {
      pendingProjectSetupRef.current = null;
      return;
    }
    if (file.type !== "application/pdf") {
      setError("Please choose a PDF construction plan.");
      pendingProjectSetupRef.current = null;
      return;
    }
    setLoading(true);
    setError("");
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const sourceFingerprint = stableByteHash(bytes);
      const document = await pdfjsLib.getDocument({ data: bytes }).promise;
      const projectName = pendingProjectSetupRef.current?.projectName.trim() || file.name.replace(/\.pdf$/i, "");
      setPdf(document);
      setPdfFingerprint(sourceFingerprint);
      setSourceDriveFileId(null);
      setSourceFileName(file.name);
      setWorkingCloudProjectId(null);
      setWorkingCloudRevisionId(null);
      setWorkingCloudRevisionFingerprint(null);
      setFileName(projectName);
      setPageNumber(1);
      setZoom(1);
      restoreProject(projectName, sourceFingerprint);
      applyPendingProjectSetup();
      setShowProjectHome(false);
    } catch {
      setError("This PDF could not be opened. Try another file.");
      pendingProjectSetupRef.current = null;
    } finally {
      setLoading(false);
    }
  }

  async function openPdfBytes(name: string, bytes: Uint8Array, driveFileId?: string | null) {
    setLoading(true);
    setError("");
    try {
      const sourceFingerprint = stableByteHash(bytes);
      const document = await pdfjsLib.getDocument({ data: bytes }).promise;
      const projectName = pendingProjectSetupRef.current?.projectName.trim() || name.replace(/\.pdf$/i, "");
      setPdf(document);
      setPdfFingerprint(sourceFingerprint);
      setSourceDriveFileId(driveFileId || null);
      setSourceFileName(name);
      setWorkingCloudProjectId(null);
      setWorkingCloudRevisionId(null);
      setWorkingCloudRevisionFingerprint(null);
      setFileName(projectName);
      setPageNumber(1);
      setZoom(1);
      restoreProject(projectName, sourceFingerprint);
      applyPendingProjectSetup();
      setShowProjectHome(false);
    } catch {
      setError("This Drive PDF could not be opened.");
      pendingProjectSetupRef.current = null;
    } finally {
      setLoading(false);
    }
  }

  async function openFromDrive() {
    try {
      const selected = await pickPdfFromDrive();
      await openPdfBytes(selected.name, selected.bytes, selected.id);
    } catch (driveError) {
      setError(driveError instanceof Error ? driveError.message : "Google Drive could not be opened.");
      pendingProjectSetupRef.current = null;
    }
  }

  async function restoreCloudRevision(
    snapshot: Record<string, unknown>,
    project: CloudProject,
    revision: CloudRevision,
  ) {
    const savedProject = snapshot as unknown as SavedProject;
    setLoading(true);
    setError("");
    try {
      let sourceFingerprint = savedProject.pdfFingerprint || "";
      if (project.source_drive_file_id) {
        const source = await loadPdfFromDriveId(
          project.source_drive_file_id,
          project.source_file_name || `${project.name}.pdf`,
        );
        sourceFingerprint = stableByteHash(source.bytes);
        const document = await pdfjsLib.getDocument({ data: source.bytes }).promise;
        setPdf(document);
        setPdfFingerprint(sourceFingerprint);
        setSourceDriveFileId(project.source_drive_file_id);
        setSourceFileName(project.source_file_name || `${project.name}.pdf`);
        setPageNumber(1);
        setZoom(1);
      } else if (!pdf) {
        setBranchMessage("Cloud revision restored. Open the matching source PDF to place the saved HVAC drawing over its plan");
      }
      setFileName(savedProject.fileName || project.name);
      applyProjectSnapshot(savedProject, sourceFingerprint);
      setWorkingCloudProjectId(project.id);
      setWorkingCloudRevisionId(revision.id);
      setWorkingCloudRevisionFingerprint(
        revision.release_fingerprint ||
        savedProject.cloudReleaseFingerprint ||
        cloudReleaseFingerprintFromProject(savedProject),
      );
      setBranchMessage(`Cloud revision R${revision.revision_number} restored · local autosave is active`);
      setShowCloudProjects(false);
      setShowProjectHome(false);
    } catch (cloudError) {
      setError(cloudError instanceof Error ? cloudError.message : "The cloud revision could not be restored.");
    } finally {
      setLoading(false);
    }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      pendingProjectSetupRef.current = null;
      return;
    }
    void openPdf(file);
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
      if (!cancelled) {
        setRenderSize({ width: viewport.width, height: viewport.height });
        setRenderedPageNumber(pageNumber);
      }
    };
    void render();
    return () => { cancelled = true; };
  }, [pdf, pageNumber]);

  useEffect(() => {
    if (!pdf || !renderSize.width || !renderSize.height) return;
    const frame = requestAnimationFrame(() => centerPlan());
    return () => cancelAnimationFrame(frame);
  }, [pdf, pageNumber, renderSize.width, renderSize.height]);

  useEffect(() => {
    const pending = pendingFocusRef.current;
    if (!pending || pending.page !== pageNumber || renderedPageNumber !== pageNumber) return;
    const frame = requestAnimationFrame(() => {
      const viewport = canvasViewportRef.current;
      if (!viewport) return;
      updateCamera({
        x: viewport.clientWidth / 2 - pending.point.x * zoomRef.current,
        y: viewport.clientHeight / 2 - pending.point.y * zoomRef.current,
      });
      pendingFocusRef.current = null;
    });
    return () => cancelAnimationFrame(frame);
  }, [pageNumber, renderedPageNumber, renderSize.width, renderSize.height]);

  function updateCamera(next: { x: number; y: number }) {
    cameraRef.current = next;
    setCamera(next);
  }

  function zoomFromWorkspaceCenter(factor: number) {
    const viewport = canvasViewportRef.current;
    if (!viewport) return;
    const bounds = viewport.getBoundingClientRect();
    zoomAtPoint(
      Math.max(.25, Math.min(8, +(zoomRef.current * factor).toFixed(3))),
      bounds.left + bounds.width / 2,
      bounds.top + bounds.height / 2,
    );
  }

  const zoomOut = () => zoomFromWorkspaceCenter(1 / 1.18);
  const zoomIn = () => zoomFromWorkspaceCenter(1.18);

  function centerPlan(nextZoom = zoomRef.current) {
    const viewport = canvasViewportRef.current;
    if (!viewport || !renderSize.width || !renderSize.height) return;
    updateCamera({
      x: (viewport.clientWidth - renderSize.width * nextZoom) / 2,
      y: (viewport.clientHeight - renderSize.height * nextZoom) / 2,
    });
  }

  function applyViewportZoom(nextZoom: number) {
    const normalizedZoom = Math.max(.25, Math.min(8, +nextZoom.toFixed(3)));
    zoomRef.current = normalizedZoom;
    setZoom(normalizedZoom);
    centerPlan(normalizedZoom);
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
    if (!viewport || nextZoom === zoomRef.current) return;
    const viewportBounds = viewport.getBoundingClientRect();
    const localX = clientX - viewportBounds.left;
    const localY = clientY - viewportBounds.top;
    const currentZoom = zoomRef.current;
    const planX = (localX - cameraRef.current.x) / currentZoom;
    const planY = (localY - cameraRef.current.y) / currentZoom;
    updateCamera({
      x: localX - planX * nextZoom,
      y: localY - planY * nextZoom,
    });
    zoomRef.current = nextZoom;
    setZoom(nextZoom);
  }

  function handleWheelZoom(event: ReactWheelEvent<HTMLDivElement>) {
    if (!pdf) return;
    event.preventDefault();
    if (symbolPreview && symbolTools.includes(activeTool as SymbolKind)) {
      if (!event.deltaY) return;
      const now = performance.now();
      if (now - placementWheelAtRef.current < 55) return;
      placementWheelAtRef.current = now;
      const step = event.shiftKey ? 45 : 15;
      const direction = event.deltaY > 0 ? 1 : -1;
      setPlacementRotation((current) => (current + direction * step + 360) % 360);
      return;
    }
    const delta = event.deltaMode === 1 ? event.deltaY * 18 : event.deltaY;
    const sensitivity = event.ctrlKey ? .004 : .0018;
    const nextZoom = Math.max(.25, Math.min(8, +(zoomRef.current * Math.exp(-delta * sensitivity)).toFixed(3)));
    zoomAtPoint(nextZoom, event.clientX, event.clientY);
  }

  function startPlanPan(event: PointerEvent<HTMLDivElement>) {
    if (!pdf || event.button !== 2 || draft.length) return;
    const viewport = canvasViewportRef.current;
    if (!viewport) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    panRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      cameraX: cameraRef.current.x,
      cameraY: cameraRef.current.y,
      latestX: event.clientX,
      latestY: event.clientY,
      frameId: null,
      moved: false,
    };
    viewport.classList.add("panning");
  }

  function movePlanPan(event: PointerEvent<HTMLDivElement>) {
    const pan = panRef.current;
    const viewport = canvasViewportRef.current;
    if (!pan || !viewport || pan.pointerId !== event.pointerId) return;
    event.preventDefault();
    pan.latestX = event.clientX;
    pan.latestY = event.clientY;
    pan.moved ||= Math.hypot(pan.latestX - pan.startX, pan.latestY - pan.startY) > 2;
    if (pan.frameId !== null) return;
    pan.frameId = requestAnimationFrame(() => {
      const activePan = panRef.current;
      if (!activePan || activePan.pointerId !== pan.pointerId) return;
      activePan.frameId = null;
      updateCamera({
        x: activePan.cameraX + activePan.latestX - activePan.startX,
        y: activePan.cameraY + activePan.latestY - activePan.startY,
      });
    });
  }

  function endPlanPan(event: PointerEvent<HTMLDivElement>) {
    const pan = panRef.current;
    const viewport = canvasViewportRef.current;
    if (!pan || !viewport || pan.pointerId !== event.pointerId) return;
    event.preventDefault();
    if (pan.frameId !== null) {
      cancelAnimationFrame(pan.frameId);
      pan.frameId = null;
    }
    updateCamera({
      x: pan.cameraX + event.clientX - pan.startX,
      y: pan.cameraY + event.clientY - pan.startY,
    });
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    viewport.classList.remove("panning");
    panRef.current = null;
  }

  function goToPage(page: number) {
    if (!pdf) return;
    setPageNumber(Math.max(1, Math.min(pdf.numPages, page)));
    requestAnimationFrame(() => centerPlan());
  }

  const buildProjectSnapshot = useCallback((): SavedProject => {
    const workflow = buildSystemWorkflow({
      runs: activeBuilderSummary.runs.length,
      fittings: activeBuilderSummary.fittings.length,
      devices: activeBuilderSummary.devices.length,
      openConnections: activeBuilderSummary.unconnectedDevices,
      brokenPorts: activeBuilderSummary.brokenPorts,
      hasPrimaryUnit: activeBuilderSummary.devices.some((drawing) => isPrimaryAirflowEquipment(drawing)),
      airflowBalanced: systemStats(activeSystem).balanced,
      sizingReviews: activeBuilderSummary.sizing.length,
      criticalIssues: activeBuilderSummary.audit.counts.critical,
      warningIssues: activeBuilderSummary.audit.counts.warning,
      releaseReady: activeFieldPackage.gatesClear,
      released: activeFieldPackage.released,
      releaseStale: activeFieldPackage.stale,
    });
    return {
      version: 3,
      fileName,
      drawings,
      savedAt: new Date().toISOString(),
      pdfFingerprint,
      scaleFeetPerUnit,
      scaleLabel,
      scaleVerified,
      systemNames,
      showCfmLabels,
      showLengthLabels,
      showFittingLabels,
      visibleLayers,
      backgroundOpacity,
      showGrid,
      snapEnabled,
      lockedLayers,
      supplyVelocityLimit,
      returnVelocityLimit,
      freshVelocityLimit,
      residentialFlexMax,
      fieldChecklistBySystem,
      materialWastePercent,
      commissioningBySystem,
      punchItems,
      rfiItems,
      roomAirflowTargets,
      reviewDecisionsBySystem,
      releaseRecords,
      cloudProjectId: workingCloudProjectId || undefined,
      cloudRevisionId: workingCloudRevisionId || undefined,
      cloudReleaseFingerprint: currentCloudReleaseFingerprint,
      workflowSummary: {
        version: 1,
        activeSystemId: activeSystem,
        stage: workflow.activeStage,
        progress: projectCommandSnapshot.rows.length ? projectCommandSnapshot.progress : workflow.progress,
        nextAction: workflow.nextAction,
        updatedAt: new Date().toISOString(),
        systems: projectCommandSnapshot.rows.map((row) => ({
          id: row.id,
          name: systemLabel(row.id),
          stage: row.closeoutReady ? "Closeout complete" : row.fieldReady ? "Field ready" : row.designReady ? "Design ready" : "In progress",
          progress: row.progress,
          blockers: row.blockers.length,
          fieldReady: row.fieldReady,
        })),
      },
    };
  }, [activeBuilderSummary, activeFieldPackage, activeSystem, backgroundOpacity, commissioningBySystem, currentCloudReleaseFingerprint, drawings, fieldChecklistBySystem, fileName, freshVelocityLimit, lockedLayers, materialWastePercent, pdfFingerprint, projectCommandSnapshot, punchItems, releaseRecords, residentialFlexMax, returnVelocityLimit, reviewDecisionsBySystem, rfiItems, roomAirflowTargets, scaleFeetPerUnit, scaleLabel, scaleVerified, showCfmLabels, showFittingLabels, showGrid, showLengthLabels, snapEnabled, supplyVelocityLimit, systemNames, visibleLayers, workingCloudProjectId, workingCloudRevisionId]);

  const saveProject = useCallback(() => {
    if (!pdf) return;
    const project = buildProjectSnapshot();
    localStorage.setItem(`${STORAGE_PREFIX}${fileName.toLowerCase()}`, JSON.stringify(project));
    setSaveState("saved");
  }, [buildProjectSnapshot, fileName, pdf]);

  useEffect(() => {
    if (!pdf) return;
    setSaveState("saving");
    const timer = window.setTimeout(saveProject, 650);
    return () => window.clearTimeout(timer);
  }, [drawings, fileName, pdf, saveProject]);

  function setHistory(next: Drawing[]) {
    const availableIds = new Set(next.map((drawing) => drawing.id));
    setUndoStack((stack) => [...stack, drawings]);
    setRedoStack([]);
    setSelectedIds((current) => current.filter((id) => availableIds.has(id)));
    setSelectedId((current) => current && availableIds.has(current) ? current : null);
    setDrawings(next);
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
      if (drawing.page !== pageNumber || drawing.type !== "supply" || drawing.fitting) continue;
      for (let index = 0; index < drawing.points.length - 1; index++) {
        const a = drawing.points[index];
        const b = drawing.points[index + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const lengthSquared = dx * dx + dy * dy;
        if (!lengthSquared) continue;
        const length = Math.sqrt(lengthSquared);
        const margin = Math.min(.45, 24 / length);
        const amount = Math.max(margin, Math.min(1 - margin, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared));
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
      isPrimaryAirflowEquipment(drawing) &&
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

  function queuedBranchRoute(center: Point, mainId: string, mainAngle: number) {
    const drawing = drawings.find((candidate) =>
      candidate.id === queuedBranchRunId &&
      candidate.id !== mainId &&
      candidate.page === pageNumber &&
      candidate.type === "supply" &&
      !candidate.fitting &&
      !candidate.symbol &&
      candidate.points.length >= 2
    );
    if (!drawing) return null;
    const lastIndex = drawing.points.length - 1;
    const startDistance = Math.hypot(drawing.points[0].x - center.x, drawing.points[0].y - center.y);
    const endDistance = Math.hypot(drawing.points[lastIndex].x - center.x, drawing.points[lastIndex].y - center.y);
    const endpointIndex = startDistance <= endDistance ? 0 : lastIndex;
    const endpoint = drawing.points[endpointIndex];
    const orientedPoints = endpointIndex === 0 ? drawing.points : [...drawing.points].reverse();
    const neighbor = orientedPoints[1];
    const angle = Math.atan2(neighbor.y - endpoint.y, neighbor.x - endpoint.x);
    const divergence = Math.abs(Math.sin(angle - mainAngle));
    if (divergence < .12) {
      setBranchMessage("That branch runs almost parallel with the trunk · choose a clearer T/Y location");
      return null;
    }
    const cross = Math.cos(mainAngle) * Math.sin(angle) - Math.sin(mainAngle) * Math.cos(angle);
    return {
      drawing,
      points: cleanPoints([center, ...orientedPoints.slice(1)]),
      angle,
      side: (cross >= 0 ? 1 : -1) as 1 | -1,
      distance: Math.min(startDistance, endDistance),
    };
  }

  function armRunFirstBranch(point: Point) {
    const candidate = nearestSupplySegment(point);
    if (!candidate || candidate.distance > 42 / zoom) {
      setBranchMessage("Step 1 · click directly on the completed blue run going to the diffuser");
      return false;
    }
    const alreadyAssigned = drawings.some((drawing) =>
      drawing.fitting?.connectedIds.includes(candidate.drawing.id)
    );
    if (alreadyAssigned) {
      setBranchMessage("That run is already attached to a T/Y · choose an unconnected diffuser run");
      return false;
    }
    setQueuedBranchRunId(candidate.drawing.id);
    setBranchHoverRunId(null);
    setBranchPreview(null);
    setSnapMarker(candidate.point);
    setActiveSystem(drawingSystem(candidate.drawing));
    setBranchMessage(`${candidate.drawing.size}″ branch run armed for Port 3 · now click anywhere on the blue trunk`);
    return true;
  }

  function existingBranchRoute(center: Point, mainId: string, mainAngle: number) {
    let best: { drawing: Drawing; points: Point[]; angle: number; side: 1 | -1; distance: number } | null = null;
    const main = drawings.find((drawing) => drawing.id === mainId);
    const mainSystem = main ? drawingSystem(main) : activeSystem;
    for (const drawing of drawings) {
      if (
        drawing.id === mainId ||
        drawing.page !== pageNumber ||
        drawing.type !== "supply" ||
        drawing.fitting ||
        drawing.symbol ||
        drawingSystem(drawing) !== mainSystem
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

  function branchOpportunities(): BranchOpportunity[] {
    const supplyRuns = drawings.filter((drawing) =>
      drawing.page === pageNumber &&
      drawing.type === "supply" &&
      !drawing.fitting &&
      !drawing.symbol &&
      drawing.points.length >= 2
    );
    const assignedRuns = new Set(drawings
      .filter((drawing) => drawing.page === pageNumber && drawing.fitting)
      .flatMap((drawing) => drawing.fitting?.connectedIds.filter(Boolean) || []));
    const fittingCenters = drawings
      .filter((drawing) => drawing.page === pageNumber && drawing.fitting)
      .map((drawing) => drawing.points[0]);
    const byPair = new Map<string, BranchOpportunity>();
    const distanceLimit = 44 / zoom;

    for (const main of supplyRuns) {
      const mainLength = main.points.slice(1).reduce((total, point, index) =>
        total + Math.hypot(point.x - main.points[index].x, point.y - main.points[index].y), 0);
      for (let segmentIndex = 0; segmentIndex < main.points.length - 1; segmentIndex += 1) {
        const a = main.points[segmentIndex];
        const b = main.points[segmentIndex + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const lengthSquared = dx * dx + dy * dy;
        if (!lengthSquared) continue;
        const segmentLength = Math.sqrt(lengthSquared);
        const mainAngle = Math.atan2(dy, dx);
        const edgeMargin = Math.min(.42, Math.max(.08, 18 / segmentLength));

        for (const branch of supplyRuns) {
          if (
            branch.id === main.id ||
            assignedRuns.has(branch.id) ||
            drawingSystem(branch) !== drawingSystem(main)
          ) continue;
          const branchLength = branch.points.slice(1).reduce((total, point, index) =>
            total + Math.hypot(point.x - branch.points[index].x, point.y - branch.points[index].y), 0);

          for (const endpointIndex of [0, branch.points.length - 1]) {
            const endpoint = branch.points[endpointIndex];
            const amount = ((endpoint.x - a.x) * dx + (endpoint.y - a.y) * dy) / lengthSquared;
            if (amount <= edgeMargin || amount >= 1 - edgeMargin) continue;
            const center = { x: a.x + amount * dx, y: a.y + amount * dy };
            const distance = Math.hypot(endpoint.x - center.x, endpoint.y - center.y);
            if (distance > distanceLimit) continue;
            if (fittingCenters.some((fittingCenter) => Math.hypot(fittingCenter.x - center.x, fittingCenter.y - center.y) < 32 / zoom)) continue;

            const neighbor = endpointIndex === 0 ? branch.points[1] : branch.points[branch.points.length - 2];
            const branchAngle = Math.atan2(neighbor.y - endpoint.y, neighbor.x - endpoint.x);
            const divergence = Math.abs(Math.sin(branchAngle - mainAngle));
            if (divergence < .22) continue;
            const cross = Math.cos(mainAngle) * Math.sin(branchAngle) - Math.sin(mainAngle) * Math.cos(branchAngle);
            const side = (cross >= 0 ? 1 : -1) as 1 | -1;
            const style = branchStyle === "auto" ? automaticBranchStyle(mainAngle, branchAngle) : branchStyle;
            const pairKey = [main.id, branch.id].sort().join(":");
            const score = distance - divergence * 8 - (mainLength >= branchLength ? 4 : 0);
            const opportunity: BranchOpportunity = {
              id: `${main.id}:${branch.id}:${segmentIndex}:${endpointIndex}`,
              center,
              angle: mainAngle,
              branchAngle,
              side,
              style,
              parentSize: main.size,
              mainRunId: main.id,
              branchRunId: branch.id,
              score,
            };
            const previous = byPair.get(pairKey);
            if (!previous || opportunity.score < previous.score) byPair.set(pairKey, opportunity);
          }
        }
      }
    }

    return [...byPair.values()]
      .sort((left, right) => left.score - right.score)
      .filter((opportunity, index, all) => !all.slice(0, index).some((previous) =>
        Math.hypot(previous.center.x - opportunity.center.x, previous.center.y - opportunity.center.y) < 26 / zoom
      ))
      .slice(0, 24);
  }

  function focusNextBranchOpportunity(opportunities = branchOpportunities()) {
    if (!opportunities.length) {
      setBranchMessage("No obvious unconnected junctions found · you can still click any blue trunk manually");
      return;
    }
    const index = branchOpportunityCursor % opportunities.length;
    const opportunity = opportunities[index];
    setBranchOpportunityCursor((index + 1) % opportunities.length);
    setActiveTool("branch");
    setSelectedId(null);
    setPendingBranchFittingId(null);
    setBranchPlacementResult(null);
    setQueuedBranchRunId(branchWorkflow === "run-first" ? opportunity.branchRunId : null);
    setBranchHoverRunId(null);
    setBranchPreview({
      center: opportunity.center,
      angle: opportunity.angle,
      branchAngle: opportunity.branchAngle,
      side: opportunity.side,
      style: opportunity.style,
      parentSize: opportunity.parentSize,
      valid: true,
      matchedExisting: true,
      mainRunId: opportunity.mainRunId,
      branchRunId: opportunity.branchRunId,
      runIds: [opportunity.mainRunId, opportunity.branchRunId],
      mode: "split-trunk",
    });
    setSnapMarker(opportunity.center);
    setBranchMessage(branchWorkflow === "run-first"
      ? `Branch run armed · suggested trunk location ${index + 1} of ${opportunities.length} · click the highlighted T/Y to confirm`
      : `Suggested junction ${index + 1} of ${opportunities.length} · click the highlighted T/Y to confirm`);
    const viewport = canvasViewportRef.current;
    if (viewport) updateCamera({
      x: viewport.clientWidth / 2 - opportunity.center.x * zoomRef.current,
      y: viewport.clientHeight / 2 - opportunity.center.y * zoomRef.current,
    });
  }

  function nearestAttachableSupplySegment(point: Point, fittingId: string) {
    const fitting = drawings.find((drawing) => drawing.id === fittingId && drawing.fitting);
    if (!fitting?.fitting) return null;
    const connected = new Set(fitting.fitting.connectedIds.filter(Boolean));
    let best: {
      drawing: Drawing;
      point: Point;
      distance: number;
      endpointIndex: number;
      angle: number;
      side: 1 | -1;
    } | null = null;
    for (const drawing of drawings) {
      if (
        drawing.page !== fitting.page ||
        drawing.type !== "supply" ||
        drawing.fitting ||
        connected.has(drawing.id) ||
        drawingSystem(drawing) !== drawingSystem(fitting) ||
        drawing.points.length < 2
      ) continue;
      for (let index = 0; index < drawing.points.length - 1; index += 1) {
        const a = drawing.points[index];
        const b = drawing.points[index + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const lengthSquared = dx * dx + dy * dy;
        if (!lengthSquared) continue;
        const amount = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared));
        const projected = { x: a.x + amount * dx, y: a.y + amount * dy };
        const distance = Math.hypot(point.x - projected.x, point.y - projected.y);
        if (best && distance >= best.distance) continue;
        const lastIndex = drawing.points.length - 1;
        const endpointIndex = Math.hypot(drawing.points[0].x - fitting.points[0].x, drawing.points[0].y - fitting.points[0].y)
          <= Math.hypot(drawing.points[lastIndex].x - fitting.points[0].x, drawing.points[lastIndex].y - fitting.points[0].y)
          ? 0
          : lastIndex;
        const endpoint = drawing.points[endpointIndex];
        const neighbor = endpointIndex === 0 ? drawing.points[1] : drawing.points[lastIndex - 1];
        const angle = Math.atan2(neighbor.y - endpoint.y, neighbor.x - endpoint.x);
        const cross = Math.cos(fitting.fitting.angle) * Math.sin(angle) - Math.sin(fitting.fitting.angle) * Math.cos(angle);
        best = { drawing, point: projected, distance, endpointIndex, angle, side: cross >= 0 ? 1 : -1 };
      }
    }
    return best;
  }

  function attachPendingBranchRun(point: Point) {
    if (!pendingBranchFittingId) return false;
    const fitting = drawings.find((drawing) => drawing.id === pendingBranchFittingId && drawing.fitting);
    const candidate = nearestAttachableSupplySegment(point, pendingBranchFittingId);
    if (!fitting?.fitting || !candidate || candidate.distance > 48 / zoom) {
      setBranchMessage("Click directly on the blue run you want connected to the open branch port");
      return true;
    }
    const resolvedStyle = branchStyle === "auto"
      ? automaticBranchStyle(fitting.fitting.angle, candidate.angle)
      : branchStyle;
    const connectedIds = [...fitting.fitting.connectedIds];
    connectedIds[2] = candidate.drawing.id;
    const updatedFitting: Drawing = {
      ...fitting,
      size: `${fitting.fitting.upstreamSize}×${fitting.fitting.downstreamSize}×${candidate.drawing.size}`,
      fitting: {
        ...fitting.fitting,
        style: resolvedStyle,
        branchAngle: candidate.angle,
        side: candidate.side,
        branchSize: candidate.drawing.size,
        connectedIds,
      },
    };
    const branchPort = fittingPortPoints(updatedFitting)[2];
    const connectedDrawings = drawings.map((drawing) => {
      if (drawing.id === updatedFitting.id) return updatedFitting;
      if (drawing.id !== candidate.drawing.id) return drawing;
      return {
        ...drawing,
        points: drawing.points.map((existingPoint, index) => index === candidate.endpointIndex ? branchPort : existingPoint),
      };
    });
    setHistory(connectedDrawings);
    setSelectedId(updatedFitting.id);
    setPendingBranchFittingId(null);
    setQueuedBranchRunId(null);
    setBranchHoverRunId(null);
    setBranchPreview(null);
    setSnapMarker(null);
    const completionMessage = `${resolvedStyle === "tee90" ? "90° tee" : "45° wye"} complete · 3 of 3 ports attached`;
    setBranchMessage(completionMessage);
    setBranchPlacementResult({ fittingId: updatedFitting.id, message: completionMessage });
    return true;
  }

  function existingThreeRunJunction(point: Point): ThreeRunBranchMatch | null {
    const radius = 62 / zoom;
    const endpoints = drawings
      .filter((drawing) =>
        drawing.page === pageNumber &&
        drawing.type === "supply" &&
        !drawing.fitting &&
        drawing.points.length >= 2
      )
      .flatMap((drawing) => [0, drawing.points.length - 1].map((endpointIndex) => {
        const endpoint = drawing.points[endpointIndex];
        const neighbor = endpointIndex === 0 ? drawing.points[1] : drawing.points[drawing.points.length - 2];
        return {
          drawing,
          endpointIndex,
          endpoint,
          neighbor,
          distance: Math.hypot(endpoint.x - point.x, endpoint.y - point.y),
        };
      }))
      .filter((candidate) => candidate.distance <= radius)
      .sort((a, b) => a.distance - b.distance);

    const nearestByRun = [...new Map(endpoints.map((candidate) => [candidate.drawing.id, candidate])).values()].slice(0, 12);
    if (nearestByRun.length < 3) return null;

    let best: { a: typeof nearestByRun[number]; b: typeof nearestByRun[number]; c: typeof nearestByRun[number]; score: number } | null = null;
    for (let aIndex = 0; aIndex < nearestByRun.length - 2; aIndex += 1) {
      for (let bIndex = aIndex + 1; bIndex < nearestByRun.length - 1; bIndex += 1) {
        const a = nearestByRun[aIndex];
        const b = nearestByRun[bIndex];
        const angleA = Math.atan2(a.neighbor.y - a.endpoint.y, a.neighbor.x - a.endpoint.x);
        const angleB = Math.atan2(b.neighbor.y - b.endpoint.y, b.neighbor.x - b.endpoint.x);
        const oppositeError = Math.abs(Math.PI - Math.abs(Math.atan2(Math.sin(angleA - angleB), Math.cos(angleA - angleB))));
        if (oppositeError > Math.PI * .38) continue;
        for (let cIndex = 0; cIndex < nearestByRun.length; cIndex += 1) {
          if (cIndex === aIndex || cIndex === bIndex) continue;
          const c = nearestByRun[cIndex];
          if (drawingSystem(a.drawing) !== drawingSystem(b.drawing) || drawingSystem(a.drawing) !== drawingSystem(c.drawing)) continue;
          const angleC = Math.atan2(c.neighbor.y - c.endpoint.y, c.neighbor.x - c.endpoint.x);
          const divergence = Math.min(
            Math.abs(Math.sin(angleC - angleA)),
            Math.abs(Math.sin(angleC - angleB)),
          );
          if (divergence < .28) continue;
          const score = a.distance + b.distance + c.distance + oppositeError * 28 - divergence * 12;
          if (!best || score < best.score) best = { a, b, c, score };
        }
      }
    }
    if (!best) return null;

    const center = {
      x: (best.a.endpoint.x + best.b.endpoint.x + best.c.endpoint.x) / 3,
      y: (best.a.endpoint.y + best.b.endpoint.y + best.c.endpoint.y) / 3,
    };
    const junctionSystem = drawingSystem(best.a.drawing);
    const equipment = drawings.filter((drawing) =>
      drawing.page === pageNumber &&
      isPrimaryAirflowEquipment(drawing) &&
      drawingSystem(drawing) === junctionSystem
    );
    const sourceDistance = (candidate: (typeof nearestByRun)[number]) => equipment.length
      ? Math.min(...equipment.map((unit) => Math.hypot(candidate.neighbor.x - unit.points[0].x, candidate.neighbor.y - unit.points[0].y)))
      : candidate.distance;
    const upstream = sourceDistance(best.a) <= sourceDistance(best.b) ? best.a : best.b;
    const downstream = upstream === best.a ? best.b : best.a;
    const branch = best.c;
    const upstreamDirection = Math.atan2(upstream.neighbor.y - upstream.endpoint.y, upstream.neighbor.x - upstream.endpoint.x);
    const angle = upstreamDirection + Math.PI;
    const branchAngle = Math.atan2(branch.neighbor.y - branch.endpoint.y, branch.neighbor.x - branch.endpoint.x);
    const cross = Math.cos(angle) * Math.sin(branchAngle) - Math.sin(angle) * Math.cos(branchAngle);
    const side: 1 | -1 = cross >= 0 ? 1 : -1;
    return {
      center,
      angle,
      branchAngle,
      side,
      style: branchStyle === "auto" ? automaticBranchStyle(angle, branchAngle) : branchStyle,
      ports: [upstream, downstream, branch].map(({ drawing, endpointIndex }) => ({ drawing, endpointIndex })),
    };
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

  function normalizedRunLineWeight(value?: number) {
    return [0.1, 0.2, 0.3].includes(Number(value)) ? Number(value) : 0.2;
  }

  function runStrokeWidth(value?: number) {
    return 1 + normalizedRunLineWeight(value) * 20;
  }

  function fittingPortVisual(fitting: Drawing, port: 0 | 1 | 2) {
    const connectedId = fitting.fitting?.connectedIds[port];
    const connectedRun = drawings.find((drawing) =>
      drawing.id === connectedId &&
      !drawing.fitting &&
      !drawing.symbol &&
      ["supply", "return", "fresh"].includes(drawing.type)
    );
    const fallbackSize = [
      fitting.fitting?.upstreamSize,
      fitting.fitting?.downstreamSize,
      fitting.fitting?.branchSize,
    ][port] || "8";
    return {
      size: connectedRun?.size || fallbackSize,
      lineWeight: normalizedRunLineWeight(connectedRun?.lineWeight),
      strokeWidth: runStrokeWidth(connectedRun?.lineWeight),
    };
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

  function calculateAirflowNetwork() {
    const runs = drawings.filter((drawing) => ["supply", "return", "fresh"].includes(drawing.type) && !drawing.fitting);
    const direct = new Map<string, number>();
    const terminalRun = new Map<string, string>();
    const equipmentRun = new Map<string, string>();
    const children = new Map<string, string[]>();
    for (const fitting of drawings.filter((drawing) => drawing.fitting)) {
      const [upstreamId, downstreamId, branchId] = fitting.fitting!.connectedIds;
      children.set(upstreamId, [...new Set([...(children.get(upstreamId) || []), downstreamId, branchId].filter(Boolean))]);
    }
    for (const symbol of drawings.filter((drawing) => drawing.symbol)) {
      const desiredType = symbol.symbol?.kind === "diffuser" ? ["supply"] : symbol.symbol?.kind === "returnGrille" ? ["return"] : [];
      if (isPrimaryAirflowEquipment(symbol)) {
        const savedRun = runs.find((run) =>
          run.id === symbol.symbol?.connectedRunId &&
          run.page === symbol.page &&
          run.type === "supply" &&
          drawingSystem(run) === drawingSystem(symbol)
        );
        if (savedRun) {
          equipmentRun.set(symbol.id, savedRun.id);
        }
        continue;
      }
      if (!desiredType.length) continue;
      const savedRun = runs.find((run) =>
        run.id === symbol.symbol?.connectedRunId &&
        run.page === symbol.page &&
        desiredType.includes(run.type) &&
        drawingSystem(run) === drawingSystem(symbol)
      );
      if (savedRun) {
        terminalRun.set(symbol.id, savedRun.id);
        direct.set(savedRun.id, (direct.get(savedRun.id) || 0) + (symbol.cfm || 0));
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

  function airflowNetwork() {
    return airflowNetworkModel;
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

  function symbolNetworkTrace(symbol?: Drawing) {
    const runIds = new Set<string>();
    const fittingIds = new Set<string>();
    const symbolIds = new Set<string>();
    const empty = { runIds, fittingIds, symbolIds, totalCfm: 0, runCount: 0, fittingCount: 0, terminalCount: 0, sourceConnected: false };
    if (!symbol?.symbol || (
      !["diffuser", "returnGrille"].includes(symbol.symbol.kind) &&
      !isPrimaryAirflowEquipment(symbol)
    )) return empty;

    const network = airflowNetwork();
    const rootRunId = symbol.symbol.connectedRunId ||
      (symbol.symbol.kind === "equipment" ? network.equipmentRun.get(symbol.id) : network.terminalRun.get(symbol.id));
    const rootRun = drawings.find((drawing) => drawing.id === rootRunId);
    if (!rootRun) {
      symbolIds.add(symbol.id);
      return empty;
    }

    const trace = ductNetworkTrace(rootRun);
    const tracedSymbols = drawings.filter((drawing) => {
      if (!drawing.symbol) return false;
      const runId = isPrimaryAirflowEquipment(drawing)
        ? network.equipmentRun.get(drawing.id)
        : network.terminalRun.get(drawing.id);
      return Boolean(runId && trace.runIds.has(runId));
    });
    tracedSymbols.forEach((drawing) => symbolIds.add(drawing.id));
    symbolIds.add(symbol.id);
    return { ...trace, symbolIds };
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
    const next = drawings.map((drawing) => ({ ...drawing, points: drawing.points.map((point) => ({ ...point })), fitting: drawing.fitting ? { ...drawing.fitting, connectedIds: [...drawing.fitting.connectedIds] } : undefined }));
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
    const maximumSize = allowedResidentialFlexSizes.includes(residentialFlexMax) ? Number(residentialFlexMax) : 16;
    const sizes = allowedResidentialFlexSizes.filter((size) => Number(size) <= maximumSize);
    const maximumVelocity = type === "supply"
      ? supplyVelocityLimit
      : type === "return"
        ? returnVelocityLimit
        : freshVelocityLimit;
    return sizes.find((size) => velocityFpm(size, cfm) <= maximumVelocity) || sizes.at(-1) || "16";
  }

  function sizingSuggestions() {
    return drawings
      .filter((drawing) => ["supply", "return", "fresh"].includes(drawing.type) && !drawing.fitting && drawingSystem(drawing) === activeSystem)
      .map((drawing) => {
        const cfm = runAirflow(drawing);
        const recommended = recommendedDuctSize(cfm, drawing.type);
        const limit = drawing.type === "supply"
          ? supplyVelocityLimit
          : drawing.type === "return"
            ? returnVelocityLimit
            : freshVelocityLimit;
        return {
          id: drawing.id,
          type: drawing.type,
          current: drawing.size,
          recommended,
          cfm,
          currentVelocity: velocityFpm(drawing.size, cfm),
          velocity: velocityFpm(recommended, cfm),
          limit,
          overCapacity: velocityFpm(recommended, cfm) > limit,
          room: drawing.roomName?.trim() || "Unassigned route",
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
    const proposed = new Map(sizingSuggestions()
      .filter((suggestion) => selectedSizingIds.includes(suggestion.id) && !suggestion.overCapacity)
      .map((suggestion) => [suggestion.id, suggestion.recommended]));
    if (!proposed.size) {
      setBranchMessage("Select at least one safe reviewed size change before applying");
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
    setBranchMessage(`${proposed.size} reviewed duct size change${proposed.size === 1 ? "" : "s"} applied · Undo is available`);
    setSelectedSizingIds([]);
    setShowSizingReview(false);
  }

  function openSizingReview() {
    setSelectedSizingIds([]);
    setShowSizingReview(true);
  }

  function toggleSizingSuggestion(id: string) {
    setSelectedSizingIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function designAirflow() {
    const equipment = drawings.filter((drawing) => isPrimaryAirflowEquipment(drawing) && drawingSystem(drawing) === activeSystem);
    const targetCfm = equipment.reduce((total, drawing) => {
      const tons = Number(drawing.size.match(/[\d.]+/)?.[0] || 0);
      return total + (drawing.cfm || tons * 400);
    }, 0);
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

  function airflowSetupSummary() {
    const airflow = designAirflow();
    const network = airflowNetwork();
    const equipment = drawings.filter((drawing) => isPrimaryAirflowEquipment(drawing) && drawingSystem(drawing) === activeSystem);
    const primaryUnit = equipment.find((drawing) => network.equipmentRun.has(drawing.id)) || equipment[0];
    const primaryTons = Number(primaryUnit?.size.match(/[\d.]+/)?.[0] || 0);
    const supplyTerminals = drawings.filter((drawing) => drawing.symbol?.kind === "diffuser" && drawingSystem(drawing) === activeSystem);
    const returnTerminals = drawings.filter((drawing) => drawing.symbol?.kind === "returnGrille" && drawingSystem(drawing) === activeSystem);
    const connectedSupplyCfm = supplyTerminals
      .filter((drawing) => network.terminalRun.has(drawing.id))
      .reduce((total, drawing) => total + (drawing.cfm || 0), 0);
    const connectedReturnCfm = returnTerminals
      .filter((drawing) => network.terminalRun.has(drawing.id))
      .reduce((total, drawing) => total + (drawing.cfm || 0), 0);
    const maximumFlexSize = allowedResidentialFlexSizes.includes(residentialFlexMax) ? Number(residentialFlexMax) : 16;
    const maxFlexSupplyCapacity = Math.round(Math.PI * Math.pow(maximumFlexSize / 12, 2) / 4 * supplyVelocityLimit);
    const maxFlexReturnCapacity = Math.round(Math.PI * Math.pow(maximumFlexSize / 12, 2) / 4 * returnVelocityLimit);
    const supplyPathCount = airflow.targetCfm ? Math.max(1, Math.ceil(airflow.targetCfm / Math.max(1, maxFlexSupplyCapacity))) : 0;
    const returnPathCount = airflow.targetCfm ? Math.max(1, Math.ceil(airflow.targetCfm / Math.max(1, maxFlexReturnCapacity))) : 0;
    const supplyGap = airflow.targetCfm - airflow.supplyCfm;
    const returnGap = airflow.targetCfm - airflow.returnCfm;
    const supplyPercent = airflow.targetCfm ? Math.round(airflow.supplyCfm / airflow.targetCfm * 100) : 0;
    const returnPercent = airflow.targetCfm ? Math.round(airflow.returnCfm / airflow.targetCfm * 100) : 0;
    return {
      ...airflow,
      equipment,
      primaryUnit,
      primaryTons,
      maximumFlexSize,
      supplyTerminals,
      returnTerminals,
      connectedSupplyCfm,
      connectedReturnCfm,
      connectedSupplyTerminals: supplyTerminals.filter((drawing) => network.terminalRun.has(drawing.id)).length,
      connectedReturnTerminals: returnTerminals.filter((drawing) => network.terminalRun.has(drawing.id)).length,
      supplyGap,
      returnGap,
      supplyPercent,
      returnPercent,
      maxFlexSupplyCapacity,
      maxFlexReturnCapacity,
      supplyPathCount,
      returnPathCount,
      averageSupplyTarget: supplyTerminals.length ? Math.round(airflow.targetCfm / supplyTerminals.length / 5) * 5 : 0,
      averageReturnTarget: returnTerminals.length ? Math.round(airflow.targetCfm / returnTerminals.length / 5) * 5 : 0,
      supplyBalanced: Boolean(airflow.targetCfm && Math.abs(supplyGap) <= Math.max(25, airflow.targetCfm * .1)),
      returnBalanced: Boolean(airflow.targetCfm && Math.abs(returnGap) <= Math.max(50, airflow.targetCfm * .15)),
    };
  }

  function systemStats(systemId: string) {
    const scoped = drawings.filter((drawing) => drawingSystem(drawing) === systemId);
    const equipment = scoped.filter((drawing) => isPrimaryAirflowEquipment(drawing));
    const designCfm = equipment.reduce((total, drawing) => {
      const tons = Number(drawing.size.match(/[\d.]+/)?.[0] || 0);
      return total + (drawing.cfm || tons * 400);
    }, 0);
    const supplyCfm = scoped.filter((drawing) => drawing.symbol?.kind === "diffuser").reduce((total, drawing) => total + (drawing.cfm || 0), 0);
    const returnCfm = scoped.filter((drawing) => drawing.symbol?.kind === "returnGrille").reduce((total, drawing) => total + (drawing.cfm || 0), 0);
    const supplyBalanced = designCfm > 0 && Math.abs(supplyCfm - designCfm) <= designCfm * .1;
    const returnBalanced = designCfm > 0 && returnCfm > 0 && Math.abs(returnCfm - designCfm) <= designCfm * .15;
    const balanced = supplyBalanced && returnBalanced;
    return { objects: scoped.length, units: equipment.length, designCfm, supplyCfm, returnCfm, balanced };
  }

  function networkBalanceRows() {
    const network = airflowNetwork();
    const equipment = drawings.filter((drawing) => isPrimaryAirflowEquipment(drawing) && drawingSystem(drawing) === activeSystem);
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

  function allocateAirflowTotal(
    totalCfm: number,
    rows: Array<{ key: string; weight: number }>,
  ) {
    const allocations = new Map<string, number>();
    if (!rows.length) return allocations;
    const roundedTotal = Math.max(0, Math.round(totalCfm / 5) * 5);
    const totalWeight = rows.reduce((total, row) => total + Math.max(.01, row.weight), 0);
    const raw = rows.map((row) => {
      const exact = roundedTotal * Math.max(.01, row.weight) / totalWeight;
      const base = Math.floor(exact / 5) * 5;
      return { ...row, exact, base, fraction: exact - base };
    });
    raw.forEach((row) => allocations.set(row.key, row.base));
    let remainder = roundedTotal - raw.reduce((total, row) => total + row.base, 0);
    const order = [...raw].sort((a, b) => b.fraction - a.fraction || a.key.localeCompare(b.key));
    let cursor = 0;
    while (remainder >= 5 && order.length) {
      const row = order[cursor % order.length];
      allocations.set(row.key, (allocations.get(row.key) || 0) + 5);
      remainder -= 5;
      cursor += 1;
    }
    return allocations;
  }

  function suggestedRoomAirflowTargets(
    currentTargets = roomAirflowTargets[activeSystem] || {},
  ) {
    const rooms = roomSchedule();
    const targetCfm = designAirflow().targetCfm || roomScheduleSummary().supplyCfm || roomScheduleSummary().returnCfm;
    const multiplier = (priority: RoomAirflowPriority) => priority === "high" ? 1.25 : priority === "low" ? .8 : 1;
    const priorities = new Map(rooms.map((room) => [
      room.name.toLowerCase(),
      currentTargets[room.name.toLowerCase()]?.priority || "standard" as RoomAirflowPriority,
    ]));
    const supply = allocateAirflowTotal(targetCfm, rooms
      .filter((room) => room.diffusers > 0)
      .map((room) => ({
        key: room.name.toLowerCase(),
        weight: (room.supplyCfm || room.diffusers * 100) * multiplier(priorities.get(room.name.toLowerCase()) || "standard"),
      })));
    const returns = allocateAirflowTotal(targetCfm, rooms
      .filter((room) => room.returns > 0)
      .map((room) => ({
        key: room.name.toLowerCase(),
        weight: (room.returnCfm || room.returns * 100) * multiplier(priorities.get(room.name.toLowerCase()) || "standard"),
      })));
    return Object.fromEntries(rooms.map((room) => {
      const key = room.name.toLowerCase();
      return [key, {
        supplyCfm: supply.get(key) || 0,
        returnCfm: returns.get(key) || 0,
        priority: priorities.get(key) || "standard",
      } satisfies RoomAirflowTarget];
    }));
  }

  function activeRoomAirflowTargets() {
    return roomAirflowTargets[activeSystem] || suggestedRoomAirflowTargets();
  }

  function openSystemBalanceWorkspace(view: "system" | "rooms" | "runs" = "system") {
    if (!roomAirflowTargets[activeSystem] && roomSchedule().length) {
      setRoomAirflowTargets((current) => ({
        ...current,
        [activeSystem]: suggestedRoomAirflowTargets(),
      }));
    }
    setSelectedCfmProposalIds([]);
    setBalanceView(view);
    setRightTab("rooms");
  }

  function recalculateRoomAirflowTargets() {
    const suggested = suggestedRoomAirflowTargets(roomAirflowTargets[activeSystem] || {});
    setRoomAirflowTargets((current) => ({ ...current, [activeSystem]: suggested }));
    setSelectedCfmProposalIds([]);
    setBranchMessage(`${systemLabel(activeSystem)} room targets recalculated for review · no drawing CFM changed`);
  }

  function updateRoomAirflowTarget(roomName: string, changes: Partial<RoomAirflowTarget>) {
    const key = roomName.toLowerCase();
    const currentSystem = activeRoomAirflowTargets();
    const currentTarget = currentSystem[key] || { supplyCfm: 0, returnCfm: 0, priority: "standard" as RoomAirflowPriority };
    const nextTarget = {
      ...currentTarget,
      ...changes,
      supplyCfm: Math.max(0, Number(changes.supplyCfm ?? currentTarget.supplyCfm) || 0),
      returnCfm: Math.max(0, Number(changes.returnCfm ?? currentTarget.returnCfm) || 0),
    };
    setRoomAirflowTargets((current) => ({
      ...current,
      [activeSystem]: { ...currentSystem, [key]: nextTarget },
    }));
    setSelectedCfmProposalIds([]);
  }

  function terminalCfmProposals(targets = activeRoomAirflowTargets()): TerminalCfmProposal[] {
    const network = airflowNetwork();
    return roomSchedule().flatMap((room) => {
      const roomKey = room.name.toLowerCase();
      const target = targets[roomKey] || { supplyCfm: 0, returnCfm: 0, priority: "standard" as RoomAirflowPriority };
      const supplyTerminals = drawings.filter((drawing) =>
        drawingSystem(drawing) === activeSystem &&
        drawing.roomName?.trim().toLowerCase() === roomKey &&
        drawing.symbol?.kind === "diffuser"
      );
      const returnTerminals = drawings.filter((drawing) =>
        drawingSystem(drawing) === activeSystem &&
        drawing.roomName?.trim().toLowerCase() === roomKey &&
        drawing.symbol?.kind === "returnGrille"
      );
      const build = (terminals: Drawing[], kind: "supply" | "return", total: number) => {
        const split = allocateAirflowTotal(total, terminals.map((drawing) => ({ key: drawing.id, weight: 1 })));
        return terminals.map((drawing) => ({
          id: `${drawing.id}-cfm`,
          drawingId: drawing.id,
          kind,
          room: room.name,
          label: drawing.symbol?.label || (kind === "supply" ? "Supply diffuser" : "Return grille"),
          current: drawing.cfm || 0,
          proposed: split.get(drawing.id) || 0,
          target: total,
          terminalCount: terminals.length,
          connected: network.terminalRun.has(drawing.id),
        })).filter((proposal) => proposal.current !== proposal.proposed);
      };
      return [
        ...build(supplyTerminals, "supply", target.supplyCfm),
        ...build(returnTerminals, "return", target.returnCfm),
      ];
    });
  }

  function applySelectedCfmProposals() {
    const proposals = terminalCfmProposals().filter((proposal) => selectedCfmProposalIds.includes(proposal.id));
    if (!proposals.length) {
      setBranchMessage("Select at least one reviewed terminal CFM change before applying");
      return;
    }
    const proposed = new Map(proposals.map((proposal) => [proposal.drawingId, proposal.proposed]));
    setHistory(drawings.map((drawing) => proposed.has(drawing.id) ? { ...drawing, cfm: proposed.get(drawing.id) } : drawing));
    setSelectedCfmProposalIds([]);
    setBranchMessage(`${proposals.length} reviewed terminal CFM change${proposals.length === 1 ? "" : "s"} applied in one undoable step · duct sizes were not changed`);
  }

  function selectRoomOnPlan(drawingIds: string[]) {
    if (!drawingIds.length) return;
    setSelectedIds(drawingIds);
    setSelectedId(drawingIds[0]);
    setActiveTool("select");
  }

  function exportRoomScheduleCsv() {
    const rows = roomSchedule();
    if (!rows.length) return;
    const targets = activeRoomAirflowTargets();
    const quote = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const csv = [
      ["System", "Room", "Type", "Design Supply Target", "Scheduled Supply", "Supply Variance", "Design Return Target", "Scheduled Return", "Net Room Air", "Diffusers", "Return Grilles", "Return Path", "Missing CFM Entries"],
      ...rows.map((room) => {
        const target = targets[room.name.toLowerCase()] || { supplyCfm: 0, returnCfm: 0 };
        return [
          systemLabel(activeSystem),
          room.name,
          room.type || "general",
          target.supplyCfm,
          room.supplyCfm,
          room.supplyCfm - target.supplyCfm,
          target.returnCfm,
          room.returnCfm,
          room.balanceCfm,
          room.diffusers,
          room.returns,
          room.needsReturn ? "REVIEW" : "OK",
          room.missingCfm,
        ];
      }),
    ].map((row) => row.map(quote).join(",")).join("\n");
    const link = document.createElement("a");
    const objectUrl = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.href = objectUrl;
    link.download = `${systemLabel(activeSystem).replaceAll(" ", "-").toLowerCase()}-room-airflow.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  }

  function stableTextHash(value: string) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function canonicalReleaseValue(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(canonicalReleaseValue);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalReleaseValue(entry)]),
    );
  }

  function cloudReleaseFingerprintFromProject(project: Partial<SavedProject>) {
    const releaseState = {
      drawings: [...(project.drawings || [])].sort((left, right) => left.id.localeCompare(right.id)),
      pdfFingerprint: project.pdfFingerprint || "",
      scaleFeetPerUnit: project.scaleFeetPerUnit || 0,
      scaleLabel: project.scaleLabel || "",
      scaleVerified: Boolean(project.scaleVerified),
      systemNames: project.systemNames || {},
      velocityRules: {
        supply: project.supplyVelocityLimit || 0,
        return: project.returnVelocityLimit || 0,
        fresh: project.freshVelocityLimit || 0,
        residentialFlexMax: project.residentialFlexMax || "",
      },
      fieldChecklistBySystem: project.fieldChecklistBySystem || {},
      punchItems: project.punchItems || [],
      rfiItems: project.rfiItems || [],
      roomAirflowTargets: project.roomAirflowTargets || {},
      reviewDecisionsBySystem: project.reviewDecisionsBySystem || {},
    };
    return stableTextHash(JSON.stringify(canonicalReleaseValue(releaseState)));
  }

  function stableByteHash(value: Uint8Array) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value[index];
      hash = Math.imul(hash, 16777619);
    }
    return `${value.length.toString(36)}-${(hash >>> 0).toString(36)}`;
  }

  function validationIssues(): ValidationIssue[] {
    const issues: Array<Omit<ValidationIssue, "id">> = [];
    const balance = designAirflow();
    const equipment = drawings.filter((drawing) => isPrimaryAirflowEquipment(drawing) && drawingSystem(drawing) === activeSystem);
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
    if (balance.targetCfm && Math.abs(balance.returnCfm - balance.targetCfm) > balance.targetCfm * .1) {
      issues.push({ severity: "warning", title: "Return CFM needs review", detail: `${balance.returnCfm} return vs ${balance.targetCfm} design CFM.` });
    }
    for (const drawing of drawings) {
      if (drawingSystem(drawing) !== activeSystem) continue;
      if (!["supply", "return", "fresh"].includes(drawing.type) || drawing.fitting) continue;
      const cfm = runAirflow(drawing);
      const velocity = velocityFpm(drawing.size, cfm);
      const highLimit = drawing.type === "supply"
        ? supplyVelocityLimit
        : drawing.type === "return"
          ? returnVelocityLimit
          : freshVelocityLimit;
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
      const openPorts = ([0, 1, 2] as const).filter((port) => !fittingPortState(fitting, port).connected);
      if (openPorts.length) issues.push({
        severity: "warning",
        title: "Branch fitting port open",
        detail: `${openPorts.length} ${openPorts.length === 1 ? "port is" : "ports are"} missing or detached on this ${fitting.fitting?.style === "tee90" ? "tee" : "wye"}.`,
        drawingId: fitting.id,
      });
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
    const terminalsWithoutRooms = [...diffusers, ...returnGrilles].filter((drawing) => !drawing.roomName?.trim());
    if (terminalsWithoutRooms.length) issues.push({
      severity: "warning",
      title: "Terminal room assignments missing",
      detail: `${terminalsWithoutRooms.length} air device${terminalsWithoutRooms.length === 1 ? " needs" : "s need"} a room or area before field release.`,
      drawingId: terminalsWithoutRooms[0].id,
    });
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
      const touchesOtherSystem = run.points.some((point) => otherRuns.some((other) =>
        other.page === run.page &&
        other.points.some((otherPoint) => Math.hypot(point.x - otherPoint.x, point.y - otherPoint.y) < 2)
      ));
      if (touchesOtherSystem) issues.push({ severity: "critical", title: "Systems touch at a connection", detail: `${systemLabel(activeSystem)} contacts another system. Keep zones separated.`, drawingId: run.id });
    }
    for (const room of roomSchedule()) {
      if (room.type === "bedroom" && room.supplyCfm > 0 && room.returns === 0) {
        issues.push({ severity: "warning", title: "Bedroom return path missing", detail: `${room.name} has ${room.supplyCfm} supply CFM but no assigned return. Verify door-closed pressure relief.`, drawingId: room.drawingIds[0] });
      }
      if (room.type === "bedroom" && room.returns > 0 && room.returnCfm === 0) {
        issues.push({ severity: "info", title: "Bedroom return CFM missing", detail: `${room.name} has a return grille without scheduled airflow.`, drawingId: room.drawingIds[0] });
      }
    }
    const freshRuns = drawings.filter((drawing) => drawingSystem(drawing) === activeSystem && drawing.type === "fresh" && !drawing.fitting);
    const motorDampers = drawings.filter((drawing) => drawingSystem(drawing) === activeSystem && drawing.symbol?.kind === "motorDamper");
    if (freshRuns.length && !motorDampers.length) issues.push({ severity: "warning", title: "Outside-air damper missing", detail: "Fresh-air duct is shown without a motorized damper. Verify whether the existing damper is reusable." });
    if (equipment.length && !drawings.some((drawing) => drawingSystem(drawing) === activeSystem && drawing.symbol?.kind === "thermostat")) {
      issues.push({ severity: "info", title: "Thermostat location not marked", detail: `Add the control point for ${systemLabel(activeSystem)} so the field team can coordinate wiring.` });
    }
    return issues.map((issue) => ({
      ...issue,
      id: `review-${stableTextHash([activeSystem, issue.title, issue.drawingId || "system", issue.detail].join("|"))}`,
    }));
  }

  function issueCategory(title: string) {
    const value = title.toLowerCase();
    if (["disconnect", "connection", "fitting", "pulled away", "systems touch"].some((term) => value.includes(term))) return "Connections";
    if (["return", "bedroom", "door-closed"].some((term) => value.includes(term))) return "Return paths";
    if (["velocity", "friction", "pressure loss"].some((term) => value.includes(term))) return "Velocity & pressure";
    if (["cfm", "balance", "airflow"].some((term) => value.includes(term))) return "Airflow";
    return "Coordination";
  }

  function validationDashboard(issues = validationIssues()) {
    const rooms = roomSchedule();
    const suppliedBedrooms = rooms.filter((room) => room.type === "bedroom" && room.supplyCfm > 0);
    const bedroomReturnRisks = suppliedBedrooms.filter((room) => room.needsReturn);
    const counts = {
      critical: issues.filter((issue) => issue.severity === "critical").length,
      warning: issues.filter((issue) => issue.severity === "warning").length,
      info: issues.filter((issue) => issue.severity === "info").length,
    };
    return {
      issues,
      counts,
      score: Math.max(0, Math.min(100, 100 - counts.critical * 18 - counts.warning * 7 - counts.info * 2)),
      connectionProblems: issues.filter((issue) => issueCategory(issue.title) === "Connections").length,
      suppliedBedrooms,
      bedroomReturnRisks,
      returnDeficit: Math.max(0, designAirflow().targetCfm - designAirflow().returnCfm),
    };
  }

  function activeFieldChecklist(systemId = activeSystem) {
    return fieldChecklistBySystem[systemId] || {};
  }

  function updateFieldChecklist(id: string, checked: boolean) {
    setFieldChecklistBySystem((current) => ({
      ...current,
      [activeSystem]: { ...(current[activeSystem] || {}), [id]: checked },
    }));
  }

  function activeReviewDecisions(systemId = activeSystem) {
    return reviewDecisionsBySystem[systemId] || {};
  }

  function reviewIssueReference(issue: ValidationIssue) {
    return `REV-${issue.id.replace("review-", "").slice(-5).toUpperCase()}`;
  }

  function reviewIssueMarkerLabel(issue: ValidationIssue) {
    return `${issue.severity === "critical" ? "C" : issue.severity === "warning" ? "W" : "I"}${issue.id.replace("review-", "").slice(-2).toUpperCase()}`;
  }

  function reviewedIssueRows(issues = validationIssues()) {
    const decisions = activeReviewDecisions();
    const severityOrder: Record<ValidationSeverity, number> = { critical: 0, warning: 1, info: 2 };
    return issues
      .map((issue) => {
        const decision = decisions[issue.id];
        const linkedRfi = decision?.status === "rfi" ? rfiItems.find((item) => item.id === decision.linkedRecordId) : undefined;
        const linkedPunch = decision?.status === "punch" ? punchItems.find((item) => item.id === decision.linkedRecordId) : undefined;
        const decisionComplete = decision?.status === "accepted" ||
          (decision?.status === "rfi" && Boolean(linkedRfi && ["approved", "closed"].includes(linkedRfi.status))) ||
          (decision?.status === "punch" && linkedPunch?.status === "resolved");
        const resolvedByDecision = issue.severity !== "critical" && Boolean(decisionComplete);
        return { issue, decision, resolvedByDecision };
      })
      .sort((a, b) =>
        severityOrder[a.issue.severity] - severityOrder[b.issue.severity] ||
        a.issue.title.localeCompare(b.issue.title)
      );
  }

  function filteredReviewIssueRows(rows = reviewedIssueRows()) {
    return rows.filter((row) => {
      if (reviewQueueFilter === "open") return !row.resolvedByDecision;
      if (reviewQueueFilter === "accepted") return row.resolvedByDecision;
      return true;
    });
  }

  function reviewSummary(rows = reviewedIssueRows()) {
    const critical = rows.filter((row) => row.issue.severity === "critical").length;
    const openWarnings = rows.filter((row) => row.issue.severity === "warning" && !row.resolvedByDecision).length;
    const acceptedWarnings = rows.filter((row) => row.issue.severity === "warning" && row.resolvedByDecision).length;
    const advisory = rows.filter((row) => row.issue.severity === "info").length;
    return {
      rows,
      critical,
      openWarnings,
      acceptedWarnings,
      advisory,
      blockers: critical + openWarnings,
    };
  }

  function focusDrawingOnPlan(drawingId: string) {
    const drawing = drawings.find((candidate) => candidate.id === drawingId);
    if (!drawing) return;
    const point = drawing.points[Math.floor(drawing.points.length / 2)] || drawing.points[0];
    if (!point) return;
    setActiveSystem(drawingSystem(drawing));
    setSelectedId(drawing.id);
    setSelectedIds([drawing.id]);
    setActiveTool("select");
    if (drawing.page !== pageNumber || renderedPageNumber !== drawing.page) {
      pendingFocusRef.current = { page: drawing.page, point };
      setPageNumber(drawing.page);
      return;
    }
    requestAnimationFrame(() => {
      const viewport = canvasViewportRef.current;
      if (!viewport) return;
      updateCamera({
        x: viewport.clientWidth / 2 - point.x * zoomRef.current,
        y: viewport.clientHeight / 2 - point.y * zoomRef.current,
      });
    });
  }

  function focusReviewIssue(issue: ValidationIssue) {
    setRightTab("checks");
    setReviewView("issues");
    setActiveReviewIssueId(issue.id);
    setReviewerName(activeReviewDecisions()[issue.id]?.reviewer || "");
    setReviewDecisionNote(activeReviewDecisions()[issue.id]?.note || "");
    if (issue.drawingId) focusDrawingOnPlan(issue.drawingId);
  }

  function reviewIssueMarkers(rows = reviewedIssueRows()) {
    if (!showReviewMarkers || rightTab !== "checks") return [];
    const drawingOccurrences = new Map<string, number>();
    return rows.flatMap((row) => {
      if (!row.issue.drawingId) return [];
      const drawing = drawings.find((candidate) => candidate.id === row.issue.drawingId && candidate.page === pageNumber);
      if (!drawing) return [];
      const point = drawing.points[Math.floor(drawing.points.length / 2)] || drawing.points[0];
      if (!point) return [];
      const occurrence = drawingOccurrences.get(drawing.id) || 0;
      drawingOccurrences.set(drawing.id, occurrence + 1);
      const radius = 18 + Math.floor(occurrence / 6) * 10;
      const angle = -Math.PI / 4 + occurrence % 6 * Math.PI / 3;
      return [{
        ...row,
        point,
        offset: { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius },
        reference: reviewIssueMarkerLabel(row.issue),
      }];
    });
  }

  function resolveReviewIssue(issue: ValidationIssue, status: ReviewDecisionStatus) {
    if (!reviewerName.trim() || !reviewDecisionNote.trim()) {
      setBranchMessage("Add the reviewer name and a decision note before recording this review");
      return;
    }
    const now = new Date().toISOString();
    const existingDecision = activeReviewDecisions()[issue.id];
    let linkedRecordId: string | undefined;
    if (status === "rfi") {
      const linkedExistingRfi = existingDecision?.status === "rfi" ? rfiItems.find((item) => item.id === existingDecision.linkedRecordId) : undefined;
      const existingRfi = linkedExistingRfi ||
        rfiItems.find((item) => item.systemId === activeSystem && item.drawingId === issue.drawingId && item.subject === issue.title && !["approved", "closed"].includes(item.status));
      if (existingRfi) {
        linkedRecordId = existingRfi.id;
        setRfiItems((current) => current.map((item) => item.id === existingRfi.id ? {
          ...item,
          proposedSolution: reviewDecisionNote.trim(),
          assignedTo: reviewerName.trim(),
          updatedAt: now,
        } : item));
      } else {
        linkedRecordId = crypto.randomUUID();
        const nextNumber = Math.max(0, ...rfiItems.map((item) => item.number)) + 1;
        setRfiItems((current) => [...current, {
          id: linkedRecordId!,
          number: nextNumber,
          systemId: activeSystem,
          drawingId: issue.drawingId,
          subject: issue.title,
          category: issueCategory(issue.title) === "Connections" ? "Coordination" : "Design",
          priority: issue.severity === "critical" ? "critical" : "normal",
          question: issue.detail,
          proposedSolution: reviewDecisionNote.trim(),
          assignedTo: reviewerName.trim(),
          costImpact: "Not evaluated",
          scheduleImpact: "Not evaluated",
          response: "",
          status: "draft",
          createdAt: now,
          updatedAt: now,
        }]);
      }
    }
    if (status === "punch") {
      const linkedExistingPunch = existingDecision?.status === "punch" ? punchItems.find((item) => item.id === existingDecision.linkedRecordId) : undefined;
      const existingPunch = linkedExistingPunch ||
        punchItems.find((item) => item.systemId === activeSystem && item.drawingId === issue.drawingId && item.title === issue.title && item.status === "open");
      if (existingPunch) {
        linkedRecordId = existingPunch.id;
        setPunchItems((current) => current.map((item) => item.id === existingPunch.id ? {
          ...item,
          assignedTo: reviewerName.trim(),
          note: reviewDecisionNote.trim(),
        } : item));
      } else {
        linkedRecordId = crypto.randomUUID();
        setPunchItems((current) => [...current, {
          id: linkedRecordId!,
          systemId: activeSystem,
          drawingId: issue.drawingId,
          title: issue.title,
          category: issueCategory(issue.title) === "Airflow" ? "Airflow" : "Coordination",
          priority: issue.severity === "critical" ? "critical" : "normal",
          assignedTo: reviewerName.trim(),
          note: reviewDecisionNote.trim(),
          status: "open",
          createdAt: now,
        }]);
      }
    }
    const decision: ReviewDecision = {
      issueId: issue.id,
      status,
      reviewer: reviewerName.trim(),
      note: reviewDecisionNote.trim(),
      updatedAt: now,
      linkedRecordId,
    };
    setReviewDecisionsBySystem((current) => ({
      ...current,
      [activeSystem]: { ...(current[activeSystem] || {}), [issue.id]: decision },
    }));
    setBranchMessage(issue.severity === "critical"
      ? `${issue.title} was documented, but remains a release blocker until the drawing condition is fixed`
      : `${issue.title} review decision recorded`);
  }

  function reopenReviewIssue(issueId: string) {
    setReviewDecisionsBySystem((current) => {
      const nextSystem = { ...(current[activeSystem] || {}) };
      delete nextSystem[issueId];
      return { ...current, [activeSystem]: nextSystem };
    });
    setReviewDecisionNote("");
  }

  function exportReviewLogCsv() {
    const rows = activeReviewedIssueRows;
    if (!rows.length) return;
    const quote = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const csv = [
      ["System", "Reference", "Severity", "Category", "Issue", "Detail", "Disposition", "Reviewer", "Decision Note", "Updated", "Plan Link"],
      ...rows.map((row) => [
        systemLabel(activeSystem),
        reviewIssueReference(row.issue),
        row.issue.severity,
        issueCategory(row.issue.title),
        row.issue.title,
        row.issue.detail,
        row.decision?.status || "open",
        row.decision?.reviewer || "",
        row.decision?.note || "",
        row.decision ? new Date(row.decision.updatedAt).toLocaleString() : "",
        row.issue.drawingId ? "Linked" : "System",
      ]),
    ].map((row) => row.map(quote).join(",")).join("\n");
    const link = document.createElement("a");
    const objectUrl = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.href = objectUrl;
    link.download = `${systemLabel(activeSystem).replaceAll(" ", "-").toLowerCase()}-review-log.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  }

  function systemDrawingSignature(systemId = activeSystem) {
    const scopedDrawings = drawings
      .filter((drawing) => drawingSystem(drawing) === systemId)
      .slice()
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((drawing) => ({
        id: drawing.id,
        page: drawing.page,
        type: drawing.type,
        points: drawing.points,
        size: drawing.size,
        lineWeight: normalizedRunLineWeight(drawing.lineWeight),
        cfm: drawing.cfm || 0,
        roomName: drawing.roomName || "",
        roomType: drawing.roomType || "",
        elevation: drawing.elevation || "",
        fitting: drawing.fitting,
        symbol: drawing.symbol,
      }));
    return stableTextHash(JSON.stringify({
      drawings: scopedDrawings,
      roomTargets: Object.entries(roomAirflowTargets[systemId] || {}).sort(([a], [b]) => a.localeCompare(b)),
      pdfFingerprint,
      scaleFeetPerUnit,
      scaleLabel,
      scaleVerified,
      velocityRules: { supplyVelocityLimit, returnVelocityLimit, freshVelocityLimit, residentialFlexMax },
    }));
  }

  function systemReleaseSignature(systemId = activeSystem) {
    const reviewDecisions = Object.values(activeReviewDecisions(systemId))
      .slice()
      .sort((a, b) => a.issueId.localeCompare(b.issueId))
      .map((decision) => ({
        issueId: decision.issueId,
        status: decision.status,
        reviewer: decision.reviewer,
        note: decision.note,
        updatedAt: decision.updatedAt,
      }));
    const rfiState = rfiItems
      .filter((item) => item.systemId === systemId)
      .slice()
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((item) => ({ id: item.id, status: item.status, response: item.response, approvalBy: item.approvalBy || "", approvedAt: item.approvedAt || "", updatedAt: item.updatedAt }));
    const punchState = punchItems
      .filter((item) => item.systemId === systemId)
      .slice()
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((item) => ({ id: item.id, priority: item.priority, status: item.status, resolvedAt: item.resolvedAt || "" }));
    return stableTextHash(JSON.stringify({
      drawingSignature: systemDrawingSignature(systemId),
      checklist: fieldChecklistItems.map((item) => [item.id, Boolean(activeFieldChecklist(systemId)[item.id])]),
      reviewDecisions,
      rfiState,
      punchState,
      cloudReview: cloudProjectRisk?.projectId === workingCloudProjectId ? {
        projectId: cloudProjectRisk.projectId,
        verification: cloudProjectRisk.verification,
        latestRevisionId: cloudProjectRisk.latestRevisionId,
        latestRevisionNumber: cloudProjectRisk.latestRevisionNumber,
        latestReleaseFingerprint: cloudProjectRisk.latestReleaseFingerprint,
        openCriticalWork: cloudProjectRisk.openCriticalWork,
        pendingApprovals: cloudProjectRisk.pendingApprovals,
        changesRequested: cloudProjectRisk.changesRequested,
        approvedApprovals: cloudProjectRisk.approvedApprovals,
        workingRevisionId: workingCloudRevisionId,
        workingRevisionFingerprint: workingCloudRevisionFingerprint,
        currentReleaseFingerprint: currentCloudReleaseFingerprint,
      } : null,
    }));
  }

  function latestSystemRelease(systemId = activeSystem) {
    return releaseRecords
      .filter((record) => record.systemId === systemId)
      .slice()
      .sort((a, b) => b.releasedAt.localeCompare(a.releasedAt))[0];
  }

  function systemBuilderSummary(
    audit = validationDashboard(),
    packageSummary = fieldPackageSummary(),
  ) {
    const scoped = drawings.filter((drawing) => drawingSystem(drawing) === activeSystem);
    const runs = scoped.filter((drawing) => ["supply", "return", "fresh"].includes(drawing.type) && !drawing.fitting);
    const fittings = scoped.filter((drawing) => drawing.fitting);
    const devices = scoped.filter((drawing) =>
      ["diffuser", "returnGrille"].includes(drawing.symbol?.kind || "") ||
      isPrimaryAirflowEquipment(drawing)
    );
    const connectedDevices = devices.filter((drawing) =>
      drawing.symbol?.connectedRunId &&
      drawings.some((candidate) => candidate.id === drawing.symbol?.connectedRunId)
    );
    const totalPorts = fittings.length * 3;
    const healthyPorts = fittings.reduce((total, fitting) => {
      const ports = fittingPortPoints(fitting);
      return total + fitting.fitting!.connectedIds.filter((runId, port) => {
        const run = drawings.find((drawing) => drawing.id === runId);
        if (!run) return false;
        return [run.points[0], run.points[run.points.length - 1]].some((point) =>
          Math.hypot(point.x - ports[port].x, point.y - ports[port].y) < 2
        );
      }).length;
    }, 0);
    const sizing = sizingSuggestions();
    const connectionPercent = devices.length || totalPorts
      ? Math.round((connectedDevices.length + healthyPorts) / Math.max(1, devices.length + totalPorts) * 100)
      : 0;
    const sizingPercent = runs.length ? Math.round((runs.length - sizing.length) / runs.length * 100) : 0;
    const packagePercent = packageSummary.ready
      ? 100
      : Math.max(0, 100 - packageSummary.critical * 25 - packageSummary.connectionProblems * 12 - packageSummary.missingElevation * 4);
    const progress = Math.round((connectionPercent + sizingPercent + audit.score + packagePercent) / 4);
    return {
      runs,
      fittings,
      devices,
      connectedDevices,
      unconnectedDevices: devices.length - connectedDevices.length,
      totalPorts,
      healthyPorts,
      brokenPorts: totalPorts - healthyPorts,
      sizing,
      audit,
      packageSummary,
      connectionPercent,
      sizingPercent,
      packagePercent,
      progress,
    };
  }

  function autoConnectActiveSystemDevices() {
    const next = drawings.map((drawing) => ({
      ...drawing,
      points: drawing.points.map((point) => ({ ...point })),
      symbol: drawing.symbol ? { ...drawing.symbol } : undefined,
    }));
    let connected = 0;
    for (const device of next.filter((drawing) =>
      drawingSystem(drawing) === activeSystem &&
      (["diffuser", "returnGrille"].includes(drawing.symbol?.kind || "") || isPrimaryAirflowEquipment(drawing))
    )) {
      if (isPrimaryAirflowEquipment(device)) {
        for (const ductType of ["supply", "return"] as const) {
          const port = equipmentPlenumPorts(device)[ductType];
          const candidates = next
            .filter((drawing) =>
              drawing.page === device.page &&
              drawingSystem(drawing) === activeSystem &&
              drawing.type === ductType &&
              !drawing.fitting &&
              drawing.points.length > 1
            )
            .flatMap((run) => [
              { run, endpoint: run.points[0], end: "start" as const },
              { run, endpoint: run.points[run.points.length - 1], end: "end" as const },
            ])
            .map((candidate) => ({
              ...candidate,
              distance: Math.hypot(candidate.endpoint.x - port.x, candidate.endpoint.y - port.y),
            }))
            .sort((a, b) => a.distance - b.distance);
          const nearest = candidates[0];
          if (!nearest || nearest.distance > 90 / zoomRef.current) continue;
          const savedRunId = ductType === "supply" ? device.symbol!.connectedRunId : device.symbol!.returnRunId;
          const savedEnd = ductType === "supply" ? device.symbol!.connectedEnd : device.symbol!.returnEnd;
          if (savedRunId === nearest.run.id && savedEnd === nearest.end && nearest.distance < 2) continue;
          const endpointIndex = nearest.end === "start" ? 0 : nearest.run.points.length - 1;
          nearest.run.points = nearest.run.points.map((point, index) => index === endpointIndex ? { ...port } : point);
          device.symbol = ductType === "supply"
            ? { ...device.symbol!, connectedRunId: nearest.run.id, connectedEnd: nearest.end }
            : { ...device.symbol!, returnRunId: nearest.run.id, returnEnd: nearest.end };
          connected += 1;
        }
        continue;
      }
      const desiredType = device.symbol!.kind === "returnGrille" ? "return" : "supply";
      const candidates = next
        .filter((drawing) =>
          drawing.page === device.page &&
          drawingSystem(drawing) === activeSystem &&
          drawing.type === desiredType &&
          !drawing.fitting &&
          drawing.points.length > 1
        )
        .flatMap((run) => [
          { run, endpoint: run.points[0], end: "start" as const },
          { run, endpoint: run.points[run.points.length - 1], end: "end" as const },
        ])
        .map((candidate) => ({
          ...candidate,
          distance: Math.hypot(candidate.endpoint.x - device.points[0].x, candidate.endpoint.y - device.points[0].y),
        }))
        .sort((a, b) => a.distance - b.distance);
      const nearest = candidates[0];
      const maximumDistance = 70 / zoomRef.current;
      if (!nearest || nearest.distance > maximumDistance) continue;
      const alreadyConnected = device.symbol!.connectedRunId === nearest.run.id &&
        device.symbol!.connectedEnd === nearest.end &&
        nearest.distance < 2;
      if (alreadyConnected) continue;
      device.points = [{ ...nearest.endpoint }];
      device.symbol = {
        ...device.symbol!,
        connectedRunId: nearest.run.id,
        connectedEnd: nearest.end,
      };
      connected += 1;
    }
    if (!connected) {
      setBranchMessage("No nearby equipment, supply cans, or return cans need connection");
      return;
    }
    setHistory(next);
    setBranchMessage(`${connected} nearby HVAC device${connected === 1 ? "" : "s"} connected · no duct runs were created or rerouted`);
  }

  function repairActiveSystemNetwork() {
    let next = drawings;
    for (const fitting of drawings.filter((drawing) => drawing.fitting && drawingSystem(drawing) === activeSystem)) {
      next = reattachFittingIn(next, fitting.id).drawings;
    }
    if (JSON.stringify(next) === JSON.stringify(drawings)) {
      setBranchMessage("All connected T/Y ports are already aligned");
      return;
    }
    setHistory(next);
    setBranchMessage(`${systemLabel(activeSystem)} repaired · existing runs snapped back to their saved fitting ports`);
  }

  function openSystemSizingWorkflow() {
    openSizingReview();
    setRightTab("checks");
    setValidationFilter("all");
  }

  function openSystemAuditWorkflow() {
    setRightTab("checks");
    setReviewView("overview");
    setValidationFilter("all");
    selectNextValidationIssue();
  }

  function filteredValidationIssues() {
    return validationFilter === "all"
      ? activeValidationIssues
      : activeValidationIssues.filter((issue) => issue.severity === validationFilter);
  }

  function selectNextValidationIssue() {
    const selectable = activeReviewedIssueRows.filter((row) => !row.resolvedByDecision && row.issue.drawingId).map((row) => row.issue);
    if (!selectable.length) return;
    const index = validationCursor % selectable.length;
    focusReviewIssue(selectable[index]);
    setValidationCursor((index + 1) % selectable.length);
  }

  function buildTakeoff() {
    const ductTotals = new Map<string, { type: string; size: string; length: number }>();
    for (const drawing of drawings) {
      if (drawingSystem(drawing) !== activeSystem || !["supply", "return", "fresh"].includes(drawing.type) || drawing.fitting || drawing.symbol) continue;
      const key = `${drawing.type}-${drawing.size}`;
      const current = ductTotals.get(key) || { type: drawing.type, size: drawing.size, length: 0 };
      current.length += drawingLengthFeet(drawing);
      ductTotals.set(key, current);
    }
    const rows: Array<{ category: string; item: string; size: string; quantity: string; note: string }> = [];
    for (const total of [...ductTotals.values()].sort((a, b) => Number(b.size) - Number(a.size))) {
      const name = total.type === "supply" ? "Supply flex duct" : total.type === "return" ? "Return flex duct" : "Fresh-air duct";
      const orderLength = total.length * (1 + materialWastePercent / 100);
      const rolls = Math.max(1, Math.ceil(orderLength / 25));
      rows.push({
        category: "Duct",
        item: name,
        size: `${total.size}"`,
        quantity: `${total.length.toFixed(1)} LF`,
        note: `${rolls} × 25-ft ${rolls === 1 ? "box" : "boxes"} · includes ${materialWastePercent}% allowance`,
      });
    }
    const activeSymbols = drawings.filter((drawing) => drawingSystem(drawing) === activeSystem && drawing.symbol);
    const groupedSymbols = new Map<string, { kind: SymbolKind; label: string; size: string; neckSize: string; variant: string; count: number }>();
    activeSymbols.forEach((drawing) => {
      const kind = drawing.symbol!.kind;
      if (["airflow", "note"].includes(kind)) return;
      const neckSize = drawing.symbol?.neckSize || (kind === "returnGrille" ? "12" : "8");
      const key = `${kind}-${drawing.size}-${neckSize}-${drawing.symbol?.variant || "standard"}-${drawing.symbol?.label || kind}`;
      const current = groupedSymbols.get(key) || {
        kind,
        label: drawing.symbol?.label || kind,
        size: drawing.size || "Per plan",
        neckSize,
        variant: drawing.symbol?.variant || "standard",
        count: 0,
      };
      current.count += 1;
      groupedSymbols.set(key, current);
    });
    [...groupedSymbols.values()].sort((a, b) => a.kind.localeCompare(b.kind) || a.size.localeCompare(b.size)).forEach((group) => {
      const category = ["diffuser", "returnGrille"].includes(group.kind) ? "Air devices" : group.kind === "equipment" ? "Equipment" : "Accessories";
      rows.push({ category, item: group.label, size: group.size, quantity: `${group.count} EA`, note: `${group.variant.replaceAll("-", " ")} style · field label governs` });
      if (group.kind === "diffuser") rows.push({ category: "Air devices", item: "Supply can / plenum box", size: `Ø${group.neckSize}" neck`, quantity: `${group.count} EA`, note: `${group.size} face · match ${group.label.toLowerCase()}` });
      if (group.kind === "returnGrille") rows.push({ category: "Air devices", item: "Return can / box", size: `Ø${group.neckSize}" neck`, quantity: `${group.count} EA`, note: `${group.size} face · match ${group.label.toLowerCase()}` });
    });
    const fittingGroups = new Map<string, number>();
    drawings.filter((drawing) => drawingSystem(drawing) === activeSystem && drawing.fitting).forEach((drawing) => {
      const fitting = drawing.fitting!;
      const size = `${fitting.upstreamSize}×${fitting.downstreamSize}×${fitting.branchSize}`;
      const key = `${fitting.style === "tee90" ? "Tee" : "Wye"} ${size}`;
      fittingGroups.set(key, (fittingGroups.get(key) || 0) + 1);
    });
    fittingGroups.forEach((count, key) => {
      const [item, size] = key.split(" ");
      rows.push({ category: "Fittings", item: `${item} branch fitting`, size, quantity: `${count} EA`, note: "Verify orientation before shop release" });
    });
    if (ductTotals.size) rows.push({ category: "Installation", item: "Hangers, strap, sealant, mastic & fasteners", size: "—", quantity: "1 LOT", note: "Field verify structure and support spacing" });
    return rows;
  }

  function materialSummary() {
    const rows = buildTakeoff();
    const flexBoxes = rows.filter((row) => row.item.includes("flex duct")).reduce((total, row) => total + (Number(row.note.match(/^(\d+)/)?.[1]) || 0), 0);
    const deviceCount = rows.filter((row) => row.category === "Air devices" && !row.item.includes("can") && !row.item.includes("box")).reduce((total, row) => total + (Number(row.quantity.match(/^(\d+)/)?.[1]) || 0), 0);
    const fittingCount = rows.filter((row) => row.category === "Fittings").reduce((total, row) => total + (Number(row.quantity.match(/^(\d+)/)?.[1]) || 0), 0);
    const holds = activeValidationIssues.filter((issue) => issue.severity !== "info" && ["Coordination", "Connections"].includes(issueCategory(issue.title)));
    return { flexBoxes, deviceCount, fittingCount, holds };
  }

  function exportPurchaseSheetCsv() {
    const rows = buildTakeoff();
    if (!rows.length) return;
    const quote = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const csv = [
      ["System", "Category", "Item", "Size", "Order Quantity", "Purchasing / Fabrication Note"],
      ...rows.map((row) => [systemLabel(activeSystem), row.category, row.item, row.size, row.quantity, row.note]),
    ].map((row) => row.map(quote).join(",")).join("\n");
    const link = document.createElement("a");
    const objectUrl = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.href = objectUrl;
    link.download = `${systemLabel(activeSystem).replaceAll(" ", "-").toLowerCase()}-purchase-sheet.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  }

  function buildFieldConnectionModel(systemId: string) {
    const runs = drawings.filter((drawing) =>
      drawingSystem(drawing) === systemId &&
      ["supply", "return", "fresh"].includes(drawing.type) &&
      !drawing.fitting &&
      !drawing.symbol
    );
    const runById = new Map(runs.map((run) => [run.id, run]));
    const adjacency = new Map(runs.map((run) => [run.id, new Set<string>()]));
    const fittingProblems = new Set<string>();
    const fittings = drawings.filter((drawing) => drawingSystem(drawing) === systemId && drawing.fitting);

    fittings.forEach((fitting) => {
      const ports = fittingPortPoints(fitting);
      const validRunIds = fitting.fitting!.connectedIds.map((runId, port) => {
        const run = runById.get(runId);
        if (!run || run.page !== fitting.page || run.type !== "supply") return "";
        const endpoints = [run.points[0], run.points[run.points.length - 1]];
        return endpoints.some((point) => Math.hypot(point.x - ports[port].x, point.y - ports[port].y) < 2) ? run.id : "";
      });
      const valid = validRunIds.filter(Boolean);
      if (valid.length !== 3) valid.forEach((runId) => fittingProblems.add(runId));
      valid.forEach((runId) => {
        valid.forEach((otherId) => {
          if (otherId !== runId) adjacency.get(runId)?.add(otherId);
        });
      });
    });

    const validEquipmentLinks = new Set<string>();
    const validSupplyTerminalLinks = new Set<string>();
    const validReturnTerminalLinks = new Set<string>();
    drawings.filter((drawing) => drawingSystem(drawing) === systemId && drawing.symbol?.connectedRunId).forEach((symbol) => {
      const run = runById.get(symbol.symbol!.connectedRunId!);
      if (!run || run.page !== symbol.page) return;
      const expectedType = isPrimaryAirflowEquipment(symbol) || symbol.symbol?.kind === "diffuser"
        ? "supply"
        : symbol.symbol?.kind === "returnGrille"
          ? "return"
          : "";
      if (!expectedType || run.type !== expectedType) return;
      const point = symbol.points[0];
      const physicallyAttached = [run.points[0], run.points[run.points.length - 1]].some((endpoint) =>
        Math.hypot(endpoint.x - point.x, endpoint.y - point.y) < 2
      );
      if (!physicallyAttached) return;
      if (isPrimaryAirflowEquipment(symbol)) validEquipmentLinks.add(run.id);
      if (symbol.symbol?.kind === "diffuser") validSupplyTerminalLinks.add(run.id);
      if (symbol.symbol?.kind === "returnGrille") validReturnTerminalLinks.add(run.id);
    });

    const result = new Map<string, { connected: boolean; detail: string }>();
    const visited = new Set<string>();
    runs.forEach((seed) => {
      if (visited.has(seed.id)) return;
      const component = new Set<string>();
      const queue = [seed.id];
      while (queue.length) {
        const runId = queue.shift()!;
        if (component.has(runId)) continue;
        component.add(runId);
        visited.add(runId);
        adjacency.get(runId)?.forEach((nextId) => queue.push(nextId));
      }
      const componentRuns = [...component].map((runId) => runById.get(runId)!).filter(Boolean);
      const hasFittingProblem = [...component].some((runId) => fittingProblems.has(runId));
      const hasSource = [...component].some((runId) => validEquipmentLinks.has(runId));
      const hasSupplyTerminal = [...component].some((runId) => validSupplyTerminalLinks.has(runId));
      const hasReturnTerminal = [...component].some((runId) => validReturnTerminalLinks.has(runId));
      const freshControls = drawings.filter((drawing) =>
        drawingSystem(drawing) === systemId &&
        drawing.symbol?.kind === "motorDamper" &&
        componentRuns.some((run) => run.page === drawing.page && pointToDrawingDistance(drawing.points[0], run) <= 12)
      ).length;
      componentRuns.forEach((run) => {
        const connected = !hasFittingProblem && (
          run.type === "supply"
            ? hasSource && hasSupplyTerminal
            : run.type === "return"
              ? hasReturnTerminal
              : freshControls > 0
        );
        const detail = hasFittingProblem
          ? "Open or detached T/Y port"
          : run.type === "supply" && !hasSource
            ? "No equipment source"
            : run.type === "supply" && !hasSupplyTerminal
              ? "No connected supply terminal"
              : run.type === "return" && !hasReturnTerminal
                ? "No connected return grille"
                : run.type === "fresh" && !freshControls
                  ? "No motorized OA damper on run"
                  : "Verified";
        result.set(run.id, { connected, detail });
      });
    });
    return result;
  }

  function fieldRunSchedule(connectionModel = buildFieldConnectionModel(activeSystem)) {
    return drawings
      .filter((drawing) => drawingSystem(drawing) === activeSystem && ["supply", "return", "fresh"].includes(drawing.type) && !drawing.fitting && !drawing.symbol)
      .map((drawing) => {
        const connection = connectionModel.get(drawing.id) || { connected: false, detail: "No verified path" };
        return {
          drawing,
          type: drawing.type === "supply" ? "Supply" : drawing.type === "return" ? "Return" : "Fresh air",
          size: `${drawing.size}"`,
          length: drawingLengthFeet(drawing),
          cfm: runAirflow(drawing),
          room: drawing.roomName?.trim() || "Room not assigned",
          elevation: drawing.elevation?.trim() || "EL VERIFY",
          connected: connection.connected,
          connectionDetail: connection.detail,
        };
      })
      .sort((a, b) => a.type.localeCompare(b.type) || Number(b.drawing.size) - Number(a.drawing.size));
  }

  function fieldPackageSummary(
    review = reviewSummary(),
    connectionModel = buildFieldConnectionModel(activeSystem),
  ) {
    const runs = fieldRunSchedule(connectionModel);
    const checklist = activeFieldChecklist();
    const checklistComplete = fieldChecklistItems.filter((item) => checklist[item.id]).length;
    const critical = review.critical;
    const missingElevation = runs.filter((run) => run.elevation === "EL VERIFY").length;
    const missingRoom = drawings.filter((drawing) =>
      drawingSystem(drawing) === activeSystem &&
      ["diffuser", "returnGrille"].includes(drawing.symbol?.kind || "") &&
      !drawing.roomName?.trim()
    ).length;
    const connectionProblems = runs.filter((run) => !run.connected).length;
    const openRfis = activeRfiItems().filter((item) => !["approved", "closed"].includes(item.status)).length;
    const openPunches = activePunchItems().filter((item) => item.status === "open").length;
    const criticalPunches = activePunchItems().filter((item) => item.status === "open" && item.priority === "critical").length;
    const activeCloudRisk = cloudProjectRisk?.projectId === workingCloudProjectId ? cloudProjectRisk : null;
    const cloudReviewHolds = activeCloudRisk
      ? activeCloudRisk.openCriticalWork + activeCloudRisk.pendingApprovals + activeCloudRisk.changesRequested
      : 0;
    const cloudRevisionCurrent = Boolean(
      activeCloudRisk?.verification === "verified" &&
      activeCloudRisk.latestRevisionId &&
      activeCloudRisk.latestRevisionId === workingCloudRevisionId &&
      activeCloudRisk.latestReleaseFingerprint &&
      activeCloudRisk.latestReleaseFingerprint === workingCloudRevisionFingerprint &&
      workingCloudRevisionFingerprint === currentCloudReleaseFingerprint,
    );
    let cloudGateDetail = "Cloud status not verified";
    if (activeCloudRisk?.verification === "verified") {
      if (!activeCloudRisk.latestRevisionId) cloudGateDetail = "Save a named cloud revision";
      else if (activeCloudRisk.latestRevisionId !== workingCloudRevisionId) cloudGateDetail = `Open latest revision R${activeCloudRisk.latestRevisionNumber}`;
      else if (!cloudRevisionCurrent) cloudGateDetail = "Working drawing changed · save a new revision";
      else if (activeCloudRisk.approvedApprovals < 1) cloudGateDetail = `Revision R${activeCloudRisk.latestRevisionNumber} needs approval`;
      else if (cloudReviewHolds) cloudGateDetail = `${activeCloudRisk.openCriticalWork} critical · ${activeCloudRisk.pendingApprovals} pending · ${activeCloudRisk.changesRequested} changes requested`;
      else cloudGateDetail = `Revision R${activeCloudRisk.latestRevisionNumber} approved`;
    }
    const gates = [
      { id: "runs", label: "Duct runs drawn", clear: Boolean(runs.length), detail: runs.length ? `${runs.length} runs` : "No duct runs" },
      { id: "critical", label: "Critical review issues fixed", clear: critical === 0, detail: critical ? `${critical} critical` : "Clear" },
      { id: "warning", label: "Warnings reviewed", clear: review.openWarnings === 0, detail: review.openWarnings ? `${review.openWarnings} open` : review.acceptedWarnings ? `${review.acceptedWarnings} accepted` : "Clear" },
      { id: "connections", label: "Saved connections verified", clear: connectionProblems === 0, detail: connectionProblems ? `${connectionProblems} review` : "Clear" },
      { id: "elevations", label: "Elevations coordinated", clear: missingElevation === 0, detail: missingElevation ? `${missingElevation} missing` : "Clear" },
      { id: "rooms", label: "Terminal rooms assigned", clear: missingRoom === 0, detail: missingRoom ? `${missingRoom} missing` : "Clear" },
      { id: "scale", label: "Drawing scale verified", clear: scaleVerified, detail: scaleVerified ? scaleLabel : "Select a scale or calibrate" },
      { id: "checklist", label: "Field checklist complete", clear: checklistComplete === fieldChecklistItems.length, detail: `${checklistComplete}/${fieldChecklistItems.length}` },
      { id: "rfi", label: "RFIs approved or closed", clear: openRfis === 0, detail: openRfis ? `${openRfis} open` : "Clear" },
      { id: "punch", label: "Critical punch items closed", clear: criticalPunches === 0, detail: criticalPunches ? `${criticalPunches} critical` : "Clear" },
      ...(workingCloudProjectId ? [{
        id: "cloud",
        label: "Latest cloud revision approved and current",
        clear: cloudRevisionCurrent && cloudReviewHolds === 0 && (activeCloudRisk?.approvedApprovals || 0) > 0,
        detail: cloudGateDetail,
      }] : []),
    ];
    const gatesClear = gates.every((gate) => gate.clear);
    const latestRelease = latestSystemRelease();
    const signature = systemDrawingSignature();
    const releaseSignature = systemReleaseSignature();
    const signatureMatches = Boolean(latestRelease &&
      latestRelease.drawingSignature === signature &&
      latestRelease.releaseSignature === releaseSignature);
    const released = Boolean(signatureMatches && gatesClear);
    const stale = Boolean(latestRelease && (!signatureMatches || !gatesClear));
    const status = stale ? "STALE" : released ? "RELEASED" : gatesClear ? "READY FOR APPROVAL" : "HOLD";
    return {
      runs,
      checklistComplete,
      critical,
      openWarnings: review.openWarnings,
      acceptedWarnings: review.acceptedWarnings,
      missingElevation,
      missingRoom,
      connectionProblems,
      openRfis,
      openPunches,
      criticalPunches,
      gates,
      gatesClear,
      ready: gatesClear,
      released,
      stale,
      status,
      latestRelease,
      signature,
      releaseSignature,
    };
  }

  async function issueSystemRelease() {
    let verifiedCloudRisk: CloudProjectRisk | null = null;
    if (workingCloudProjectId) {
      const previousRisk = cloudProjectRisk?.projectId === workingCloudProjectId ? cloudProjectRisk : null;
      const verifiedRisk = await refreshWorkingCloudRisk();
      verifiedCloudRisk = verifiedRisk;
      if (!verifiedRisk || verifiedRisk.verification !== "verified") {
        setBranchMessage("Field release is blocked until cloud work and reviews can be verified");
        return;
      }
      const riskChanged = !previousRisk ||
        previousRisk.latestRevisionId !== verifiedRisk.latestRevisionId ||
        previousRisk.openCriticalWork !== verifiedRisk.openCriticalWork ||
        previousRisk.pendingApprovals !== verifiedRisk.pendingApprovals ||
        previousRisk.changesRequested !== verifiedRisk.changesRequested ||
        previousRisk.approvedApprovals !== verifiedRisk.approvedApprovals ||
        previousRisk.latestReleaseFingerprint !== verifiedRisk.latestReleaseFingerprint ||
        previousRisk.verification !== verifiedRisk.verification;
      if (riskChanged) {
        setBranchMessage("Cloud review status refreshed. Review the updated release gate, then issue again");
        return;
      }
      if (verifiedRisk.openCriticalWork + verifiedRisk.pendingApprovals + verifiedRisk.changesRequested > 0) {
        setBranchMessage("Field release is blocked by cloud reviews or critical project work");
        setShowCloudProjects(true);
        return;
      }
      if (!verifiedRisk.latestRevisionId || verifiedRisk.latestRevisionId !== workingCloudRevisionId) {
        setBranchMessage("Open the latest cloud revision before issuing it for field use");
        setShowCloudProjects(true);
        return;
      }
      if (!verifiedRisk.latestReleaseFingerprint ||
        verifiedRisk.latestReleaseFingerprint !== workingCloudRevisionFingerprint ||
        workingCloudRevisionFingerprint !== currentCloudReleaseFingerprint) {
        setBranchMessage("The working drawing changed. Save and approve a new named revision before field release");
        setShowCloudProjects(true);
        return;
      }
      if (verifiedRisk.approvedApprovals < 1) {
        setBranchMessage(`Cloud revision R${verifiedRisk.latestRevisionNumber} needs an approval before field release`);
        setShowCloudProjects(true);
        return;
      }
    }
    const summary = activeFieldPackage;
    if (!summary.gatesClear) {
      setBranchMessage("Release is blocked. Clear every release gate first");
      return;
    }
    if (!releaseRevision.trim() || !releaseBy.trim()) {
      setBranchMessage("Add the revision and released-by name before issuing");
      return;
    }
    if (summary.released && summary.latestRelease?.revision.toLowerCase() === releaseRevision.trim().toLowerCase()) {
      setBranchMessage(`Revision ${summary.latestRelease.revision} is already the current field release`);
      return;
    }
    const draftRecord: SystemReleaseRecord = {
      id: crypto.randomUUID(),
      systemId: activeSystem,
      revision: releaseRevision.trim(),
      releasedBy: releaseBy.trim(),
      releasedAt: new Date().toISOString(),
      note: releaseNote.trim(),
      drawingSignature: summary.signature,
      releaseSignature: summary.releaseSignature,
      checklistComplete: summary.checklistComplete,
      acceptedIssueCount: summary.acceptedWarnings,
      runCount: summary.runs.length,
      designCfm: designAirflow().targetCfm,
      pdfFingerprint,
      gateSnapshot: summary.gates.map((gate) => ({ ...gate })),
      checklistSnapshot: fieldChecklistItems.map((item) => ({ ...item, checked: Boolean(activeFieldChecklist()[item.id]) })),
      issueSnapshot: activeReviewedIssueRows.map((row) => ({
        id: row.issue.id,
        severity: row.issue.severity,
        title: row.issue.title,
        detail: row.issue.detail,
        disposition: row.decision?.status || "open",
        reviewer: row.decision?.reviewer || "",
        note: row.decision?.note || "",
      })),
      rulesSnapshot: { scaleLabel, scaleFeetPerUnit, supplyVelocityLimit, returnVelocityLimit, freshVelocityLimit, residentialFlexMax },
    };
    let record = draftRecord;
    if (workingCloudProjectId && verifiedCloudRisk?.latestRevisionId) {
      try {
        const cloudRelease = await issueCloudFieldRelease({
          projectId: workingCloudProjectId,
          revisionId: verifiedCloudRisk.latestRevisionId,
          releaseFingerprint: currentCloudReleaseFingerprint,
          systemId: activeSystem,
          releaseRevision: draftRecord.revision,
          releasedByName: draftRecord.releasedBy,
          drawingSignature: draftRecord.drawingSignature,
          releaseSignature: draftRecord.releaseSignature,
          releasePayload: draftRecord as unknown as Record<string, unknown>,
        });
        record = { ...draftRecord, id: cloudRelease.id, releasedAt: cloudRelease.created_at };
      } catch (cloudError) {
        setBranchMessage(cloudError instanceof Error
          ? cloudError.message
          : "The cloud release check changed. Review the project and try again.");
        void refreshWorkingCloudRisk();
        return;
      }
    }
    setReleaseRecords((current) => [...current, record]);
    setBranchMessage(`${systemLabel(activeSystem)} revision ${record.revision} released for field use`);
    setReleaseNote("");
  }

  function exportReleaseManifestCsv() {
    const summary = activeFieldPackage;
    const releases = releaseRecords.filter((record) => record.systemId === activeSystem).sort((a, b) => b.releasedAt.localeCompare(a.releasedAt));
    const quote = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const csv = [
      ["HVAC FIELD RELEASE MANIFEST"],
      ["System", systemLabel(activeSystem)],
      ["Current status", summary.status],
      ["Drawing signature", summary.signature],
      ["Generated", new Date().toLocaleString()],
      [],
      ["Release Gate", "Status", "Detail"],
      ...summary.gates.map((gate) => [gate.label, gate.clear ? "CLEAR" : "HOLD", gate.detail]),
      [],
      ["Revision", "Released By", "Released At", "Current Drawing", "Runs", "Design CFM", "Accepted Warnings", "Note"],
      ...releases.map((record) => [
        record.revision,
        record.releasedBy,
        new Date(record.releasedAt).toLocaleString(),
        record.id === summary.latestRelease?.id && record.drawingSignature === summary.signature && record.releaseSignature === summary.releaseSignature ? "CURRENT" : "SUPERSEDED",
        record.runCount,
        record.designCfm,
        record.acceptedIssueCount,
        record.note,
      ]),
    ].map((row) => row.map(quote).join(",")).join("\n");
    const link = document.createElement("a");
    const objectUrl = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.href = objectUrl;
    link.download = `${systemLabel(activeSystem).replaceAll(" ", "-").toLowerCase()}-field-release-manifest.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  }

  function exportFieldRunScheduleCsv() {
    const rows = activeFieldPackage.runs;
    if (!rows.length) return;
    const quote = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const csv = [
      ["System", "Duct Type", "Size", "Length LF", "Calculated CFM", "Room / Area", "Elevation", "Connection Review"],
      ...rows.map((run) => [
        systemLabel(activeSystem),
        run.type,
        run.size,
        run.length.toFixed(1),
        run.cfm,
        run.room,
        run.elevation,
        run.connected ? "CONNECTED" : "REVIEW",
      ]),
    ].map((row) => row.map(quote).join(",")).join("\n");
    const link = document.createElement("a");
    const objectUrl = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.href = objectUrl;
    link.download = `${systemLabel(activeSystem).replaceAll(" ", "-").toLowerCase()}-field-run-schedule.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  }

  function commissioningRecord(systemId = activeSystem) {
    const record = commissioningBySystem[systemId];
    return {
      ...emptyCommissioningRecord,
      ...record,
      checklist: { ...(record?.checklist || {}) },
    };
  }

  function activeCommissioningRecord() {
    return commissioningRecord();
  }

  function updateCommissioningField(field: keyof Omit<CommissioningRecord, "checklist">, value: string) {
    setCommissioningBySystem((current) => ({
      ...current,
      [activeSystem]: { ...emptyCommissioningRecord, ...current[activeSystem], [field]: value },
    }));
  }

  function updateCommissioningCheck(id: string, checked: boolean) {
    setCommissioningBySystem((current) => {
      const record = { ...emptyCommissioningRecord, ...current[activeSystem] };
      return { ...current, [activeSystem]: { ...record, checklist: { ...record.checklist, [id]: checked } } };
    });
  }

  function commissioningSummary() {
    const record = activeCommissioningRecord();
    const totalStatic = Math.abs(Number(record.supplyStatic) || 0) + Math.abs(Number(record.returnStatic) || 0);
    const ratedMax = Number(record.ratedMaxStatic) || 0;
    const measuredCfm = Number(record.measuredCfm) || 0;
    const designCfm = designAirflow().targetCfm;
    const airflowPercent = designCfm ? Math.round(measuredCfm / designCfm * 100) : 0;
    const checklistComplete = commissioningChecklistItems.filter((item) => record.checklist[item.id]).length;
    const identityComplete = Boolean(record.model.trim() && record.serial.trim() && record.filterSize.trim() && record.technician.trim() && record.date);
    const readingsComplete = measuredCfm > 0 &&
      record.supplyStatic !== "" &&
      record.returnStatic !== "" &&
      ratedMax > 0 &&
      record.temperatureSplit !== "";
    const ready = checklistComplete === commissioningChecklistItems.length && identityComplete && readingsComplete && totalStatic <= ratedMax;
    return { record, totalStatic, ratedMax, measuredCfm, designCfm, airflowPercent, checklistComplete, identityComplete, readingsComplete, ready };
  }

  function systemCommandStatus(systemId: string) {
    const stats = systemStats(systemId);
    const scoped = drawings.filter((drawing) => drawingSystem(drawing) === systemId);
    const runs = scoped.filter((drawing) => ["supply", "return", "fresh"].includes(drawing.type) && !drawing.fitting && !drawing.symbol);
    const supplyTerminals = scoped.filter((drawing) => drawing.symbol?.kind === "diffuser").length;
    const connectionModel = buildFieldConnectionModel(systemId);
    const disconnectedRuns = runs.filter((drawing) => !connectionModel.get(drawing.id)?.connected).length;
    const missingElevations = runs.filter((drawing) => !drawing.elevation?.trim()).length;
    const missingRooms = scoped.filter((drawing) => ["diffuser", "returnGrille"].includes(drawing.symbol?.kind || "") && !drawing.roomName?.trim()).length;
    const releaseChecklist = activeFieldChecklist(systemId);
    const releaseChecklistComplete = fieldChecklistItems.filter((item) => releaseChecklist[item.id]).length;
    const record = commissioningRecord(systemId);
    const checklistComplete = commissioningChecklistItems.filter((item) => record.checklist[item.id]).length;
    const totalStatic = Math.abs(Number(record.supplyStatic) || 0) + Math.abs(Number(record.returnStatic) || 0);
    const ratedMax = Number(record.ratedMaxStatic) || 0;
    const measuredCfm = Number(record.measuredCfm) || 0;
    const identityComplete = Boolean(record.model.trim() && record.serial.trim() && record.filterSize.trim() && record.technician.trim() && record.date);
    const readingsComplete = measuredCfm > 0 &&
      record.supplyStatic !== "" &&
      record.returnStatic !== "" &&
      ratedMax > 0 &&
      record.temperatureSplit !== "";
    const commissioned = checklistComplete === commissioningChecklistItems.length && identityComplete && readingsComplete && totalStatic <= ratedMax;
    const openPunches = punchItems.filter((item) => item.systemId === systemId && item.status === "open");
    const openRfis = rfiItems.filter((item) => item.systemId === systemId && !["approved", "closed"].includes(item.status));
    const criticalPunches = openPunches.filter((item) => item.priority === "critical").length;
    const designReady = stats.units > 0 && supplyTerminals > 0 && stats.balanced && disconnectedRuns === 0;
    const activePackage = systemId === activeSystem ? activeFieldPackage : null;
    const releaseGatesClear = activePackage
      ? activePackage.gatesClear
      : designReady &&
        runs.length > 0 &&
        missingElevations === 0 &&
        missingRooms === 0 &&
        scaleVerified &&
        releaseChecklistComplete === fieldChecklistItems.length &&
        openRfis.length === 0 &&
        criticalPunches === 0;
    const latestRelease = latestSystemRelease(systemId);
    const releaseStale = Boolean(latestRelease && (
      latestRelease.drawingSignature !== systemDrawingSignature(systemId) ||
      latestRelease.releaseSignature !== systemReleaseSignature(systemId) ||
      !releaseGatesClear
    ));
    const fieldReady = Boolean(releaseGatesClear && latestRelease && !releaseStale);
    const closeoutReady = fieldReady && commissioned && openPunches.length === 0 && openRfis.length === 0;
    const blockers: string[] = [];
    if (!stats.units) blockers.push("equipment");
    if (!supplyTerminals) blockers.push("supply outlets");
    if (stats.units && supplyTerminals && !stats.balanced) blockers.push("airflow balance");
    if (disconnectedRuns) blockers.push(`${disconnectedRuns} connection${disconnectedRuns === 1 ? "" : "s"}`);
    if (missingElevations) blockers.push(`${missingElevations} elevation${missingElevations === 1 ? "" : "s"}`);
    if (missingRooms) blockers.push(`${missingRooms} room assignment${missingRooms === 1 ? "" : "s"}`);
    if (releaseChecklistComplete !== fieldChecklistItems.length) blockers.push(`field checklist ${releaseChecklistComplete}/${fieldChecklistItems.length}`);
    if (releaseStale) blockers.push("stale field release");
    else if (releaseGatesClear && !latestRelease) blockers.push("field approval");
    if (!commissioned) blockers.push("commissioning");
    if (openPunches.length) blockers.push(`${openPunches.length} punch item${openPunches.length === 1 ? "" : "s"}`);
    if (openRfis.length) blockers.push(`${openRfis.length} open RFI${openRfis.length === 1 ? "" : "s"}`);
    const completedStages = Number(designReady) + Number(releaseGatesClear) + Number(fieldReady) + Number(commissioned) + Number(closeoutReady);
    return {
      systemId,
      stats,
      runs: runs.length,
      supplyTerminals,
      disconnectedRuns,
      missingElevations,
      missingRooms,
      releaseChecklistComplete,
      releaseGatesClear,
      releaseStale,
      commissioned,
      openPunches: openPunches.length,
      criticalPunches,
      openRfis: openRfis.length,
      designReady,
      fieldReady,
      closeoutReady,
      blockers,
      progress: Math.round(completedStages / 5 * 100),
    };
  }

  function projectCommandRows() {
    return systems
      .map((system) => ({ ...system, ...systemCommandStatus(system.id) }))
      .filter((system) => system.stats.objects > 0);
  }

  function projectCommandSummary() {
    const rows = projectCommandRows();
    const designReady = rows.filter((row) => row.designReady).length;
    const fieldReady = rows.filter((row) => row.fieldReady).length;
    const commissioned = rows.filter((row) => row.commissioned).length;
    const closeoutReady = rows.filter((row) => row.closeoutReady).length;
    const openPunches = rows.reduce((total, row) => total + row.openPunches, 0);
    const openRfis = rows.reduce((total, row) => total + row.openRfis, 0);
    const progress = rows.length ? Math.round(rows.reduce((total, row) => total + row.progress, 0) / rows.length) : 0;
    return { rows, designReady, fieldReady, commissioned, closeoutReady, openPunches, openRfis, progress };
  }

  function openSystemFromCommandCenter(systemId: string) {
    setActiveSystem(systemId);
    setSelectedId(null);
    setSelectedIds([]);
    setRightTab("field");
  }

  function continueSystemWorkflow(stage: WorkflowStageId) {
    setRightPanelOpen(true);
    if (stage === "runs") {
      setRightTab("builder");
      setActiveTool("supply");
      setBranchMessage("Continue drawing supply, return, or fresh-air runs. Left-click draws; right-click pans");
      return;
    }
    if (stage === "branches") {
      setRightTab("builder");
      setActiveTool("branch");
      setBranchMessage("T/Y placement ready · split finished runs, then attach Port 3 to an existing branch run");
      return;
    }
    if (stage === "connections") {
      setRightTab("builder");
      setActiveTool("select");
      setBranchMessage("Review open devices and saved T/Y ports below. Nothing reconnects until you press its action");
      return;
    }
    if (stage === "airflow") {
      openSystemBalanceWorkspace("system");
      return;
    }
    if (stage === "review") {
      openSystemAuditWorkflow();
      return;
    }
    setFieldView("release");
    setRightTab("field");
  }

  function openReleaseGate(gateId: string) {
    if (gateId === "cloud") {
      setShowCloudProjects(true);
      return;
    }
    if (["critical", "warning", "connections", "rooms"].includes(gateId)) {
      setReviewQueueFilter("open");
      setReviewView("issues");
      setRightTab("checks");
      return;
    }
    if (gateId === "runs" || gateId === "elevations") {
      setFieldView("installer");
      setRightTab("field");
      return;
    }
    if (gateId === "rfi" || gateId === "punch") {
      setFieldView("coordination");
      setRightTab("field");
      return;
    }
    if (gateId === "scale") {
      setRightPanelOpen(false);
      setBranchMessage("Choose a drawing scale in the canvas toolbar or calibrate from a known distance");
      return;
    }
    setFieldView("release");
    setRightTab("field");
  }

  function exportProjectStatusCsv() {
    const rows = projectCommandRows();
    if (!rows.length) return;
    const quote = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const csv = [
      ["System", "Objects", "Design CFM", "Supply CFM", "Return CFM", "Design", "Field Release", "Commissioning", "Open RFI", "Open Punch", "Critical Punch", "Closeout", "Blocking Items"],
      ...rows.map((row) => [
        systemLabel(row.systemId),
        row.stats.objects,
        row.stats.designCfm,
        row.stats.supplyCfm,
        row.stats.returnCfm,
        row.designReady ? "READY" : "HOLD",
        row.fieldReady ? "READY" : "HOLD",
        row.commissioned ? "COMPLETE" : "OPEN",
        row.openRfis,
        row.openPunches,
        row.criticalPunches,
        row.closeoutReady ? "READY" : "HOLD",
        row.blockers.join("; ") || "None",
      ]),
    ].map((row) => row.map(quote).join(",")).join("\n");
    const link = document.createElement("a");
    const objectUrl = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.href = objectUrl;
    link.download = "hvac-project-command-center.csv";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  }

  function exportCommissioningCsv() {
    const summary = commissioningSummary();
    const record = summary.record;
    const quote = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const rows = [
      ["System", systemLabel(activeSystem)],
      ["Equipment model", record.model],
      ["Serial", record.serial],
      ["Filter size", record.filterSize],
      ["Measured airflow CFM", record.measuredCfm],
      ["Design airflow CFM", summary.designCfm],
      ["Supply static in. w.g.", record.supplyStatic],
      ["Return static in. w.g.", record.returnStatic],
      ["Total external static in. w.g.", summary.totalStatic.toFixed(2)],
      ["Rated maximum static in. w.g.", record.ratedMaxStatic],
      ["Temperature split °F", record.temperatureSplit],
      ["Technician", record.technician],
      ["Date", record.date],
      ["Notes", record.notes],
      ...commissioningChecklistItems.map((item) => [item.label, record.checklist[item.id] ? "COMPLETE" : "OPEN"]),
    ];
    const csv = rows.map((row) => row.map(quote).join(",")).join("\n");
    const link = document.createElement("a");
    const objectUrl = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.href = objectUrl;
    link.download = `${systemLabel(activeSystem).replaceAll(" ", "-").toLowerCase()}-commissioning-record.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  }

  function activePunchItems() {
    return punchItems
      .filter((item) => item.systemId === activeSystem)
      .sort((a, b) => {
        const statusOrder = Number(a.status === "resolved") - Number(b.status === "resolved");
        const priorityOrder = { critical: 0, normal: 1, low: 2 };
        return statusOrder || priorityOrder[a.priority] - priorityOrder[b.priority] || b.createdAt.localeCompare(a.createdAt);
      });
  }

  function selectedObjectDescription() {
    const drawing = drawings.find((item) => item.id === selectedId);
    if (!drawing) return "No drawing object linked";
    if (drawing.symbol) return `${drawing.symbol.label} · ${drawing.size || "Per plan"}`;
    if (drawing.fitting) return `${drawing.fitting.style === "tee90" ? "Tee" : "Wye"} · ${drawing.fitting.upstreamSize}×${drawing.fitting.downstreamSize}×${drawing.fitting.branchSize}`;
    return `${drawing.type.toUpperCase()} · ${drawing.size}" · ${drawing.roomName?.trim() || "Room unassigned"}`;
  }

  function createPunchItem() {
    if (!punchTitle.trim()) return;
    const item: PunchItem = {
      id: crypto.randomUUID(),
      systemId: activeSystem,
      drawingId: selectedId || undefined,
      title: punchTitle.trim(),
      category: punchCategory,
      priority: punchPriority,
      assignedTo: punchAssignedTo.trim(),
      note: punchNote.trim(),
      status: "open",
      createdAt: new Date().toISOString(),
    };
    setPunchItems((current) => [...current, item]);
    setPunchTitle("");
    setPunchNote("");
  }

  function togglePunchStatus(id: string) {
    setPunchItems((current) => current.map((item) => item.id === id ? {
      ...item,
      status: item.status === "open" ? "resolved" : "open",
      resolvedAt: item.status === "open" ? new Date().toISOString() : undefined,
    } : item));
  }

  function exportPunchListCsv() {
    const items = activePunchItems();
    if (!items.length) return;
    const quote = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const csv = [
      ["System", "Status", "Priority", "Category", "Issue", "Assigned To", "Drawing Link", "Note", "Created", "Resolved"],
      ...items.map((item) => [
        systemLabel(activeSystem),
        item.status,
        item.priority,
        item.category,
        item.title,
        item.assignedTo || "Unassigned",
        item.drawingId ? "Linked" : "Not linked",
        item.note,
        new Date(item.createdAt).toLocaleDateString(),
        item.resolvedAt ? new Date(item.resolvedAt).toLocaleDateString() : "",
      ]),
    ].map((row) => row.map(quote).join(",")).join("\n");
    const link = document.createElement("a");
    const objectUrl = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.href = objectUrl;
    link.download = `${systemLabel(activeSystem).replaceAll(" ", "-").toLowerCase()}-punch-list.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  }

  function activeRfiItems() {
    const statusOrder: Record<RfiItem["status"], number> = { submitted: 0, answered: 1, draft: 2, approved: 3, closed: 4 };
    const priorityOrder = { critical: 0, normal: 1, low: 2 };
    return rfiItems
      .filter((item) => item.systemId === activeSystem)
      .sort((a, b) => statusOrder[a.status] - statusOrder[b.status] || priorityOrder[a.priority] - priorityOrder[b.priority] || b.createdAt.localeCompare(a.createdAt));
  }

  function createRfiItem() {
    if (!rfiSubject.trim() || !rfiQuestion.trim()) return;
    const now = new Date().toISOString();
    const nextNumber = Math.max(0, ...rfiItems.map((item) => item.number)) + 1;
    const item: RfiItem = {
      id: crypto.randomUUID(),
      number: nextNumber,
      systemId: activeSystem,
      drawingId: selectedId || undefined,
      subject: rfiSubject.trim(),
      category: rfiCategory,
      priority: rfiPriority,
      question: rfiQuestion.trim(),
      proposedSolution: rfiSolution.trim(),
      assignedTo: rfiAssignedTo.trim(),
      costImpact: rfiCostImpact.trim() || "Not evaluated",
      scheduleImpact: rfiScheduleImpact.trim() || "Not evaluated",
      response: "",
      status: "draft",
      createdAt: now,
      updatedAt: now,
    };
    setRfiItems((current) => [...current, item]);
    setRfiSubject("");
    setRfiQuestion("");
    setRfiSolution("");
  }

  function updateRfiItem(id: string, patch: Partial<Pick<RfiItem, "status" | "response" | "approvalBy">>) {
    const now = new Date().toISOString();
    setRfiItems((current) => current.map((item) => {
      if (item.id !== id) return item;
      const next = { ...item, ...patch, updatedAt: now };
      const approvalContentChanged =
        (patch.response !== undefined && patch.response !== item.response) ||
        (patch.approvalBy !== undefined && patch.approvalBy !== item.approvalBy);
      if (approvalContentChanged && ["approved", "closed"].includes(item.status)) {
        next.status = "answered";
        next.approvedAt = undefined;
      }
      if (patch.status === "approved") {
        if (!next.response.trim() || !next.approvalBy?.trim()) return item;
        next.approvedAt = item.approvedAt || now;
      } else if (patch.status === "closed") {
        if (!item.approvedAt) return item;
        next.approvedAt = item.approvedAt;
      } else if (patch.status) {
        next.approvedAt = undefined;
      }
      return next;
    }));
  }

  function exportRfiLogCsv() {
    const items = rfiItems.slice().sort((a, b) => a.number - b.number);
    if (!items.length) return;
    const quote = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const csv = [
      ["RFI", "System", "Status", "Priority", "Category", "Subject", "Question / Conflict", "Proposed Solution", "Assigned To", "Cost Impact", "Schedule Impact", "Response / Approval", "Approved By", "Approved At", "Plan Link", "Created", "Updated"],
      ...items.map((item) => [
        `RFI-${String(item.number).padStart(3, "0")}`,
        systemLabel(item.systemId),
        item.status,
        item.priority,
        item.category,
        item.subject,
        item.question,
        item.proposedSolution,
        item.assignedTo || "Unassigned",
        item.costImpact,
        item.scheduleImpact,
        item.response,
        item.approvalBy || "",
        item.approvedAt ? new Date(item.approvedAt).toLocaleString() : "",
        item.drawingId ? "Linked" : "General",
        new Date(item.createdAt).toLocaleDateString(),
        new Date(item.updatedAt).toLocaleDateString(),
      ]),
    ].map((row) => row.map(quote).join(",")).join("\n");
    const link = document.createElement("a");
    const objectUrl = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.href = objectUrl;
    link.download = "hvac-project-rfi-change-log.csv";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
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
    setScaleVerified(true);
    setCalibrating(false);
    setMeasureDraft([]);
  }

  function placeSmartBranch(point: Point) {
    setBranchPlacementResult(null);
    if (attachPendingBranchRun(point)) return;
    if (branchWorkflow === "run-first" && !queuedBranchRunId) {
      armRunFirstBranch(point);
      return;
    }
    const threeRunMatch = queuedBranchRunId ? null : existingThreeRunJunction(point);
    if (threeRunMatch) {
      const [upstreamMatch, downstreamMatch, branchMatch] = threeRunMatch.ports;
      const fittingId = crypto.randomUUID();
      const temporaryFitting: Drawing = {
        id: fittingId,
        type: "branch",
        points: [threeRunMatch.center],
        size: `${upstreamMatch.drawing.size}×${downstreamMatch.drawing.size}×${branchMatch.drawing.size}`,
        page: pageNumber,
        systemId: drawingSystem(upstreamMatch.drawing),
        elevation: upstreamMatch.drawing.elevation,
        fitting: {
          kind: "ty",
          style: threeRunMatch.style,
          angle: threeRunMatch.angle,
          branchAngle: threeRunMatch.branchAngle,
          side: threeRunMatch.side,
          upstreamSize: upstreamMatch.drawing.size,
          downstreamSize: downstreamMatch.drawing.size,
          branchSize: branchMatch.drawing.size,
          connectedIds: threeRunMatch.ports.map((match) => match.drawing.id),
        },
      };
      const ports = fittingPortPoints(temporaryFitting);
      const endpointAssignments = new Map(threeRunMatch.ports.map((match, port) => [
        match.drawing.id,
        { endpointIndex: match.endpointIndex, point: ports[port] },
      ]));
      const connectedRuns = drawings.map((drawing) => {
        const assignment = endpointAssignments.get(drawing.id);
        if (!assignment) return drawing;
        return {
          ...drawing,
          points: drawing.points.map((existingPoint, index) => index === assignment.endpointIndex ? assignment.point : existingPoint),
        };
      });
      setHistory([...connectedRuns, temporaryFitting]);
      setActiveSystem(drawingSystem(upstreamMatch.drawing));
      setSelectedId(fittingId);
      const completionMessage = `${threeRunMatch.style === "tee90" ? "90° tee" : "45° wye"} complete · 3 separate runs attached to Ports 1, 2 and 3`;
      setBranchMessage(completionMessage);
      setBranchPlacementResult({ fittingId, message: completionMessage });
      return;
    }

    const rawTarget = nearestSupplySegment(point);
    if (!rawTarget || rawTarget.distance > 42 / zoom) {
      setBranchMessage("Move closer to a blue supply run");
      return;
    }
    if (queuedBranchRunId && rawTarget.drawing.id === queuedBranchRunId) {
      setBranchMessage("That is the branch run already armed for Port 3 · click the main trunk where the T/Y belongs");
      return;
    }
    const target = orientMainTowardAirflow(rawTarget);

    const center = target.point;
    const matchedRoute = queuedBranchRunId
      ? queuedBranchRoute(center, target.drawing.id, target.angle)
      : existingBranchRoute(center, target.drawing.id, target.angle);
    if (queuedBranchRunId && !matchedRoute) return;
    const downstreamSize = steppedSize(target.drawing.size, 1);
    const branchSize = matchedRoute?.drawing.size || steppedSize(target.drawing.size, 2);
    const downstreamId = crypto.randomUUID();
    const fittingId = crypto.randomUUID();
    const fittingSide = matchedRoute?.side || target.side;
    const defaultBranchOffset = branchStyle === "tee90" ? Math.PI / 2 : Math.PI / 4;
    const branchAngle = matchedRoute?.angle ?? target.angle + fittingSide * defaultBranchOffset;
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
    const branchRun: Drawing | null = matchedRoute ? {
      ...matchedRoute.drawing,
      points: cleanPoints([branchPort, ...matchedRoute.points.slice(1)]),
    } : null;
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
        connectedIds: [upstream.id, downstream.id, branchRun?.id || ""],
      },
    };
    setHistory([
      ...drawings.filter((drawing) => drawing.id !== target.drawing.id && drawing.id !== matchedRoute?.drawing.id),
      upstream,
      downstream,
      ...(branchRun ? [branchRun] : []),
      fitting,
    ]);
    setActiveSystem(drawingSystem(target.drawing));
    setSelectedId(fittingId);
    if (branchRun) {
      setQueuedBranchRunId(null);
      setBranchHoverRunId(null);
      const completionMessage = `${resolvedStyle === "tee90" ? "90° tee" : "45° wye"} complete · trunk split and 3 of 3 ports attached`;
      setBranchMessage(completionMessage);
      setBranchPlacementResult({ fittingId, message: completionMessage });
    } else {
      setPendingBranchFittingId(fittingId);
      setBranchPlacementResult(null);
      setBranchMessage("Trunk split and fitting placed · now click any blue branch run to attach Port 3");
    }
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

  function assignSelectedFittingPort(port: 0 | 1 | 2, runId: string) {
    const fitting = drawings.find((drawing) => drawing.id === selectedId && drawing.fitting);
    const run = drawings.find((drawing) => drawing.id === runId && drawing.type === "supply" && !drawing.fitting);
    if (!fitting?.fitting || !run) return;
    if (fitting.fitting.connectedIds.some((connectedId, index) => index !== port && connectedId === runId)) {
      setBranchMessage("That run is already assigned to another fitting port");
      return;
    }
    const portPoint = fittingPortPoints(fitting)[port];
    const firstDistance = Math.hypot(run.points[0].x - portPoint.x, run.points[0].y - portPoint.y);
    const lastIndex = run.points.length - 1;
    const lastDistance = Math.hypot(run.points[lastIndex].x - portPoint.x, run.points[lastIndex].y - portPoint.y);
    const endpointIndex = firstDistance <= lastDistance ? 0 : lastIndex;
    const keys = ["upstreamSize", "downstreamSize", "branchSize"] as const;
    const connectedIds = [...fitting.fitting.connectedIds];
    connectedIds[port] = run.id;
    const updatedFitting: Drawing = {
      ...fitting,
      size: [0, 1, 2].map((index) => index === port ? run.size : [
        fitting.fitting!.upstreamSize,
        fitting.fitting!.downstreamSize,
        fitting.fitting!.branchSize,
      ][index]).join("×"),
      fitting: {
        ...fitting.fitting,
        connectedIds,
        [keys[port]]: run.size,
      },
    };
    const updatedPort = fittingPortPoints(updatedFitting)[port];
    const next = drawings.map((drawing) => {
      if (drawing.id === fitting.id) return updatedFitting;
      if (drawing.id !== run.id) return drawing;
      return {
        ...drawing,
        points: drawing.points.map((point, index) => index === endpointIndex ? updatedPort : point),
      };
    });
    setHistory(next);
    setBranchMessage(`Existing ${run.size}″ run assigned to Port ${port + 1} · route preserved`);
  }

  function fittingPortState(fitting: Drawing, port: 0 | 1 | 2) {
    const run = drawings.find((drawing) => drawing.id === fitting.fitting?.connectedIds[port]);
    if (!run) return { connected: false, overloaded: false, cfm: 0, recommended: "" };
    const portPoint = fittingPortPoints(fitting)[port];
    const connected = [run.points[0], run.points[run.points.length - 1]].some((point) => Math.hypot(point.x - portPoint.x, point.y - portPoint.y) < 2);
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
      equipment: { label: "3 TON AHU", size: "3 TON", cfm: 1200 },
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
    const equipmentType = kind === "equipment" ? equipmentTypeName(preset?.variant || "air-handler") : "";
    const placedLabel = kind === "equipment" && equipmentType
      ? `${systemLabel(activeSystem).toUpperCase()} · ${selectedDefaults.size} ${equipmentType}`
      : selectedDefaults.label;
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
        label: placedLabel,
        rotation: placementRotation,
        variant: preset?.variant,
        neckSize: ["diffuser", "returnGrille"].includes(kind) ? (kind === "returnGrille" ? "12" : "8") : undefined,
      },
    };
    setHistory([...drawings, symbol]);
    setSelectedId(symbol.id);
  }

  function segmentIntersection(a: Point, b: Point, c: Point, d: Point) {
    const denominator = (a.x - b.x) * (c.y - d.y) - (a.y - b.y) * (c.x - d.x);
    if (Math.abs(denominator) < .001) return null;
    const t = ((a.x - c.x) * (c.y - d.y) - (a.y - c.y) * (c.x - d.x)) / denominator;
    const u = -((a.x - b.x) * (a.y - c.y) - (a.y - b.y) * (a.x - c.x)) / denominator;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1
      ? { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) }
      : null;
  }

  function snapResult(point: Point, ignoredId?: string): SnapInfo | null {
    if (!snapEnabled) return null;
    const tolerance = 16 / zoom;
    const candidates: Array<SnapInfo & { priority: number; distance: number }> = [];
    const pageDrawings = drawings.filter((drawing) => drawing.page === pageNumber && drawing.id !== ignoredId);
    const add = (candidate: Point, kind: SnapKind, label: string, priority: number, limit = tolerance) => {
      const distance = Math.hypot(point.x - candidate.x, point.y - candidate.y);
      if (distance <= limit) candidates.push({ point: candidate, kind, label, priority, distance });
    };
    pageDrawings.forEach((drawing) => {
      if (drawing.fitting) {
        fittingPortPoints(drawing).forEach((port) => add(port, "fitting port", "PORT", 0, 24 / zoom));
        return;
      }
      if (isPrimaryAirflowEquipment(drawing)) {
        const ports = equipmentPlenumPorts(drawing);
        add(ports.supply, "equipment port", "SUPPLY PLENUM", 1, 24 / zoom);
        add(ports.return, "equipment port", "RETURN PLENUM", 1, 24 / zoom);
      }
      drawing.points.forEach((vertex, index) => add(vertex, "endpoint", index === 0 || index === drawing.points.length - 1 ? "ENDPOINT" : "VERTEX", 2));
      drawing.points.slice(0, -1).forEach((vertex, index) => {
        const next = drawing.points[index + 1];
        add({ x: (vertex.x + next.x) / 2, y: (vertex.y + next.y) / 2 }, "midpoint", "MIDPOINT", 4);
      });
    });
    const runSegments = pageDrawings.filter((drawing) => !drawing.fitting && !drawing.symbol && drawing.points.length > 1)
      .flatMap((drawing) => drawing.points.slice(0, -1).map((a, index) => ({ drawingId: drawing.id, a, b: drawing.points[index + 1] })));
    for (let first = 0; first < runSegments.length; first++) {
      for (let second = first + 1; second < runSegments.length; second++) {
        if (runSegments[first].drawingId === runSegments[second].drawingId) continue;
        const crossing = segmentIntersection(runSegments[first].a, runSegments[first].b, runSegments[second].a, runSegments[second].b);
        if (crossing) add(crossing, "intersection", "INTERSECTION", 3);
      }
    }
    const nearest = nearestSegment(point, ignoredId);
    if (nearest) add(nearest.point, "nearest", "NEAREST", 5);
    const gridPoint = { x: Math.round(point.x / 10) * 10, y: Math.round(point.y / 10) * 10 };
    add(gridPoint, "grid", "GRID", 6, 6 / zoom);
    candidates.sort((a, b) => a.priority - b.priority || a.distance - b.distance);
    return candidates[0] || null;
  }

  function snapPoint(point: Point, ignoredId?: string) {
    return snapResult(point, ignoredId)?.point || point;
  }

  function guidesFor(point: Point, ignoredId?: string) {
    const threshold = 7 / zoom;
    let closestX: { value: number; distance: number } | null = null;
    let closestY: { value: number; distance: number } | null = null;
    drawings.filter((drawing) => drawing.page === pageNumber && drawing.id !== ignoredId).forEach((drawing) => {
      drawing.points.forEach((vertex) => {
        const dx = Math.abs(vertex.x - point.x);
        const dy = Math.abs(vertex.y - point.y);
        if (dx <= threshold && (!closestX || dx < closestX.distance)) closestX = { value: vertex.x, distance: dx };
        if (dy <= threshold && (!closestY || dy < closestY.distance)) closestY = { value: vertex.y, distance: dy };
      });
    });
    return [
      ...(closestX ? [{ axis: "x" as const, value: closestX.value }] : []),
      ...(closestY ? [{ axis: "y" as const, value: closestY.value }] : []),
    ];
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

  function linkRunToMatchingEquipmentPlenum(current: Drawing[], runId: string) {
    const run = current.find((drawing) => drawing.id === runId);
    if (!run || !["supply", "return"].includes(run.type) || run.fitting || run.symbol) return current;
    const ductType = run.type as "supply" | "return";
    const candidates = current
      .filter((drawing) =>
        isPrimaryAirflowEquipment(drawing) &&
        drawing.page === run.page &&
        drawingSystem(drawing) === drawingSystem(run)
      )
      .flatMap((equipment) => {
        const port = equipmentPlenumPorts(equipment)[ductType];
        return [
          { equipment, port, end: "start" as const, distance: Math.hypot(run.points[0].x - port.x, run.points[0].y - port.y) },
          { equipment, port, end: "end" as const, distance: Math.hypot(run.points.at(-1)!.x - port.x, run.points.at(-1)!.y - port.y) },
        ];
      })
      .sort((a, b) => a.distance - b.distance);
    const match = candidates[0];
    if (!match || match.distance > 4 / zoom) return current;
    return current.map((drawing) => drawing.id === match.equipment.id && drawing.symbol ? {
      ...drawing,
      symbol: ductType === "supply"
        ? { ...drawing.symbol, connectedRunId: run.id, connectedEnd: match.end }
        : { ...drawing.symbol, returnRunId: run.id, returnEnd: match.end },
    } : drawing);
  }

  function finishDrawing() {
    if (draft.length > 1 && ["supply", "return", "fresh"].includes(activeTool)) {
      const continuing = continuingRunId ? drawings.find((drawing) => drawing.id === continuingRunId) : null;
      if (continuing) {
        const startsAtFirst = Math.hypot(continuing.points[0].x - draft[0].x, continuing.points[0].y - draft[0].y) < 2;
        const extendedPoints = startsAtFirst
          ? [...draft.slice(1).reverse(), ...continuing.points]
          : [...continuing.points, ...draft.slice(1)];
        const extended = drawings.map((drawing) => drawing.id === continuing.id ? { ...drawing, points: cleanPoints(extendedPoints) } : drawing);
        setHistory(linkRunToMatchingEquipmentPlenum(extended, continuing.id));
      } else {
        const drawing: Drawing = {
          id: crypto.randomUUID(),
          type: activeTool as DrawType,
          points: draft,
          size: ductSize,
          lineWeight: ["supply", "return"].includes(activeTool) ? runLineWeight : 0.2,
          page: pageNumber,
          cfm: defaultCfm(ductSize),
          systemId: activeSystem,
          elevation: "",
        };
        const connected = addJunctionPoints(drawings, [draft[0], draft[draft.length - 1]]);
        setHistory(linkRunToMatchingEquipmentPlenum([...connected, drawing], drawing.id));
      }
    }
    setContinuingRunId(null);
    setDraft([]);
    setHoverPoint(null);
    setSnapMarker(null);
  }

  function extendSelectedRun(fromStart: boolean) {
    const run = drawings.find((drawing) => drawing.id === selectedId && !drawing.fitting && !drawing.symbol && ["supply", "return", "fresh"].includes(drawing.type));
    if (!run || drawingLocked(run)) return;
    const endpoint = fromStart ? run.points[0] : run.points[run.points.length - 1];
    setActiveTool(run.type);
    setActiveSystem(drawingSystem(run));
    setDuctSize(run.size);
    setDraft([endpoint]);
    setContinuingRunId(run.id);
    setSplitMode(false);
    setBranchMessage(`Extending ${fromStart ? "start" : "end"} of ${run.size}″ ${run.type} run · right-click to finish`);
  }

  function splitRunAtPoint(drawing: Drawing, rawPoint: Point) {
    if (drawing.points.length < 2 || drawingLocked(drawing)) return;
    let best: { point: Point; segmentIndex: number; distance: number } | null = null;
    drawing.points.slice(0, -1).forEach((a, segmentIndex) => {
      const b = drawing.points[segmentIndex + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const lengthSquared = dx * dx + dy * dy;
      const amount = lengthSquared ? Math.max(0, Math.min(1, ((rawPoint.x - a.x) * dx + (rawPoint.y - a.y) * dy) / lengthSquared)) : 0;
      const point = { x: a.x + amount * dx, y: a.y + amount * dy };
      const distance = Math.hypot(rawPoint.x - point.x, rawPoint.y - point.y);
      if (!best || distance < best.distance) best = { point, segmentIndex, distance };
    });
    if (!best) return;
    const first = drawing.points[0];
    const last = drawing.points[drawing.points.length - 1];
    if (Math.min(Math.hypot(best.point.x - first.x, best.point.y - first.y), Math.hypot(best.point.x - last.x, best.point.y - last.y)) < 10 / zoom) {
      setBranchMessage("Move farther from the endpoint to split this run");
      return;
    }
    const secondId = crypto.randomUUID();
    const firstRun = { ...drawing, points: cleanPoints([...drawing.points.slice(0, best.segmentIndex + 1), best.point]) };
    const secondRun = { ...structuredClone(drawing), id: secondId, points: cleanPoints([best.point, ...drawing.points.slice(best.segmentIndex + 1)]) };
    const updated = drawings.flatMap((item) => {
      if (item.id === drawing.id) return [firstRun, secondRun];
      if (item.symbol?.connectedRunId === drawing.id || item.symbol?.returnRunId === drawing.id) {
        return [{
          ...item,
          symbol: {
            ...item.symbol,
            connectedRunId: item.symbol.connectedRunId === drawing.id
              ? item.symbol.connectedEnd === "end" ? secondId : drawing.id
              : item.symbol.connectedRunId,
            returnRunId: item.symbol.returnRunId === drawing.id
              ? item.symbol.returnEnd === "end" ? secondId : drawing.id
              : item.symbol.returnRunId,
          },
        }];
      }
      if (!item.fitting?.connectedIds.includes(drawing.id)) return [item];
      const ports = fittingPortPoints(item);
      const connectedIds = item.fitting.connectedIds.map((id, portIndex) => {
        if (id !== drawing.id) return id;
        const firstDistance = Math.hypot(first.x - ports[portIndex].x, first.y - ports[portIndex].y);
        const lastDistance = Math.hypot(last.x - ports[portIndex].x, last.y - ports[portIndex].y);
        return lastDistance < firstDistance ? secondId : drawing.id;
      });
      return [{ ...item, fitting: { ...item.fitting, connectedIds } }];
    });
    setHistory(updated);
    setSelectedIds([drawing.id, secondId]);
    setSelectedId(secondId);
    setSplitMode(false);
    setBranchMessage("Run split into 2 editable sections · connected T/Y ports preserved");
  }

  function joinSelectedRuns() {
    const runs = drawings.filter((drawing) => selectedIds.includes(drawing.id) && !drawing.fitting && !drawing.symbol && ["supply", "return", "fresh"].includes(drawing.type));
    if (runs.length !== 2) {
      setBranchMessage("Select exactly 2 duct runs to join");
      return;
    }
    const [firstRun, secondRun] = runs;
    if (firstRun.type !== secondRun.type || drawingSystem(firstRun) !== drawingSystem(secondRun)) {
      setBranchMessage("Runs must be the same duct type and HVAC system");
      return;
    }
    const orientations = [
      { a: firstRun.points, b: secondRun.points },
      { a: [...firstRun.points].reverse(), b: secondRun.points },
      { a: firstRun.points, b: [...secondRun.points].reverse() },
      { a: [...firstRun.points].reverse(), b: [...secondRun.points].reverse() },
    ].map((option) => ({
      ...option,
      distance: Math.hypot(option.a.at(-1)!.x - option.b[0].x, option.a.at(-1)!.y - option.b[0].y),
    })).sort((a, b) => a.distance - b.distance);
    const best = orientations[0];
    if (best.distance > 36 / zoom) {
      setBranchMessage("Move the run endpoints closer before joining");
      return;
    }
    const joined: Drawing = {
      ...firstRun,
      size: firstRun.size,
      cfm: Math.max(firstRun.cfm || 0, secondRun.cfm || 0),
      points: cleanPoints([...best.a, ...best.b]),
    };
    const updated = drawings.filter((drawing) => drawing.id !== secondRun.id).map((drawing) => {
      if (drawing.id === firstRun.id) return joined;
      const supplyConnected = drawing.symbol?.connectedRunId === firstRun.id || drawing.symbol?.connectedRunId === secondRun.id;
      const returnConnected = drawing.symbol?.returnRunId === firstRun.id || drawing.symbol?.returnRunId === secondRun.id;
      if (supplyConnected || returnConnected) {
        const ports = isPrimaryAirflowEquipment(drawing) ? equipmentPlenumPorts(drawing) : null;
        const supplyAnchor = ports?.supply || drawing.points[0];
        const returnAnchor = ports?.return || drawing.points[0];
        const joinedEnd = joined.points[joined.points.length - 1];
        return {
          ...drawing,
          symbol: {
            ...drawing.symbol,
            connectedRunId: supplyConnected ? firstRun.id : drawing.symbol?.connectedRunId,
            connectedEnd: supplyConnected
              ? Math.hypot(supplyAnchor.x - joined.points[0].x, supplyAnchor.y - joined.points[0].y) <= Math.hypot(supplyAnchor.x - joinedEnd.x, supplyAnchor.y - joinedEnd.y) ? "start" : "end"
              : drawing.symbol?.connectedEnd,
            returnRunId: returnConnected ? firstRun.id : drawing.symbol?.returnRunId,
            returnEnd: returnConnected
              ? Math.hypot(returnAnchor.x - joined.points[0].x, returnAnchor.y - joined.points[0].y) <= Math.hypot(returnAnchor.x - joinedEnd.x, returnAnchor.y - joinedEnd.y) ? "start" : "end"
              : drawing.symbol?.returnEnd,
          },
        };
      }
      if (!drawing.fitting?.connectedIds.includes(secondRun.id)) return drawing;
      return {
        ...drawing,
        fitting: {
          ...drawing.fitting,
          connectedIds: drawing.fitting.connectedIds.map((id) => id === secondRun.id ? firstRun.id : id),
        },
      };
    });
    setHistory(synchronizeFittingSizes(updated, drawings));
    selectOnly(firstRun.id);
    setBranchMessage(`2 ${firstRun.type} runs joined · T/Y relationships transferred`);
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
    if (event.button !== 0 || panRef.current) return;
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
        setScaleVerified(true);
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
    setPendingBranchFittingId(null);
    setBranchPreview(null);
    setBranchPlacementResult(null);
    setSelectedId(null);
  }

  function redo() {
    const next = redoStack.at(-1);
    if (!next) return;
    setUndoStack((stack) => [...stack, drawings]);
    setDrawings(next);
    setRedoStack((stack) => stack.slice(0, -1));
    setPendingBranchFittingId(null);
    setBranchPreview(null);
    setBranchPlacementResult(null);
  }

  function removeDeletedDrawingReferences(current: Drawing[], idsToDelete: string[]) {
    const deleted = new Set(idsToDelete);
    return current
      .filter((drawing) => !deleted.has(drawing.id))
      .map((drawing) => {
        const symbolDisconnected = Boolean(
          drawing.symbol?.connectedRunId &&
          deleted.has(drawing.symbol.connectedRunId),
        );
        const returnDisconnected = Boolean(
          drawing.symbol?.returnRunId &&
          deleted.has(drawing.symbol.returnRunId),
        );
        const connectedIds = drawing.fitting?.connectedIds.map((id) =>
          deleted.has(id) ? "" : id
        );
        const fittingDisconnected = Boolean(
          drawing.fitting &&
          connectedIds?.some((id, index) => id !== drawing.fitting?.connectedIds[index]),
        );
        if (!symbolDisconnected && !returnDisconnected && !fittingDisconnected) return drawing;
        return {
          ...drawing,
          symbol: drawing.symbol
            ? {
              ...drawing.symbol,
              connectedRunId: symbolDisconnected ? undefined : drawing.symbol.connectedRunId,
              connectedEnd: symbolDisconnected ? undefined : drawing.symbol.connectedEnd,
              returnRunId: returnDisconnected ? undefined : drawing.symbol.returnRunId,
              returnEnd: returnDisconnected ? undefined : drawing.symbol.returnEnd,
            }
            : drawing.symbol,
          fitting: fittingDisconnected
            ? { ...drawing.fitting!, connectedIds: connectedIds! }
            : drawing.fitting,
        };
      });
  }

  function clearDeletedDrawingState(idsToDelete: string[]) {
    const deleted = new Set(idsToDelete);
    selectOnly(null);
    setSplitMode(false);
    setSelectionBox(null);
    if (continuingRunId && deleted.has(continuingRunId)) setContinuingRunId(null);
    if (queuedBranchRunId && deleted.has(queuedBranchRunId)) setQueuedBranchRunId(null);
    if (pendingBranchFittingId && deleted.has(pendingBranchFittingId)) setPendingBranchFittingId(null);
    if (branchPlacementResult && deleted.has(branchPlacementResult.fittingId)) setBranchPlacementResult(null);
    if (branchHoverRunId && deleted.has(branchHoverRunId)) setBranchHoverRunId(null);
  }

  function deleteSelected() {
    if (!selectedId) return;
    if (selectedIds.length > 1) {
      const ids = connectedSelection(selectedIds).filter((id) => !drawingLocked(drawings.find((drawing) => drawing.id === id)));
      if (!ids.length) {
        setBranchMessage("Selected objects are on locked layers");
        return;
      }
      clearDeletedDrawingState(ids);
      setHistory(removeDeletedDrawingReferences(drawings, ids));
      setBranchMessage(`${ids.length} connected objects deleted · undo restores the full group`);
      return;
    }
    const selected = drawings.find((drawing) => drawing.id === selectedId);
    if (!selected) {
      clearDeletedDrawingState([selectedId]);
      return;
    }
    if (drawingLocked(selected)) return;
    if (selected?.fitting) {
      removeFittingAndHeal(selected);
      return;
    }
    const ids = [selected.id];
    clearDeletedDrawingState(ids);
    setHistory(removeDeletedDrawingReferences(drawings, ids));
    setBranchMessage(selected.symbol
      ? "Icon deleted · connected ductwork kept · Undo restores it"
      : "Run deleted · connected icons and fitting ports safely detached · Undo restores it");
  }

  function removeFittingAndHeal(fitting: Drawing) {
    if (!fitting.fitting) return;
    const [inletPort, outletPort] = fittingPortPoints(fitting);
    const [upstreamId, downstreamId] = fitting.fitting.connectedIds;
    const upstream = drawings.find((drawing) => drawing.id === upstreamId);
    const downstream = drawings.find((drawing) => drawing.id === downstreamId);
    if (!upstream || !downstream || upstream.points.length < 2 || downstream.points.length < 2) {
      clearDeletedDrawingState([fitting.id]);
      setHistory(removeDeletedDrawingReferences(drawings, [fitting.id]));
      setActiveTool("select");
      setBranchMessage("T/Y fitting deleted · incomplete routes kept in place · Undo restores it");
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
    const retained = drawings.filter((drawing) =>
        drawing.id !== fitting.id &&
        drawing.id !== upstreamId &&
        drawing.id !== downstreamId
      ).map((drawing) => {
        const supplyConnected = Boolean(drawing.symbol?.connectedRunId && [upstreamId, downstreamId].includes(drawing.symbol.connectedRunId));
        const returnConnected = Boolean(drawing.symbol?.returnRunId && [upstreamId, downstreamId].includes(drawing.symbol.returnRunId));
        if (!supplyConnected && !returnConnected) return drawing;
        const healedEnd = healedMain.points[healedMain.points.length - 1];
        const ports = isPrimaryAirflowEquipment(drawing) ? equipmentPlenumPorts(drawing) : null;
        const supplyAnchor = ports?.supply || drawing.points[0];
        const returnAnchor = ports?.return || drawing.points[0];
        return {
          ...drawing,
          symbol: {
            ...drawing.symbol!,
            connectedRunId: supplyConnected ? healedMain.id : drawing.symbol?.connectedRunId,
            connectedEnd: supplyConnected
              ? Math.hypot(supplyAnchor.x - healedMain.points[0].x, supplyAnchor.y - healedMain.points[0].y) <= Math.hypot(supplyAnchor.x - healedEnd.x, supplyAnchor.y - healedEnd.y) ? "start" as const : "end" as const
              : drawing.symbol?.connectedEnd,
            returnRunId: returnConnected ? healedMain.id : drawing.symbol?.returnRunId,
            returnEnd: returnConnected
              ? Math.hypot(returnAnchor.x - healedMain.points[0].x, returnAnchor.y - healedMain.points[0].y) <= Math.hypot(returnAnchor.x - healedEnd.x, returnAnchor.y - healedEnd.y) ? "start" as const : "end" as const
              : drawing.symbol?.returnEnd,
          },
        };
      });
    clearDeletedDrawingState([fitting.id]);
    setHistory([...retained, healedMain]);
    setActiveTool("select");
    setBranchMessage("T/Y fitting deleted · main run healed · branch route kept · Undo restores it");
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
      symbol: copied.symbol ? { ...structuredClone(copied.symbol), connectedRunId: undefined, connectedEnd: undefined, returnRunId: undefined, returnEnd: undefined } : undefined,
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
        symbol: drawing.symbol ? {
          ...structuredClone(drawing.symbol),
          connectedRunId: drawing.symbol.connectedRunId ? idMap.get(drawing.symbol.connectedRunId) : undefined,
          connectedEnd: drawing.symbol.connectedRunId && idMap.get(drawing.symbol.connectedRunId) ? drawing.symbol.connectedEnd : undefined,
          returnRunId: drawing.symbol.returnRunId ? idMap.get(drawing.symbol.returnRunId) : undefined,
          returnEnd: drawing.symbol.returnRunId && idMap.get(drawing.symbol.returnRunId) ? drawing.symbol.returnEnd : undefined,
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
      symbol: selected.symbol ? { ...structuredClone(selected.symbol), connectedRunId: undefined, connectedEnd: undefined, returnRunId: undefined, returnEnd: undefined } : undefined,
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

  function updateRunLineWeight(value: number) {
    const lineWeight = normalizedRunLineWeight(value);
    setRunLineWeight(lineWeight);
    const selected = drawings.find((drawing) =>
      drawing.id === selectedId &&
      !drawing.fitting &&
      !drawing.symbol &&
      ["supply", "return"].includes(drawing.type)
    );
    if (!selected) return;
    setHistory(drawings.map((drawing) =>
      drawing.id === selected.id ? { ...drawing, lineWeight } : drawing
    ));
    setBranchMessage(`${selected.type === "return" ? "Return" : "Supply"} run line weight set to ${lineWeight.toFixed(2)} mm · connected T/Y leg matched automatically`);
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
        cfm: isPrimaryAirflowEquipment(drawing) ? Math.round(tons * 400) : drawing.cfm,
        symbol: {
          ...drawing.symbol,
          label: `${systemLabel(drawingSystem(drawing)).toUpperCase()} · ${tons} TON ${equipmentTypeName(drawing.symbol.variant) || "EQUIPMENT"}`,
        },
      };
    }));
  }

  function updateActiveSystemTonnage(tons: number) {
    if (!Number.isFinite(tons)) return;
    const network = airflowNetwork();
    const units = drawings.filter((drawing) => isPrimaryAirflowEquipment(drawing) && drawingSystem(drawing) === activeSystem);
    const unit = units.find((drawing) => network.equipmentRun.has(drawing.id)) || units[0];
    if (!unit) {
      setBranchMessage(`Place an equipment symbol for ${systemLabel(activeSystem)} before setting tonnage`);
      return;
    }
    const targetCfm = Math.round(tons * 400);
    setHistory(drawings.map((drawing) => {
      if (drawing.id !== unit.id || drawing.symbol?.kind !== "equipment") return drawing;
      return {
        ...drawing,
        size: `${tons} TON`,
        cfm: targetCfm,
        symbol: {
          ...drawing.symbol,
          label: `${systemLabel(activeSystem).toUpperCase()} · ${tons} TON ${equipmentTypeName(drawing.symbol.variant) || "EQUIPMENT"}`,
        },
      };
    }));
    setSelectedId(unit.id);
    setBranchMessage(`${systemLabel(activeSystem)} set to ${tons} ton · ${targetCfm} CFM design airflow · review only, no duct sizes changed`);
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
    const next = drawings.map((drawing) =>
      drawing.id === selectedId && drawing.symbol
        ? { ...drawing, symbol: { ...drawing.symbol, ...changes } }
        : drawing);
    const updated = next.find((drawing) => drawing.id === selectedId);
    const connectionIds = [updated?.symbol?.connectedRunId, updated?.symbol?.returnRunId].filter((id): id is string => Boolean(id));
    setHistory(
      isPrimaryAirflowEquipment(updated) && ["rotation", "scaleX", "scaleY"].some((key) => key in changes)
        ? syncConnectedTerminals(next, connectionIds)
        : next
    );
  }

  function updateSelectedCanDimension(axis: 0 | 1, value: string) {
    const selected = drawings.find((drawing) => drawing.id === selectedId && ["diffuser", "returnGrille"].includes(drawing.symbol?.kind || ""));
    if (!selected) return;
    const current = selected.size.replace(/"/g, "").split(/[x×]/i);
    const dimensions = current.length > 1 ? current : ["12", "12"];
    dimensions[axis] = value;
    setHistory(drawings.map((drawing) => drawing.id === selected.id ? { ...drawing, size: `${dimensions[0]}×${dimensions[1]}` } : drawing));
  }

  function applySelectedCanPreset(presetId: string) {
    const selected = drawings.find((drawing) => drawing.id === selectedId);
    const preset = symbolPresets.find((item) => item.id === presetId && item.kind === selected?.symbol?.kind);
    if (!selected?.symbol || !preset) return;
    setHistory(drawings.map((drawing) => drawing.id === selected.id ? {
      ...drawing,
      size: preset.size,
      cfm: preset.cfm,
      elevation: preset.elevation || drawing.elevation,
      symbol: { ...drawing.symbol!, label: preset.label, variant: preset.variant },
    } : drawing));
  }

  function terminalConnection(selected?: Drawing) {
    if (!selected?.symbol || !["diffuser", "returnGrille"].includes(selected.symbol.kind)) return null;
    const desiredType = selected.symbol.kind === "diffuser" ? "supply" : "return";
    if (selected.symbol.connectedRunId) {
      const run = drawings.find((drawing) =>
        drawing.id === selected.symbol?.connectedRunId &&
        drawing.page === selected.page &&
        drawing.type === desiredType &&
        !drawing.fitting &&
        drawingSystem(drawing) === drawingSystem(selected)
      );
      if (run) {
        const endpoint = selected.symbol.connectedEnd === "start" ? run.points[0] : run.points[run.points.length - 1];
        return { run, endpoint, distance: Math.hypot(endpoint.x - selected.points[0].x, endpoint.y - selected.points[0].y), end: selected.symbol.connectedEnd || "end" as const, saved: true };
      }
    }
    let best: { run: Drawing; endpoint: Point; distance: number; end: "start" | "end"; saved: boolean } | null = null;
    drawings.filter((drawing) => drawing.page === selected.page && drawing.type === desiredType && !drawing.fitting && drawingSystem(drawing) === drawingSystem(selected)).forEach((run) => {
      ([{ endpoint: run.points[0], end: "start" as const }, { endpoint: run.points[run.points.length - 1], end: "end" as const }]).forEach(({ endpoint, end }) => {
        const distance = Math.hypot(endpoint.x - selected.points[0].x, endpoint.y - selected.points[0].y);
        if (!best || distance < best.distance) best = { run, endpoint, distance, end, saved: false };
      });
    });
    return best;
  }

  function equipmentPlenumPorts(selected: Drawing) {
    const variant = selected.symbol?.variant || "";
    const local = variant === "rtu"
      ? { supply: { x: 10.5, y: 23 }, return: { x: -10.5, y: 23 } }
      : ["vertical-air-handler", "vertical-furnace"].includes(variant)
        ? { supply: { x: 0, y: -40 }, return: { x: 0, y: 40 } }
        : { supply: { x: 37, y: 0 }, return: { x: -37, y: 0 } };
    const radians = (selected.symbol?.rotation || 0) * Math.PI / 180;
    const scaleX = normalizedSymbolScale(selected.symbol?.scaleX);
    const scaleY = normalizedSymbolScale(selected.symbol?.scaleY);
    const transform = (point: Point) => {
      const x = point.x * scaleX;
      const y = point.y * scaleY;
      return {
        x: selected.points[0].x + x * Math.cos(radians) - y * Math.sin(radians),
        y: selected.points[0].y + x * Math.sin(radians) + y * Math.cos(radians),
      };
    };
    return { supply: transform(local.supply), return: transform(local.return), local };
  }

  function equipmentConnection(selected?: Drawing, ductType: "supply" | "return" = "supply") {
    if (!isPrimaryAirflowEquipment(selected)) return null;
    const runId = ductType === "supply" ? selected.symbol.connectedRunId : selected.symbol.returnRunId;
    const connectedEnd = ductType === "supply" ? selected.symbol.connectedEnd : selected.symbol.returnEnd;
    const portPoint = equipmentPlenumPorts(selected)[ductType];
    if (runId) {
      const run = drawings.find((drawing) =>
        drawing.id === runId &&
        drawing.page === selected.page &&
        drawing.type === ductType &&
        !drawing.fitting &&
        drawingSystem(drawing) === drawingSystem(selected)
      );
      if (run) {
        const endpoint = connectedEnd === "start" ? run.points[0] : run.points[run.points.length - 1];
        return { run, endpoint, portPoint, distance: Math.hypot(endpoint.x - portPoint.x, endpoint.y - portPoint.y), end: connectedEnd || "start" as const, saved: true, ductType };
      }
    }
    let best: { run: Drawing; endpoint: Point; portPoint: Point; distance: number; end: "start" | "end"; saved: boolean; ductType: "supply" | "return" } | null = null;
    drawings.filter((drawing) =>
      drawing.page === selected.page &&
      drawing.type === ductType &&
      !drawing.fitting &&
      drawingSystem(drawing) === drawingSystem(selected)
    ).forEach((run) => {
      ([{ endpoint: run.points[0], end: "start" as const }, { endpoint: run.points[run.points.length - 1], end: "end" as const }]).forEach(({ endpoint, end }) => {
        const distance = Math.hypot(endpoint.x - portPoint.x, endpoint.y - portPoint.y);
        if (!best || distance < best.distance) best = { run, endpoint, portPoint, distance, end, saved: false, ductType };
      });
    });
    return best;
  }

  function attachSelectedCanToRun() {
    const selected = drawings.find((drawing) => drawing.id === selectedId);
    const connection = terminalConnection(selected);
    if (!selected || !connection || connection.distance > 70 / zoom) {
      setBranchMessage("Move the can closer to a matching duct endpoint, then attach");
      return;
    }
    setHistory(drawings.map((drawing) => drawing.id === selected.id ? {
      ...drawing,
      points: [{ ...connection.endpoint }],
      symbol: { ...drawing.symbol!, connectedRunId: connection.run.id, connectedEnd: connection.end },
    } : drawing));
    setBranchMessage(`${selected.symbol?.kind === "diffuser" ? "Supply can" : "Return can"} attached to ${connection.run.size}″ ${connection.run.type} run`);
  }

  function detachSelectedCan() {
    const selected = drawings.find((drawing) => drawing.id === selectedId && drawing.symbol?.connectedRunId);
    if (!selected?.symbol) return;
    setHistory(drawings.map((drawing) => drawing.id === selected.id ? {
      ...drawing,
      symbol: { ...drawing.symbol!, connectedRunId: undefined, connectedEnd: undefined },
    } : drawing));
    setBranchMessage("Can detached · duct and can remain in place for manual editing");
  }

  function attachSelectedEquipmentToRun(ductType: "supply" | "return" = "supply") {
    const selected = drawings.find((drawing) => drawing.id === selectedId);
    const connection = equipmentConnection(selected, ductType);
    if (!selected || !connection || connection.distance > 90 / zoom) {
      setBranchMessage(`Move the unit’s ${ductType} plenum closer to a ${ductType} run endpoint, then attach`);
      return;
    }
    setHistory(drawings.map((drawing) => {
      if (drawing.id === connection.run.id) {
        const endpointIndex = connection.end === "start" ? 0 : drawing.points.length - 1;
        return { ...drawing, points: drawing.points.map((point, index) => index === endpointIndex ? { ...connection.portPoint } : point) };
      }
      if (drawing.id !== selected.id || !drawing.symbol) return drawing;
      return {
        ...drawing,
        symbol: ductType === "supply"
          ? { ...drawing.symbol, connectedRunId: connection.run.id, connectedEnd: connection.end }
          : { ...drawing.symbol, returnRunId: connection.run.id, returnEnd: connection.end },
      };
    }));
    setBranchMessage(`Unit ${ductType} run attached to the ${ductType} plenum · ${connection.run.size}″ connection saved`);
  }

  function detachSelectedEquipment(ductType: "supply" | "return" = "supply") {
    const selected = drawings.find((drawing) => drawing.id === selectedId && drawing.symbol?.kind === "equipment");
    const runId = ductType === "supply" ? selected?.symbol?.connectedRunId : selected?.symbol?.returnRunId;
    if (!selected?.symbol || !runId) return;
    setHistory(drawings.map((drawing) => drawing.id === selected.id ? {
      ...drawing,
      symbol: ductType === "supply"
        ? { ...drawing.symbol!, connectedRunId: undefined, connectedEnd: undefined }
        : { ...drawing.symbol!, returnRunId: undefined, returnEnd: undefined },
    } : drawing));
    setBranchMessage(`Unit ${ductType} run detached · duct and equipment remain in place`);
  }

  function syncConnectedTerminals(current: Drawing[], runIds?: string[]) {
    const next = current.map((drawing) => ({ ...drawing }));
    const runIndex = new Map(next
      .map((drawing, index) => ({ drawing, index }))
      .filter(({ drawing }) => !drawing.fitting && !drawing.symbol)
      .map(({ drawing, index }) => [drawing.id, index]));
    next.filter(isPrimaryAirflowEquipment).forEach((equipment) => {
      if (!equipment.symbol) return;
      const ports = equipmentPlenumPorts(equipment);
      let symbol = { ...equipment.symbol };
      ([
        { ductType: "supply" as const, runId: symbol.connectedRunId, end: symbol.connectedEnd, port: ports.supply },
        { ductType: "return" as const, runId: symbol.returnRunId, end: symbol.returnEnd, port: ports.return },
      ]).forEach((binding) => {
        if (!binding.runId) return;
        const index = runIndex.get(binding.runId);
        if (index === undefined) {
          symbol = binding.ductType === "supply"
            ? { ...symbol, connectedRunId: undefined, connectedEnd: undefined }
            : { ...symbol, returnRunId: undefined, returnEnd: undefined };
          return;
        }
        if (runIds && !runIds.includes(binding.runId)) return;
        const run = next[index];
        const endpointIndex = binding.end === "start" ? 0 : run.points.length - 1;
        next[index] = { ...run, points: run.points.map((point, pointIndex) => pointIndex === endpointIndex ? { ...binding.port } : point) };
      });
      const equipmentIndex = next.findIndex((drawing) => drawing.id === equipment.id);
      next[equipmentIndex] = { ...equipment, symbol };
    });
    const runs = new Map(next.filter((drawing) => !drawing.fitting && !drawing.symbol).map((drawing) => [drawing.id, drawing]));
    return next.map((drawing) => {
      if (isPrimaryAirflowEquipment(drawing)) return drawing;
      const runId = drawing.symbol?.connectedRunId;
      if (!runId || (runIds && !runIds.includes(runId))) return drawing;
      const run = runs.get(runId);
      if (!run) return { ...drawing, symbol: { ...drawing.symbol!, connectedRunId: undefined, connectedEnd: undefined } };
      const endpoint = drawing.symbol?.connectedEnd === "start" ? run.points[0] : run.points[run.points.length - 1];
      return { ...drawing, points: [{ ...endpoint }] };
    });
  }

  function rotateSelectedSymbol(delta: number) {
    const selected = drawings.find((drawing) => drawing.id === selectedId);
    if (!selected?.symbol) return;
    updateSelectedSymbol({ rotation: (selected.symbol.rotation + delta + 360) % 360 });
  }

  function nudgeSelection(dx: number, dy: number) {
    if (!selectedIds.length) return;
    const fittingSelected = selectedIds.some((id) => drawings.find((drawing) => drawing.id === id)?.fitting);
    const ids = fittingSelected ? connectedSelection(selectedIds) : selectedIds;
    const movable = ids.filter((id) => !drawingLocked(drawings.find((drawing) => drawing.id === id)));
    if (!movable.length) return;
    let moved = drawings.map((drawing) => movable.includes(drawing.id)
      ? { ...drawing, points: drawing.points.map((point) => ({ x: point.x + dx, y: point.y + dy })) }
      : drawing);
    movable.forEach((id) => {
      const drawing = moved.find((item) => item.id === id);
      if (drawing && !drawing.fitting && !drawing.symbol && drawing.type !== "measurement") {
        moved = repairFittingsAfterRunEdit(moved, id).drawings;
      }
    });
    moved = syncConnectedTerminals(moved, movable);
    setHistory(moved);
    setBranchMessage(`Nudged ${movable.length} object${movable.length === 1 ? "" : "s"} · ${Math.hypot(dx, dy).toFixed(0)} plan units`);
  }

  function startPointDrag(event: PointerEvent<SVGCircleElement>, drawingId: string, pointIndex: number) {
    if (activeTool !== "select" || event.button !== 0 || drawingLocked(drawings.find((drawing) => drawing.id === drawingId))) return;
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

  function startMidpointStretch(event: PointerEvent<SVGCircleElement>, drawingId: string, segmentIndex: number) {
    const drawing = drawings.find((item) => item.id === drawingId);
    if (activeTool !== "select" || event.button !== 0 || !drawing || drawingLocked(drawing)) return;
    event.stopPropagation();
    const a = drawing.points[segmentIndex];
    const b = drawing.points[segmentIndex + 1];
    const midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const nextPoints = [...drawing.points.slice(0, segmentIndex + 1), midpoint, ...drawing.points.slice(segmentIndex + 1)];
    event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId);
    dragRef.current = { kind: "point", drawingId, pointIndex: segmentIndex + 1, before: drawings };
    setDrawings((current) => current.map((item) => item.id === drawingId ? { ...item, points: nextPoints } : item));
    selectOnly(drawingId);
    setActiveSystem(drawingSystem(drawing));
    setBranchMessage("Stretch grip inserted · drag to shape the run");
  }

  function startLineDrag(event: PointerEvent<SVGPathElement>, drawing: Drawing) {
    if (activeTool !== "select" || event.button !== 0 || drawingLocked(drawing)) return;
    event.stopPropagation();
    if (splitMode) {
      splitRunAtPoint(drawing, canvasPoint(event as unknown as PointerEvent<SVGSVGElement>));
      return;
    }
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

  function startRunLabelDrag(event: PointerEvent<SVGTextElement>, drawing: Drawing) {
    if (activeTool !== "select" || event.button !== 0 || drawingLocked(drawing)) return;
    event.stopPropagation();
    event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId);
    dragRef.current = {
      kind: "label",
      drawingId: drawing.id,
      start: canvasPoint(event as unknown as PointerEvent<SVGSVGElement>),
      originalOffset: drawing.labelOffset || { x: 0, y: 0 },
      before: drawings,
    };
    selectOnly(drawing.id);
    setActiveSystem(drawingSystem(drawing));
    setBranchMessage("Drag the duct-size label to a clear location");
  }

  function startFittingDrag(event: PointerEvent<SVGGElement>, drawing: Drawing) {
    if (activeTool !== "select" || !drawing.fitting || event.button !== 0 || drawingLocked(drawing)) return;
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
    if (activeTool !== "select" || !drawing.symbol || event.button !== 0 || drawingLocked(drawing)) return;
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

  function normalizedSymbolScale(value?: number) {
    return Math.max(.4, Math.min(3, Number(value) || 1));
  }

  function symbolResizeBounds(drawing: Drawing) {
    const dimensions = symbolDimensions(drawing.size);
    const variant = drawing.symbol?.variant || "";
    if (drawing.symbol?.kind === "equipment") {
      return ["vertical-air-handler", "vertical-furnace"].includes(variant)
        ? { width: 58, height: 92 }
        : { width: 82, height: 58 };
    }
    if (drawing.symbol?.kind === "fan") return { width: 54, height: 54 };
    return {
      width: Math.max(20, dimensions.width),
      height: Math.max(16, dimensions.height),
    };
  }

  function startSymbolResize(event: PointerEvent<SVGRectElement>, drawing: Drawing) {
    if (activeTool !== "select" || !drawing.symbol || event.button !== 0 || drawingLocked(drawing)) return;
    event.stopPropagation();
    event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId);
    const bounds = symbolResizeBounds(drawing);
    dragRef.current = {
      kind: "symbol-resize",
      drawingId: drawing.id,
      center: drawing.points[0],
      rotation: drawing.symbol.rotation,
      halfWidth: bounds.width / 2,
      halfHeight: bounds.height / 2,
      before: drawings,
    };
    selectOnly(drawing.id);
    setActiveSystem(drawingSystem(drawing));
    setBranchMessage("Drag the corner to stretch the icon · hold Shift to keep its proportions");
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
        const result = snapResult(raw, drag.drawingId);
        const point = result?.point || raw;
        setSnapMarker(point.x !== raw.x || point.y !== raw.y ? point : null);
        setSnapInfo(result);
        setAlignmentGuides(guidesFor(point, drag.drawingId));
        setDrawings((current) => {
          const moved = current.map((drawing) => drawing.id === drag.drawingId
            ? { ...drawing, points: drawing.points.map((oldPoint, index) => index === drag.pointIndex ? point : oldPoint) }
            : drawing);
          return syncConnectedTerminals(moved, [drag.drawingId]);
        });
      } else {
        if (drag.kind === "line") {
          const dx = raw.x - drag.start.x;
          const dy = raw.y - drag.start.y;
          setDrawings((current) => {
            const moved = current.map((drawing) => drawing.id === drag.drawingId
              ? { ...drawing, points: drag.original.map((point) => ({ x: point.x + dx, y: point.y + dy })) }
              : drawing);
            return syncConnectedTerminals(moved, [drag.drawingId]);
          });
        } else if (drag.kind === "label") {
          const dx = raw.x - drag.start.x;
          const dy = raw.y - drag.start.y;
          setDrawings((current) => current.map((drawing) =>
            drawing.id === drag.drawingId
              ? { ...drawing, labelOffset: { x: drag.originalOffset.x + dx, y: drag.originalOffset.y + dy } }
              : drawing
          ));
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
        } else if (drag.kind === "symbol-resize") {
          const radians = drag.rotation * Math.PI / 180;
          const dx = raw.x - drag.center.x;
          const dy = raw.y - drag.center.y;
          const localX = dx * Math.cos(radians) + dy * Math.sin(radians);
          const localY = -dx * Math.sin(radians) + dy * Math.cos(radians);
          let scaleX = normalizedSymbolScale(Math.abs(localX) / Math.max(1, drag.halfWidth));
          let scaleY = normalizedSymbolScale(Math.abs(localY) / Math.max(1, drag.halfHeight));
          if (event.shiftKey) {
            const uniformScale = Math.max(scaleX, scaleY);
            scaleX = uniformScale;
            scaleY = uniformScale;
          }
          setDrawings((current) => {
            const next = current.map((drawing) =>
              drawing.id === drag.drawingId && drawing.symbol
                ? { ...drawing, symbol: { ...drawing.symbol, scaleX, scaleY } }
                : drawing
            );
            const equipment = next.find((drawing) => drawing.id === drag.drawingId);
            const connectionIds = [equipment?.symbol?.connectedRunId, equipment?.symbol?.returnRunId].filter((id): id is string => Boolean(id));
            return isPrimaryAirflowEquipment(equipment) ? syncConnectedTerminals(next, connectionIds) : next;
          });
        } else if (drag.kind === "symbol") {
          const result = snapResult(raw, drag.drawingId);
          const nextPoint = result?.point || raw;
          setSnapMarker(nextPoint.x !== raw.x || nextPoint.y !== raw.y ? nextPoint : null);
          setSnapInfo(result);
          setAlignmentGuides(guidesFor(nextPoint, drag.drawingId));
          setDrawings((current) => {
            const movedSymbol = current.find((drawing) => drawing.id === drag.drawingId);
            const next = current.map((drawing) => drawing.id === drag.drawingId ? { ...drawing, points: [nextPoint] } : drawing);
            const connectionIds = [movedSymbol?.symbol?.connectedRunId, movedSymbol?.symbol?.returnRunId].filter((id): id is string => Boolean(id));
            return syncConnectedTerminals(next, connectionIds);
          });
        } else if (drag.kind === "group") {
          const dx = raw.x - drag.start.x;
          const dy = raw.y - drag.start.y;
          setDrawings((current) => {
            const moved = current.map((drawing) => {
            const original = drag.originals[drawing.id];
            return original
              ? { ...drawing, points: original.map((point) => ({ x: point.x + dx, y: point.y + dy })) }
              : drawing;
            });
            return syncConnectedTerminals(moved, drag.ids);
          });
        }
      }
      return;
    }
    if (activeTool === "branch") {
      if (pendingBranchFittingId) {
        const fitting = drawings.find((drawing) => drawing.id === pendingBranchFittingId && drawing.fitting);
        const candidate = nearestAttachableSupplySegment(raw, pendingBranchFittingId);
        if (!fitting?.fitting) {
          setPendingBranchFittingId(null);
          setBranchPreview(null);
          return;
        }
        const candidateReady = Boolean(candidate && candidate.distance <= 48 / zoom);
        const branchAngle = candidateReady ? candidate!.angle : fitting.fitting.branchAngle;
        const side = candidateReady ? candidate!.side : fitting.fitting.side;
        const style = candidateReady && branchStyle === "auto"
          ? automaticBranchStyle(fitting.fitting.angle, candidate!.angle)
          : branchStyle === "auto" ? fitting.fitting.style : branchStyle;
        setBranchPreview({
          center: fitting.points[0],
          angle: fitting.fitting.angle,
          branchAngle,
          side,
          style,
          parentSize: fitting.fitting.upstreamSize,
          valid: candidateReady,
          matchedExisting: candidateReady,
          mainRunId: fitting.fitting.connectedIds[0],
          branchRunId: candidateReady ? candidate!.drawing.id : undefined,
          runIds: fitting.fitting.connectedIds.filter(Boolean),
          mode: "attach-run",
          candidateEndpoint: candidateReady ? candidate!.drawing.points[candidate!.endpointIndex] : undefined,
          candidateProjected: candidateReady ? candidate!.point : undefined,
          candidateEndpointDistance: candidateReady
            ? Math.hypot(
              candidate!.drawing.points[candidate!.endpointIndex].x - fitting.points[0].x,
              candidate!.drawing.points[candidate!.endpointIndex].y - fitting.points[0].y,
            )
            : undefined,
        });
        setSnapMarker(candidateReady ? candidate!.point : null);
        setBranchMessage(candidateReady
          ? `Run selected · click to attach ${candidate!.drawing.size}″ duct to open Port 3`
          : "Fitting placed · click directly on any blue branch run to finish");
        return;
      }
      if (branchWorkflow === "run-first" && !queuedBranchRunId) {
        const candidate = nearestSupplySegment(raw);
        const candidateReady = Boolean(candidate && candidate.distance <= 42 / zoom);
        setBranchHoverRunId(candidateReady ? candidate!.drawing.id : null);
        setBranchPreview(null);
        setSnapMarker(candidateReady ? candidate!.point : null);
        setBranchMessage(candidateReady
          ? `Click this ${candidate!.drawing.size}″ run to arm it for Port 3`
          : "Step 1 · move over the completed blue run going to the diffuser");
        return;
      }
      setBranchHoverRunId(null);
      const threeRunMatch = queuedBranchRunId ? null : existingThreeRunJunction(raw);
      if (threeRunMatch) {
        const runIds = threeRunMatch.ports.map((match) => match.drawing.id);
        setBranchPreview({
          center: threeRunMatch.center,
          angle: threeRunMatch.angle,
          branchAngle: threeRunMatch.branchAngle,
          side: threeRunMatch.side,
          style: threeRunMatch.style,
          parentSize: threeRunMatch.ports[0].drawing.size,
          valid: true,
          matchedExisting: true,
          mainRunId: runIds[0],
          branchRunId: runIds[2],
          runIds,
          mode: "three-runs",
        });
        setSnapMarker(threeRunMatch.center);
        setBranchMessage("3 separate run endpoints found · click to connect Ports 1, 2 and 3");
        return;
      }
      const rawTarget = nearestSupplySegment(raw);
      if (rawTarget && rawTarget.distance <= 42 / zoom) {
        if (queuedBranchRunId && rawTarget.drawing.id === queuedBranchRunId) {
          setBranchPreview(null);
          setSnapMarker(rawTarget.point);
          setBranchMessage("Branch run is armed · move to the main trunk and click where the T/Y belongs");
          return;
        }
        const target = orientMainTowardAirflow(rawTarget);
        const matchedRoute = queuedBranchRunId
          ? queuedBranchRoute(target.point, target.drawing.id, target.angle)
          : existingBranchRoute(target.point, target.drawing.id, target.angle);
        if (queuedBranchRunId && !matchedRoute) {
          setBranchPreview(null);
          setSnapMarker(target.point);
          return;
        }
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
          valid: true,
          matchedExisting: Boolean(matchedRoute),
          mainRunId: target.drawing.id,
          branchRunId: matchedRoute?.drawing.id,
          runIds: [target.drawing.id, ...(matchedRoute ? [matchedRoute.drawing.id] : [])],
          mode: "split-trunk",
        });
        setSnapMarker(target.point);
        setBranchMessage(queuedBranchRunId && matchedRoute
          ? "Branch run armed · click this trunk location to split, rotate, size and connect the T/Y"
          : matchedRoute
            ? "3-run connection found · click to insert fitting"
            : "Main run found · click to split it and place the fitting anywhere");
      } else {
        setBranchPreview(null);
        setSnapMarker(null);
        setBranchMessage("Move over a blue supply run");
      }
      return;
    }
    if (symbolTools.includes(activeTool as SymbolKind)) {
      const result = snapResult(raw);
      const point = result?.point || raw;
      setSymbolPreview({ kind: activeTool as SymbolKind, point });
      setSnapMarker(point.x !== raw.x || point.y !== raw.y ? point : null);
      setSnapInfo(result);
      setAlignmentGuides(guidesFor(point));
      return;
    }
    if (["supply", "return", "fresh"].includes(activeTool)) {
      const result = snapResult(raw);
      let point = result?.point || raw;
      if (event.shiftKey && draft.length) point = constrainToDraftAngle(draft[draft.length - 1], point);
      setHoverPoint(point);
      setSnapMarker(point.x !== raw.x || point.y !== raw.y ? point : null);
      setSnapInfo(result);
      setAlignmentGuides(guidesFor(point));
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
        const crossing = selectionBox.end.x < selectionBox.start.x;
        const hits = drawings.filter((drawing) => {
          if (drawing.page !== pageNumber || drawingLocked(drawing)) return false;
          const xs = drawing.points.map((point) => point.x);
          const ys = drawing.points.map((point) => point.y);
          return crossing
            ? Math.max(...xs) >= minX && Math.min(...xs) <= maxX && Math.max(...ys) >= minY && Math.min(...ys) <= maxY
            : Math.min(...xs) >= minX && Math.max(...xs) <= maxX && Math.min(...ys) >= minY && Math.max(...ys) <= maxY;
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
        return syncConnectedTerminals(linkRunToMatchingEquipmentPlenum(result.drawings, drag.drawingId), [drag.drawingId]);
      });
    } else if (drag.kind === "symbol") {
      setDrawings((current) => {
        const symbol = current.find((drawing) => drawing.id === drag.drawingId);
        const runIds = [symbol?.symbol?.connectedRunId, symbol?.symbol?.returnRunId].filter((id): id is string => Boolean(id));
        if (!runIds.length) return current;
        let next = current;
        runIds.forEach((runId) => {
          next = repairFittingsAfterRunEdit(next, runId).drawings;
        });
        return syncConnectedTerminals(next, runIds);
      });
    } else if (drag.kind === "symbol-resize") {
      setBranchMessage("Icon resized visually · scheduled face and neck sizes were not changed");
    } else if (drag.kind === "label") {
      setBranchMessage("Duct-size label repositioned · route geometry was not changed");
    }
    dragRef.current = null;
    setSnapMarker(null);
    setSnapInfo(null);
    setAlignmentGuides([]);
  }

  function renderSymbol(drawing: Drawing, preview = false) {
    if (!drawing.symbol) return null;
    const center = drawing.points[0];
    const { kind, label, rotation, variant } = drawing.symbol;
    const formattedSize = drawing.size.replace(/x/g, "×");
    const defaultTerminalLabel = kind === "returnGrille"
      ? `${formattedSize} RETURN`
      : `${formattedSize} SUPPLY`;
    const usesCatalogLabel = ["diffuser", "returnGrille"].includes(kind) && symbolPresets.some((preset) =>
      preset.kind === kind &&
      preset.variant === variant &&
      preset.label === label
    );
    const displayLabel = ["diffuser", "returnGrille"].includes(kind)
      ? usesCatalogLabel ? defaultTerminalLabel : label.trim() || defaultTerminalLabel
      : label;
    const selected = isSelected(drawing.id);
    const { width: symbolWidth, height: symbolHeight } = symbolDimensions(drawing.size);
    const grilleLines = Array.from({ length: Math.max(3, Math.min(8, Math.round(symbolWidth / 5))) }, (_, index) =>
      -symbolWidth / 2 + ((index + 1) * symbolWidth) / (Math.max(3, Math.min(8, Math.round(symbolWidth / 5))) + 1));
    const artworkClass = `hvac-symbol symbol-${kind} variant-${variant || "standard"} ${drawing.symbol.connectedRunId ? "terminal-linked" : ""} ${activeTraceSymbolIds.has(drawing.id) ? "traced-symbol" : ""} ${preview ? "symbol-preview" : ""} ${selected ? "selected-symbol" : ""}`;
    const verticalEquipment = kind === "equipment" && ["vertical-air-handler", "vertical-furnace"].includes(variant || "");
    const labelY = kind === "equipment"
      ? verticalEquipment ? -52 : -44
      : kind === "fan"
        ? -31
        : kind === "airflow"
          ? -12
          : ["diffuser", "returnGrille"].includes(kind)
            ? -symbolHeight / 2 - 10
            : -22;
    const interactionRadius = kind === "equipment" ? verticalEquipment ? 47 : 43 : kind === "fan" ? 31 : 25;
    const scaleX = normalizedSymbolScale(drawing.symbol.scaleX);
    const scaleY = normalizedSymbolScale(drawing.symbol.scaleY);
    const resizeBounds = symbolResizeBounds(drawing);
    const labelPositionY = labelY - (scaleY - 1) * resizeBounds.height / 2;
    if (variant !== "__legacy") return <g
      className={artworkClass}
      transform={`translate(${center.x} ${center.y}) rotate(${rotation})`}
      onPointerDown={preview ? undefined : (event) => startSymbolDrag(event, drawing)}
    >
      <g className="symbol-visual" transform={`scale(${scaleX} ${scaleY})`}>
        <circle className="symbol-hit" cx="0" cy="0" r={interactionRadius} />
        <SymbolArtwork kind={kind} variant={variant} width={symbolWidth} height={symbolHeight} />
        {selected && isPrimaryAirflowEquipment(drawing) && (() => {
          const ports = equipmentPlenumPorts(drawing).local;
          return <>
            <circle className="equipment-plenum-port return-port" cx={ports.return.x} cy={ports.return.y} r="4.2" />
            <circle className="equipment-plenum-port supply-port" cx={ports.supply.x} cy={ports.supply.y} r="4.2" />
          </>;
        })()}
        {["diffuser", "returnGrille"].includes(kind) && <>
          <circle className="can-neck-point" cx="0" cy="0" r="3.5" />
          {drawing.symbol.connectedRunId && <circle className="terminal-link-ring" cx="0" cy="0" r="6" />}
          {selected && <text className="can-neck-label" x="6" y="4">Ø{drawing.symbol.neckSize || "8"} NECK</text>}
        </>}
        {selected && <circle className="rotation-ring" cx="0" cy="0" r={interactionRadius} />}
      </g>
      <text className="symbol-label" x="0" y={labelPositionY} textAnchor="middle">{displayLabel}</text>
      {selected && !preview && <>
        <rect
          className="symbol-resize-outline"
          x={-resizeBounds.width * scaleX / 2}
          y={-resizeBounds.height * scaleY / 2}
          width={resizeBounds.width * scaleX}
          height={resizeBounds.height * scaleY}
        />
        {([[-1, -1], [1, -1], [1, 1], [-1, 1]] as const).map(([cornerX, cornerY]) => <rect
          className="symbol-resize-handle"
          key={`${cornerX}-${cornerY}`}
          x={cornerX * resizeBounds.width * scaleX / 2 - 3.5}
          y={cornerY * resizeBounds.height * scaleY / 2 - 3.5}
          width="7"
          height="7"
          rx="1.4"
          onPointerDown={(event) => startSymbolResize(event, drawing)}
        />)}
      </>}
    </g>;

    // Compatibility renderer for any deliberately imported legacy symbol variant.
    return <g
      className={`hvac-symbol symbol-${kind} ${drawing.symbol.connectedRunId ? "terminal-linked" : ""} ${activeTraceSymbolIds.has(drawing.id) ? "traced-symbol" : ""} ${preview ? "symbol-preview" : ""} ${selected ? "selected-symbol" : ""}`}
      transform={`translate(${center.x} ${center.y}) rotate(${rotation})`}
      onPointerDown={preview ? undefined : (event) => startSymbolDrag(event, drawing)}
    >
      <circle className="symbol-hit" cx="0" cy="0" r="24" />
      {kind === "diffuser" && variant === "round" ? <>
        <circle cx="0" cy="0" r="11" /><circle cx="0" cy="0" r="6" /><path d="M -8 0 L 8 0 M 0 -8 L 0 8" />
      </> : kind === "diffuser" && variant === "slot" ? <>
        <rect x="-18" y="-6" width="36" height="12" rx="1" /><path d="M -14 -2 L 14 -2 M -14 2 L 14 2" />
      </> : kind === "diffuser" && ["register", "floor", "boot"].includes(variant || "") ? <>
        <rect x={-symbolWidth / 2} y={-symbolHeight / 2} width={symbolWidth} height={symbolHeight} rx={variant === "boot" ? 4 : 1} />
        {grilleLines.map((lineX, index) => <line key={index} x1={lineX} y1={-symbolHeight / 2 + 3} x2={lineX} y2={symbolHeight / 2 - 3} />)}
        {variant === "boot" && <path d={`M ${-symbolWidth / 2 + 2} ${symbolHeight / 2} L ${-symbolWidth / 2 + 6} ${symbolHeight / 2 + 5} L ${symbolWidth / 2 - 6} ${symbolHeight / 2 + 5} L ${symbolWidth / 2 - 2} ${symbolHeight / 2}`} />}
      </> : kind === "diffuser" && <>
        <rect x={-symbolWidth / 2} y={-symbolHeight / 2} width={symbolWidth} height={symbolHeight} rx="1" />
        <path d={variant === "1way" ? `M ${-symbolWidth / 2 + 3} ${symbolHeight / 2 - 3} L ${symbolWidth / 2 - 3} ${-symbolHeight / 2 + 3}` : variant === "2way" ? `M ${-symbolWidth / 2 + 3} ${symbolHeight / 2 - 3} L ${symbolWidth / 2 - 3} ${-symbolHeight / 2 + 3} M ${symbolWidth / 2 - 3} ${symbolHeight / 2 - 3} L ${-symbolWidth / 2 + 3} ${-symbolHeight / 2 + 3}` : variant === "3way" ? `M ${-symbolWidth / 2 + 3} ${symbolHeight / 2 - 3} L ${symbolWidth / 2 - 3} ${-symbolHeight / 2 + 3} M ${symbolWidth / 2 - 3} ${symbolHeight / 2 - 3} L ${-symbolWidth / 2 + 3} ${-symbolHeight / 2 + 3} M 0 ${-symbolHeight / 2 + 2} L 0 ${symbolHeight / 2 - 2}` : `M ${-symbolWidth / 2 + 3} ${-symbolHeight / 2 + 3} L ${symbolWidth / 2 - 3} ${symbolHeight / 2 - 3} M ${symbolWidth / 2 - 3} ${-symbolHeight / 2 + 3} L ${-symbolWidth / 2 + 3} ${symbolHeight / 2 - 3} M 0 ${-symbolHeight / 2 + 2} L 0 ${symbolHeight / 2 - 2} M ${-symbolWidth / 2 + 2} 0 L ${symbolWidth / 2 - 2} 0`} />
      </>}
      {kind === "returnGrille" && <>
        <rect x={-symbolWidth / 2} y={-symbolHeight / 2} width={symbolWidth} height={symbolHeight} rx={variant === "filter" ? 3 : 1} />
        {variant === "eggcrate"
          ? <>{grilleLines.map((lineX, index) => <line key={`v-${index}`} x1={lineX} y1={-symbolHeight / 2 + 2} x2={lineX} y2={symbolHeight / 2 - 2} />)}{[-.25, 0, .25].map((amount, index) => <line key={`h-${index}`} x1={-symbolWidth / 2 + 2} y1={amount * symbolHeight} x2={symbolWidth / 2 - 2} y2={amount * symbolHeight} />)}</>
          : variant === "transfer"
            ? <path d={`M ${-symbolWidth / 2 + 3} ${-symbolHeight / 4} L ${symbolWidth / 2 - 3} ${-symbolHeight / 4} M ${-symbolWidth / 2 + 3} ${symbolHeight / 4} L ${symbolWidth / 2 - 3} ${symbolHeight / 4}`} />
            : variant === "floor"
              ? grilleLines.map((lineX, index) => <line key={index} x1={lineX} y1={-symbolHeight / 2 + 2} x2={lineX + 3} y2={symbolHeight / 2 - 2} />)
              : grilleLines.map((lineX, index) => <line key={index} x1={lineX} y1={-symbolHeight / 2 + 3} x2={lineX} y2={symbolHeight / 2 - 3} />)}
        {variant === "filter" && <rect x={-symbolWidth / 2 + 3} y={-symbolHeight / 2 + 3} width={symbolWidth - 6} height={symbolHeight - 6} rx="1" />}
      </>}
      {["diffuser", "returnGrille"].includes(kind) && <>
        <circle className="can-neck-point" cx="0" cy="0" r="3.5" />
        {drawing.symbol.connectedRunId && <circle className="terminal-link-ring" cx="0" cy="0" r="6" />}
        {selected && <text className="can-neck-label" x="6" y="4">Ø{drawing.symbol.neckSize || "8"} NECK</text>}
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
      <text className="symbol-label" x="0" y={kind === "equipment" ? -27 : kind === "airflow" ? -10 : ["diffuser", "returnGrille"].includes(kind) ? -symbolHeight / 2 - 7 : -16} textAnchor="middle">{displayLabel}</text>
      {selected && <circle className="rotation-ring" cx="0" cy="0" r="23" />}
    </g>;
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const key = event.key.toLowerCase();
      if (showCommandPalette) {
        if (event.key === "Escape" || ((event.ctrlKey || event.metaKey) && key === "k")) {
          event.preventDefault();
          setShowCommandPalette(false);
        }
        return;
      }
      if (showProjectSetup) {
        if (event.key === "Escape") {
          event.preventDefault();
          setShowProjectSetup(false);
        }
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && key === "h") {
        event.preventDefault();
        setShowProjectHome(true);
        return;
      }
      if (showProjectHome) {
        if ((event.ctrlKey || event.metaKey) && key === "k") {
          event.preventDefault();
          setShowCommandPalette(true);
          return;
        }
        if (event.key === "Escape" && pdf) {
          event.preventDefault();
          setShowProjectHome(false);
        }
        return;
      }
      if (showCloudProjects) {
        if (event.key === "Escape") {
          event.preventDefault();
          setShowCloudProjects(false);
        }
        return;
      }
      if ((event.ctrlKey || event.metaKey) && key === "k") {
        event.preventDefault();
        setShowCommandPalette((visible) => !visible);
        return;
      }
      if (target?.matches("input, select, textarea")) return;
      if (event.key === "Escape") {
        setShowCommandPalette(false);
        setDraft([]);
        setContinuingRunId(null);
        setPendingBranchFittingId(null);
        setQueuedBranchRunId(null);
        setBranchHoverRunId(null);
        setBranchPreview(null);
        setHoverPoint(null);
        setSnapMarker(null);
        setMeasureDraft([]);
        setCalibrating(false);
        setShowSheetNavigator(false);
        setSplitMode(false);
        selectOnly(null);
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteSelected();
      }
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
      if (selectedIds.length && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        nudgeSelection(
          event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0,
          event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0,
        );
      }
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
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
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
  const symbolTrace = symbolNetworkTrace(selectedDrawing?.symbol ? selectedDrawing : undefined);
  const activeTrace = selectedFitting ? branchTrace : selectedRun ? runTrace : symbolTrace;
  const activeTraceSymbolIds = "symbolIds" in activeTrace ? activeTrace.symbolIds : new Set<string>();
  const activeAirflowSetup = airflowSetupSummary();
  const branchOpportunityList = activeTool === "branch" ? branchOpportunities() : [];
  const pageBranchFittings = drawings.filter((drawing) => drawing.page === pageNumber && drawing.fitting);
  const assignedBranchRunIds = new Set(pageBranchFittings.flatMap((fitting) => fitting.fitting?.connectedIds.filter(Boolean) || []));
  const diffuserTerminalRunIds = new Set(drawings
    .filter((drawing) =>
      drawing.page === pageNumber &&
      drawingSystem(drawing) === activeSystem &&
      drawing.symbol?.kind === "diffuser" &&
      drawing.symbol.connectedRunId
    )
    .map((drawing) => drawing.symbol!.connectedRunId!));
  const runFirstCandidateRuns = drawings.filter((drawing) =>
    drawing.page === pageNumber &&
    drawingSystem(drawing) === activeSystem &&
    drawing.type === "supply" &&
    !drawing.fitting &&
    diffuserTerminalRunIds.has(drawing.id) &&
    !assignedBranchRunIds.has(drawing.id)
  );
  const queuedBranchRun = drawings.find((drawing) => drawing.id === queuedBranchRunId);
  const openBranchPorts = pageBranchFittings.reduce((total, fitting) =>
    total + Math.max(0, 3 - (fitting.fitting?.connectedIds.filter(Boolean).length || 0)), 0);
  const liveDraftPoints = [...draft, ...(hoverPoint ? [hoverPoint] : [])];
  const liveDraftFeet = liveDraftPoints.length > 1
    ? liveDraftPoints.slice(1).reduce((total, point, index) => total + Math.hypot(point.x - liveDraftPoints[index].x, point.y - liveDraftPoints[index].y), 0) * scaleFeetPerUnit
    : 0;
  const liveDraftCfm = defaultCfm(ductSize);
  const liveDraftVelocity = velocityFpm(ductSize, liveDraftCfm);
  const activeReviewRow = rightTab === "checks" ? activeReviewedIssueRows.find((row) => row.issue.id === activeReviewIssueId) : undefined;
  const activeProjectCommand = projectCommandSnapshot || {
    rows: [],
    designReady: 0,
    fieldReady: 0,
    commissioned: 0,
    closeoutReady: 0,
    openPunches: 0,
    openRfis: 0,
    progress: 0,
  };
  const activeWorkflow = buildSystemWorkflow({
    runs: activeBuilderSummary.runs.length,
    fittings: activeBuilderSummary.fittings.length,
    devices: activeBuilderSummary.devices.length,
    openConnections: activeBuilderSummary.unconnectedDevices,
    brokenPorts: activeBuilderSummary.brokenPorts,
    hasPrimaryUnit: Boolean(activeAirflowSetup.primaryUnit),
    airflowBalanced: activeAirflowSetup.supplyBalanced && activeAirflowSetup.returnBalanced,
    sizingReviews: activeBuilderSummary.sizing.length,
    criticalIssues: activeBuilderSummary.audit.counts.critical,
    warningIssues: activeBuilderSummary.audit.counts.warning,
    releaseReady: activeFieldPackage.gatesClear,
    released: activeFieldPackage.released,
    releaseStale: activeFieldPackage.stale,
  });
  const activeFieldRuns = activeFieldPackage.runs;
  const projectCommands: ProjectCommand[] = [
    {
      id: "project-home",
      label: "Open Project Home",
      detail: "Recent projects, coordination priorities, source plans, and guided setup",
      group: "Project",
      shortcut: "⇧H",
      keywords: "home dashboard recent projects onboarding",
      run: () => setShowProjectHome(true),
    },
    {
      id: "project-hub",
      label: "Open Project Intelligence Hub",
      detail: "Readiness, work, approvals, files, people, and immutable revisions",
      group: "Project",
      shortcut: "P",
      keywords: "cloud command center dashboard collaboration",
      run: () => setShowCloudProjects(true),
    },
    {
      id: "continue-work",
      label: activeWorkflow.nextAction,
      detail: `${systemLabel(activeSystem)} · continue the next safe system step`,
      group: "Project",
      shortcut: "↵",
      run: () => continueSystemWorkflow(activeWorkflow.activeStage),
    },
    {
      id: "supply-run",
      label: "Start a supply run",
      detail: `Draw a ${ductSize}" supply route on the active sheet`,
      group: "Draw",
      shortcut: "S",
      run: () => { finishDrawing(); setActiveTool("supply"); },
    },
    {
      id: "return-run",
      label: "Start a return run",
      detail: `Draw a ${ductSize}" return route on the active sheet`,
      group: "Draw",
      shortcut: "R",
      run: () => { finishDrawing(); setActiveTool("return"); },
    },
    {
      id: "branch-pass",
      label: "Start the run-first T/Y branch pass",
      detail: "Draw routes first, then split and attach each reviewed fitting",
      group: "Draw",
      shortcut: "B",
      run: () => { finishDrawing(); setBranchWorkflow("run-first"); setActiveTool("branch"); },
    },
    {
      id: "airflow",
      label: "Open system airflow and balancing",
      detail: "Review tonnage, scheduled CFM, returns, and proposed sizes",
      group: "Systems",
      run: () => openSystemBalanceWorkspace("system"),
    },
    {
      id: "plan-review",
      label: "Run the HVAC plan review",
      detail: "Prioritized, explainable findings with hard field-release gates",
      group: "Review",
      run: openSystemAuditWorkflow,
    },
    {
      id: "field-release",
      label: "Open Field Release Center",
      detail: "Installation package, RFI, punch, startup, and named approval",
      group: "Field",
      run: () => { setRightPanelOpen(true); setRightTab("field"); setFieldView("release"); },
    },
    {
      id: "sheets",
      label: "Open sheet navigator",
      detail: pdf ? `Jump across ${pdf.numPages} construction sheet${pdf.numPages === 1 ? "" : "s"}` : "Import a PDF to activate sheets",
      group: "Navigate",
      disabled: !pdf,
      run: () => setShowSheetNavigator(true),
    },
    {
      id: "drive",
      label: "Open a source plan from Google Drive",
      detail: "Choose an authorized PDF using the connected Google app",
      group: "Project",
      run: () => void openFromDrive(),
    },
    ...systems.filter((system) => systemStats(system.id).objects > 0).map((system): ProjectCommand => ({
      id: `system-${system.id}`,
      label: `Go to ${systemLabel(system.id)}`,
      detail: `${systemStats(system.id).designCfm} design CFM · ${systemStats(system.id).balanced ? "balanced" : "review airflow"}`,
      group: "Systems",
      keywords: system.id,
      run: () => { setActiveSystem(system.id); setSelectedId(null); },
    })),
  ];

  return (
    <main className={`app-shell ${fieldMode ? "field-mode" : ""} ${leftPanelOpen ? "" : "left-closed"} ${rightPanelOpen ? "" : "right-closed"} ${showCloudProjects ? "cloud-open" : ""} ${showProjectHome ? "project-home-open" : ""} ${["rooms", "checks", "field"].includes(rightTab) && rightPanelOpen ? "wide-inspector" : ""}`}>
      <header className="topbar" inert={showProjectHome || showProjectSetup ? true : undefined} aria-hidden={showProjectHome || showProjectSetup}>
        <button className="brand" onClick={() => setShowProjectHome(true)} aria-label="Open Project Home">
          <div className="brand-mark"><Wind size={23} strokeWidth={2.4} /></div>
          <div>
            <strong>HVAC Plan Studio</strong>
            <span>Delivery operating system</span>
          </div>
        </button>

        <div className="project-name">
          <div className="project-breadcrumb">
            <span><HomeIcon size={13} /> Projects</span>
            <i>/</i>
            <strong>{fileName}</strong>
          </div>
          <div className="project-context-row">
            <select className="system-switcher" aria-label="Active HVAC system" value={activeSystem} onChange={(event) => { setActiveSystem(event.target.value); setSelectedId(null); }}>
              {systems.map((system) => <option key={system.id} value={system.id}>{systemLabel(system.id)}</option>)}
            </select>
            <span className={`project-readiness ${workingCloudRevisionId ? "cloud" : "local"}`}>
              <i /> {workingCloudRevisionId ? `Cloud R${cloudProjectRisk?.latestRevisionNumber || "—"}` : "Local working copy"}
            </span>
          </div>
        </div>

        <nav className="top-actions" aria-label="Project actions">
          <span className={`studio-save-state ${saveState}`}>
            <i /> {saveState === "saving" ? "Saving…" : "Saved"}
          </span>
          <button className="command-button" onClick={() => setShowCommandPalette(true)} title="Open command palette · Ctrl/⌘ K">
            <Search size={16} /> <span>Command</span><kbd>⌘K</kbd>
          </button>
          <button className={`cloud-button ${showCloudProjects ? "active" : ""}`} aria-pressed={showCloudProjects} onClick={() => setShowCloudProjects(true)}>
            <Cloud size={16} /> Project Hub <span className="cloud-button-badge">{showCloudProjects ? "OPEN" : "V101"}</span>
          </button>
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
        </nav>
      </header>

      <div className="field-workflow-hud" aria-label="Field workflow controls" inert={showProjectHome || showProjectSetup ? true : undefined} aria-hidden={showProjectHome || showProjectSetup}>
        <div>
          <span>FIELD WORKFLOW · {systemLabel(activeSystem)}</span>
          <strong>{activeWorkflow.nextAction}</strong>
        </div>
        <b>{activeWorkflow.progress}%</b>
        <button className={showCfmLabels ? "active" : ""} onClick={() => setShowCfmLabels((visible) => !visible)}>CFM</button>
        <button className={showLengthLabels ? "active" : ""} onClick={() => setShowLengthLabels((visible) => !visible)}>Distance</button>
        <button className={showFittingLabels ? "active" : ""} onClick={() => setShowFittingLabels((visible) => !visible)}>T/Y text</button>
        <button onClick={() => { setFieldMode(false); continueSystemWorkflow(activeWorkflow.activeStage); }}>Open task</button>
      </div>

      <section className="print-header" inert={showProjectHome || showProjectSetup ? true : undefined} aria-hidden={showProjectHome || showProjectSetup}>
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

      <section className="workspace" inert={showProjectHome || showProjectSetup ? true : undefined} aria-hidden={showProjectHome || showProjectSetup}>
        <aside className="left-panel">
          <div className="panel-heading">
            <div><span>DESIGN TOOLS</span><small>FIELD STANDARD</small></div>
            <button aria-label="Collapse design tools" onClick={() => setLeftPanelOpen(false)}><PanelLeftClose size={17} /></button>
          </div>
          <div className="tool-list">
            {tools.filter(({ id }) => ["select", "supply", "branch", "return", "fresh"].includes(id)).map(({ id, label, icon: Icon, tone }) => (
              <button className={`tool ${activeTool === id ? "active" : ""}`} key={label} onClick={() => { finishDrawing(); setActiveTool(id); setSelectedId(null); setPendingBranchFittingId(null); setQueuedBranchRunId(null); setBranchHoverRunId(null); setBranchPreview(null); setSymbolPreview(null); }}>
                <span className={`tool-icon ${tone || ""}`}><Icon size={19} /></span>
                <span>{label}</span>
                {activeTool === id && <kbd>{id === "select" ? "V" : "●"}</kbd>}
              </button>
            ))}
            <div className={`run-size-default ${selectedRun ? "editing" : ""}`}>
              <div>
                <span>RUN SIZE</span>
                <b>{selectedRun ? `SELECTED ${selectedRun.type.toUpperCase()}` : "NEW RUN DEFAULT"}</b>
              </div>
              <select
                aria-label={selectedRun ? "Selected run size" : "Default new run size"}
                value={selectedRun?.size || ductSize}
                onChange={(event) => selectedRun ? updateSelectedSize(event.target.value) : setDuctSize(event.target.value)}
              >
                {[...runSizeOptions].reverse().map((size) => <option key={size} value={size}>{size}&quot;</option>)}
              </select>
              <small>4″–16″ in one-inch steps · selected runs update immediately.</small>
            </div>
            <div className={`branch-designer ${activeTool === "branch" ? "active" : ""}`}>
              <div className="library-title"><DraftingCompass size={14} /><span>RUN-FIRST BRANCH PASS</span><b>DRAW RUNS · THEN SPLIT</b></div>
              <div className="branch-mode-toggle" role="group" aria-label="T/Y placement workflow">
                <button className={branchWorkflow === "run-first" ? "active" : ""} onClick={() => {
                  finishDrawing();
                  setActiveTool("branch");
                  setBranchWorkflow("run-first");
                  setPendingBranchFittingId(null);
                  setQueuedBranchRunId(null);
                  setBranchHoverRunId(null);
                  setBranchPreview(null);
                  setBranchPlacementResult(null);
                  setBranchMessage("Step 1 · click the completed blue run going to the diffuser");
                }}>Run first</button>
                <button className={branchWorkflow === "place-first" ? "active" : ""} onClick={() => {
                  finishDrawing();
                  setActiveTool("branch");
                  setBranchWorkflow("place-first");
                  setPendingBranchFittingId(null);
                  setQueuedBranchRunId(null);
                  setBranchHoverRunId(null);
                  setBranchPreview(null);
                  setBranchPlacementResult(null);
                  setBranchMessage("Click any blue trunk to split it and place a T/Y");
                }}>Place first</button>
              </div>
              <label>Fitting style
                <select value={branchStyle} onChange={(event) => setBranchStyle(event.target.value as "auto" | "wye45" | "tee90")}>
                  <option value="auto">Auto-select from run angle</option>
                  <option value="wye45">45° Wye / lateral branch</option>
                  <option value="tee90">90° Tee branch</option>
                </select>
              </label>
              <button className="branch-arm" onClick={() => {
                finishDrawing();
                setActiveTool("branch");
                setSelectedId(null);
                setPendingBranchFittingId(null);
                setBranchHoverRunId(null);
                setBranchPreview(null);
                setBranchPlacementResult(null);
                if (branchWorkflow === "run-first") {
                  setQueuedBranchRunId(null);
                  setBranchMessage("Step 1 · click the completed blue run going to the diffuser");
                } else {
                  setBranchMessage("Click any blue trunk to split it and place a T/Y");
                }
              }}>
                <span className={`mini-fitting ${branchStyle === "auto" ? "wye45" : branchStyle}`}><i /><i /><i /></span>
                {branchWorkflow === "run-first" ? "Start run-first branch pass" : "Place fitting on any supply run"}
              </button>
              {branchWorkflow === "run-first" && queuedBranchRun && <div className="branch-run-armed-card">
                <div><b>PORT 3 RUN ARMED</b><strong>{queuedBranchRun.size}&quot; · {drawingLengthFeet(queuedBranchRun).toFixed(1)} LF</strong></div>
                <span>Click the main blue trunk exactly where the T/Y belongs. The closest end of this run will move to Port 3.</span>
                <button onClick={() => {
                  setQueuedBranchRunId(null);
                  setBranchPreview(null);
                  setBranchMessage("Branch selection cleared · click another completed diffuser run");
                }}>Change branch run</button>
              </div>}
              {pendingBranchFittingId && <div className="branch-link-step">
                <b>STEP 2 · PICK THE BRANCH RUN</b>
                <span>Click anywhere on the blue run that should connect to Port 3.</span>
                <button onClick={() => {
                  setPendingBranchFittingId(null);
                  setBranchPreview(null);
                  setBranchMessage("Fitting kept with Port 3 open · select it later to reattach");
                }}>Leave Port 3 open for now</button>
              </div>}
              <small>{branchWorkflow === "run-first"
                ? "Your workflow: draw all diffuser runs first → click a completed branch run → click the trunk location. The app splits the trunk, rotates the fitting, moves the closest branch endpoint and keeps all three ports connected."
                : "Manual fallback: click anywhere on a blue trunk to split it. If Port 3 stays open, click any blue branch run next—no perfect crossing required."}</small>
            </div>
            <div className="symbol-library">
              <div className="library-title"><Sparkles size={14} /><span>HVAC SYMBOL LIBRARY</span><b>{symbolPresets.length}+ presets</b></div>
              <label>Category
                <select value={symbolCategory} onChange={(event) => {
                  const category = event.target.value as (typeof symbolCategories)[number];
                  const first = symbolPresets.find((preset) => preset.category === category)!;
                  setSymbolCategory(category);
                  setActivePresetId(first.id);
                  setSymbolSearch("");
                  setPlacementRotation(0);
                }}>
                  {symbolCategories.map((category) => <option key={category}>{category}</option>)}
                </select>
              </label>
              <label>Find a symbol
                <input
                  className="symbol-catalog-search"
                  value={symbolSearch}
                  onChange={(event) => setSymbolSearch(event.target.value)}
                  placeholder="Search name, size or family…"
                />
              </label>
              <label>Symbol
                <select value={activePresetId} onChange={(event) => {
                  setActivePresetId(event.target.value);
                  setPlacementRotation(0);
                }}>
                  {Array.from(new Set(symbolPresets.filter((preset) => preset.category === symbolCategory).map(symbolFamily))).map((family) => (
                    <optgroup key={family} label={family}>
                      {symbolPresets.filter((preset) => preset.category === symbolCategory && symbolFamily(preset) === family).map((preset) => (
                        <option key={preset.id} value={preset.id}>{preset.label} · {preset.size}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              {(() => {
                const preset = symbolPresets.find((item) => item.id === activePresetId) || symbolPresets[0];
                const dimensions = symbolDimensions(preset.size);
                const query = symbolSearch.trim().toLowerCase();
                const visiblePresets = symbolPresets.filter((item) =>
                  item.category === symbolCategory
                  && (!query || `${item.label} ${item.size} ${symbolFamily(item)} ${item.variant}`.toLowerCase().includes(query)));
                const airflowKey = preset.kind === "diffuser"
                  ? "BLUE · SUPPLY / DISCHARGE"
                  : preset.kind === "returnGrille"
                    ? "RED · RETURN / INTAKE"
                    : preset.kind === "equipment"
                      ? "RED RETURN · BLUE SUPPLY"
                      : preset.kind === "fan"
                        ? `${preset.variant.replace(/-/g, " ").toUpperCase()} FAN`
                        : preset.category.toUpperCase();
                return <>
                  <div className="symbol-catalog-grid" role="list" aria-label={`${symbolCategory} symbol catalog`}>
                    {visiblePresets.map((item) => {
                      const itemDimensions = symbolDimensions(item.size);
                      return <button
                        type="button"
                        role="listitem"
                        key={item.id}
                        className={`symbol-catalog-card ${item.id === activePresetId ? "selected" : ""}`}
                        title={`${item.label} · ${item.size} · ${symbolFamily(item)}`}
                        onClick={() => {
                          setActivePresetId(item.id);
                          setPlacementRotation(0);
                        }}
                      >
                        <svg viewBox="-30 -27 60 54" aria-hidden="true">
                          <g className={`hvac-symbol symbol-${item.kind} variant-${item.variant}`}>
                            <SymbolArtwork kind={item.kind} variant={item.variant} width={itemDimensions.width} height={itemDimensions.height} />
                          </g>
                        </svg>
                        <span>{item.label.replace(/ · .+$/, "")}</span>
                        <small>{item.size}</small>
                      </button>;
                    })}
                    {!visiblePresets.length && <div className="symbol-catalog-empty">No symbols match “{symbolSearch}”.</div>}
                  </div>
                  <div className={`symbol-library-preview preview-${preset.kind}`}>
                    <svg viewBox="-48 -44 96 88" role="img" aria-label={`${preset.label} symbol preview at ${placementRotation} degrees`}>
                      <g transform={`rotate(${placementRotation})`} className={`hvac-symbol symbol-${preset.kind} variant-${preset.variant}`}>
                        <SymbolArtwork kind={preset.kind} variant={preset.variant} width={dimensions.width} height={dimensions.height} />
                      </g>
                    </svg>
                    <div>
                      <strong>{preset.label}</strong>
                      <span>{preset.size}{preset.cfm ? ` · ${preset.cfm.toLocaleString()} CFM` : ""}</span>
                      <small>{airflowKey}</small>
                      <b className="placement-rotation-badge">PLACEMENT ANGLE · {placementRotation}°</b>
                    </div>
                  </div>
                </>;
              })()}
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
              <small>Choose a catalog family, move the preview onto the plan, then use the wheel to rotate 15°. Hold Shift for 45°. Click to place.</small>
            </div>
            {tools.filter(({ id }) => id === "measure").map(({ id, label, icon: Icon, tone }) => (
              <button className={`tool ${activeTool === id ? "active" : ""}`} key={label} onClick={() => { finishDrawing(); setActiveTool(id); setSelectedId(null); }}>
                <span className={`tool-icon ${tone || ""}`}><Icon size={19} /></span><span>{label}</span>
              </button>
            ))}
          </div>

          <div className="panel-section">
            <div className="section-title"><span>OBJECT PROPERTIES</span><SlidersHorizontal size={15} /></div>
            {selectedDrawing?.symbol ? <>
              <label>Plan label
                <input
                  className="property-input"
                  value={drawings.find((drawing) => drawing.id === selectedId)?.symbol?.label || ""}
                  onChange={(event) => updateSelectedSymbol({ label: event.target.value })}
                />
                <small>Rename any placed symbol—including linear supplies and returns. Catalog defaults keep the scheduled face size visible.</small>
              </label>
              {["diffuser", "returnGrille"].includes(selectedDrawing?.symbol?.kind || "") && <div className="smart-can-editor">
                <div className="smart-can-heading">
                  <span>SMART CAN EDITOR</span>
                  <b>{selectedDrawing?.symbol?.kind === "diffuser" ? "SUPPLY" : "RETURN"}</b>
                </div>
                <label>Can style
                  <select
                    value={symbolPresets.find((preset) => preset.kind === selectedDrawing?.symbol?.kind && preset.size === selectedDrawing?.size && preset.variant === selectedDrawing?.symbol?.variant)?.id || ""}
                    onChange={(event) => event.target.value && applySelectedCanPreset(event.target.value)}
                  >
                    <option value="">Custom style / size</option>
                    {symbolPresets.filter((preset) => preset.kind === selectedDrawing?.symbol?.kind).map((preset) =>
                      <option key={preset.id} value={preset.id}>{preset.label} · {preset.size}</option>)}
                  </select>
                </label>
                <div className="can-dimension-grid">
                  <label>Width
                    <select
                      value={selectedDrawing?.size.split(/[x×]/i)[0] || "12"}
                      onChange={(event) => updateSelectedCanDimension(0, event.target.value)}
                    >
                      {["4", "6", "8", "10", "12", "14", "16", "18", "20", "24", "30"].map((size) => <option key={size}>{size}</option>)}
                    </select>
                  </label>
                  <label>Height
                    <select
                      value={selectedDrawing?.size.split(/[x×]/i)[1] || selectedDrawing?.size.split(/[x×]/i)[0] || "12"}
                      onChange={(event) => updateSelectedCanDimension(1, event.target.value)}
                    >
                      {["4", "6", "8", "10", "12", "14", "16", "18", "20", "24", "30"].map((size) => <option key={size}>{size}</option>)}
                    </select>
                  </label>
                </div>
                <label>Face pattern
                  <select value={selectedDrawing?.symbol?.variant || "grille"} onChange={(event) => updateSelectedSymbol({ variant: event.target.value })}>
                    {selectedDrawing?.symbol?.kind === "diffuser" ? <>
                      <option value="4way">4-way</option><option value="3way">3-way</option><option value="2way">2-way</option><option value="1way">1-way</option>
                      <option value="register">Sidewall register</option><option value="slot">Linear slot</option><option value="round">Round diffuser</option><option value="boot">Register boot</option><option value="floor">Floor register</option>
                    </> : <>
                      <option value="grille">Standard grille</option><option value="filter">Filter grille</option><option value="eggcrate">Eggcrate</option>
                      <option value="transfer">Transfer grille</option><option value="bar">Bar grille</option><option value="floor">Floor return</option>
                    </>}
                  </select>
                </label>
                <div className="can-dimension-grid">
                  <label>Neck
                    <select value={selectedDrawing?.symbol?.neckSize || "8"} onChange={(event) => updateSelectedSymbol({ neckSize: event.target.value })}>
                      {["4", "5", "6", "7", "8", "10", "12", "14", "16"].map((size) => <option key={size} value={size}>Ø{size}&quot;</option>)}
                    </select>
                  </label>
                  <label>Mounting
                    <select value={selectedDrawing?.elevation || "CEILING"} onChange={(event) => updateSelectedElevation(event.target.value)}>
                      <option>CEILING</option><option>HIGH WALL</option><option>LOW WALL</option><option>FLOOR</option>
                    </select>
                  </label>
                </div>
                {(() => {
                  const connection = terminalConnection(selectedDrawing);
                  const attached = Boolean(connection?.saved);
                  return <div className={`can-connection ${attached ? "connected" : ""}`}>
                    <div><span>LIVE DUCT CONNECTION</span><strong>{attached ? `Linked · ${connection?.run.size}″ ${connection?.run.type} · ${connection?.end}` : connection ? `${(connection.distance * scaleFeetPerUnit).toFixed(1)} ft from nearest endpoint` : "No matching run found"}</strong></div>
                    {attached
                      ? <button onClick={detachSelectedCan}>Detach</button>
                      : <button disabled={!connection} onClick={attachSelectedCanToRun}>Attach nearest</button>}
                  </div>;
                })()}
                <small>Attachment is manual. Once linked, moving either object keeps the duct endpoint and can together; Detach releases both in place.</small>
              </div>}
              <label>Rotation
                <div className="rotation-controls">
                  <button onClick={() => rotateSelectedSymbol(-15)}>−15°</button>
                  <strong>{drawings.find((drawing) => drawing.id === selectedId)?.symbol?.rotation || 0}°</strong>
                  <button onClick={() => rotateSelectedSymbol(15)}>+15°</button>
                </div>
              </label>
              <div className="symbol-resize-control">
                <div>
                  <span>PLAN ICON SIZE</span>
                  <strong>{Math.round(normalizedSymbolScale(selectedDrawing.symbol.scaleX) * 100)}% × {Math.round(normalizedSymbolScale(selectedDrawing.symbol.scaleY) * 100)}%</strong>
                </div>
                <button onClick={() => updateSelectedSymbol({ scaleX: 1, scaleY: 1 })}>Reset size</button>
                <small>Select the icon and drag any blue corner. Hold Shift while dragging to keep the original proportions.</small>
              </div>
              {isPrimaryAirflowEquipment(selectedDrawing) && <label>Primary equipment size
                <select
                  value={Number(drawings.find((drawing) => drawing.id === selectedId)?.size.match(/[\d.]+/)?.[0] || 3)}
                  onChange={(event) => updateEquipmentTonnage(Number(event.target.value))}
                >
                  {[1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((tons) => <option key={tons} value={tons}>{tons} ton · {tons * 400} CFM</option>)}
                </select>
              </label>}
              {isPrimaryAirflowEquipment(selectedDrawing) && <div className="equipment-plenum-connections">
                {(["supply", "return"] as const).map((ductType) => {
                  const connection = equipmentConnection(selectedDrawing, ductType);
                  const attached = Boolean(connection?.saved);
                  return <div className={`can-connection equipment-connection ${ductType}-connection ${attached ? "connected" : ""}`} key={ductType}>
                    <div>
                      <span>LIVE {ductType.toUpperCase()} PLENUM CONNECTION</span>
                      <strong>{attached
                        ? `Linked · ${connection?.run.size}″ ${ductType} · ${connection?.end} endpoint`
                        : connection
                          ? `${(connection.distance * scaleFeetPerUnit).toFixed(1)} ft from the ${ductType} plenum`
                          : `No ${ductType} run found`}</strong>
                    </div>
                    {attached
                      ? <button onClick={() => detachSelectedEquipment(ductType)}>Detach</button>
                      : <button disabled={!connection} onClick={() => attachSelectedEquipmentToRun(ductType)}>Attach {ductType}</button>}
                  </div>;
                })}
                <small>Each run locks to the matching plenum edge—not the center of the unit. Moving, rotating, or resizing the unit keeps both endpoints attached.</small>
              </div>}
              {selectedDrawing?.symbol?.kind === "equipment" && !isPrimaryAirflowEquipment(selectedDrawing) && <div className="auxiliary-equipment-note">
                <strong>REFERENCE EQUIPMENT</strong>
                <span>This symbol is excluded from indoor design airflow and does not connect to the supply trunk.</span>
              </div>}
              {(["diffuser", "returnGrille", "fan"].includes(selectedDrawing?.symbol?.kind || "") || isPrimaryAirflowEquipment(selectedDrawing)) && <label>Scheduled airflow (CFM)
                <input
                  className="property-input"
                  type="number"
                  min="0"
                  step="5"
                  value={drawings.find((drawing) => drawing.id === selectedId)?.cfm || 0}
                  onChange={(event) => updateSelectedCfm(Number(event.target.value))}
                />
              </label>}
              {(["diffuser", "returnGrille"].includes(selectedDrawing?.symbol?.kind || "") || isPrimaryAirflowEquipment(selectedDrawing)) && <div className={`symbol-network-summary ${symbolTrace.runCount ? "connected" : "disconnected"}`}>
                <div>
                  <span>COMPLETE SYSTEM PATH</span>
                  <b>{symbolTrace.runCount ? "● TRACE ACTIVE" : "● NOT CONNECTED"}</b>
                </div>
                <strong>{symbolTrace.runCount} runs · {symbolTrace.fittingCount} T/Y · {symbolTrace.terminalCount} terminals</strong>
                <small>{symbolTrace.runCount
                  ? "The full connected path is highlighted on the plan."
                  : "Attach this object manually to include it in the airflow network."}</small>
              </div>}
            </> : selectedDrawing?.fitting ? <div className="fitting-properties">
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
                <button onClick={() => { openSystemBalanceWorkspace("rooms"); setBranchMessage("Review terminal CFM proposals before applying any airflow changes"); }}>Review CFM split</button>
                <button className="network-size-action" onClick={openSystemSizingWorkflow}>Review connected sizes</button>
                <button className="reattach-action" onClick={reattachSelectedFitting}>Reattach nearby runs</button>
                <button className="reattach-action" onClick={() => {
                  const fitting = drawings.find((drawing) => drawing.id === selectedId && drawing.fitting);
                  if (!fitting) return;
                  setPendingBranchFittingId(fitting.id);
                  setActiveTool("branch");
                  setBranchPreview(null);
                  setBranchMessage("Click anywhere on the blue run you want attached to Port 3");
                }}>Pick Port 3 run on plan</button>
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
                const connectedRunId = fitting.connectedIds[port];
                const compatibleRuns = drawings.filter((drawing) =>
                  drawing.page === pageNumber &&
                  drawing.type === "supply" &&
                  !drawing.fitting &&
                  drawingSystem(drawing) === drawingSystem(drawings.find((item) => item.id === selectedId)!)
                );
                return <div className="fitting-port-editor" key={label}>
                  <label>{label} size
                    <select value={value} onChange={(event) => updateFittingPortSize(port as 0 | 1 | 2, event.target.value)}>
                      {[...runSizeOptions].reverse().map((size) => <option key={size}>{size}</option>)}
                    </select>
                  </label>
                  <label>Connected existing run
                    <select value={connectedRunId || ""} onChange={(event) => assignSelectedFittingPort(port as 0 | 1 | 2, event.target.value)}>
                      <option value="">Choose nearby run…</option>
                      {compatibleRuns.map((run) => <option key={run.id} value={run.id}>
                        {run.size}&quot; · {run.roomName?.trim() || run.elevation?.trim() || "Unassigned route"}
                      </option>)}
                    </select>
                  </label>
                </div>;
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
            </div> : selectedDrawing?.measurement ? <div className="engineering-card">
              <span>MEASURED DISTANCE</span>
              <strong>{drawings.find((drawing) => drawing.id === selectedId)?.measurement?.feet.toFixed(1)} FT</strong>
              <small>{scaleLabel}</small>
            </div> : <>
              {((selectedRun && ["supply", "return"].includes(selectedRun.type)) || (!selectedDrawing && ["supply", "return"].includes(activeTool))) && <label className="line-weight-control">
                Run line weight
                <select
                  value={selectedRun ? normalizedRunLineWeight(selectedRun.lineWeight) : runLineWeight}
                  onChange={(event) => updateRunLineWeight(Number(event.target.value))}
                >
                  <option value="0.1">0.10 mm · Fine</option>
                  <option value="0.2">0.20 mm · Standard</option>
                  <option value="0.3">0.30 mm · Bold</option>
                </select>
                <small>Supply and return only · every connected T/Y leg matches this weight automatically.</small>
              </label>}
              {selectedRun && <div className="engineering-properties">
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
                <div className="run-label-control">
                  <div><span>DUCT-SIZE LABEL</span><strong>Drag the number directly on the plan</strong></div>
                  <button
                    disabled={!selectedRun.labelOffset}
                    onClick={() => setHistory(drawings.map((drawing) => drawing.id === selectedRun.id ? { ...drawing, labelOffset: undefined } : drawing))}
                  >Reset position</button>
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
                  <div><span>Length</span><strong>{drawingLengthFeet(selectedRun)} LF</strong></div>
                  <div><span>Connected airflow</span><strong>{runAirflow(selectedRun)} CFM</strong></div>
                  <div><span>Velocity</span><strong>{velocityFpm(selectedRun.size, runAirflow(selectedRun))} FPM</strong></div>
                  <div><span>Source</span><strong>{airflowNetwork().calculated.get(selectedRun.id) ? "AUTO" : "MANUAL"}</strong></div>
                  <div><span>Friction rate</span><strong>{runPressure(selectedRun).frictionRate.toFixed(2)} /100 FT</strong></div>
                  <div><span>Pressure loss</span><strong>{runPressure(selectedRun).pressureDrop.toFixed(2)} IN. W.G.</strong></div>
                </div>
              </div>}
            </>}
            <label>System zone
              <select
                value={selectedDrawing ? drawingSystem(selectedDrawing) : activeSystem}
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
            {selectedDrawing && <>
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
            <div className="canvas-edit-actions" role="group" aria-label="Edit history">
              <button aria-label="Undo" onClick={undo} disabled={!undoStack.length}><Undo2 size={16} /></button>
              <button aria-label="Redo" onClick={redo} disabled={!redoStack.length}><Redo2 size={16} /></button>
              <button aria-label="Save working copy" onClick={saveProject}><Save size={15} /></button>
            </div>
            <span className="divider" />
            <button onClick={() => setActiveTool("select")}><MousePointer2 size={16} /> {activeTool === "select" ? "Select" : tools.find((tool) => tool.id === activeTool)?.label}</button>
            <span className="divider" />
            <button className={activeTool === "select" ? "active" : ""} aria-label="Pan drawing" title="Right-click and drag anywhere to pan the plan. Left-click stays reserved for drawing and selecting." onClick={() => setActiveTool("select")}><Hand size={16} /> Grab plan</button>
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
              title="Precision snap: fitting and equipment ports, endpoints, intersections, midpoints, segments, and grid"
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
              className={`display-toggle ${showFittingLabels ? "active" : ""}`}
              disabled={!pdf}
              onClick={() => setShowFittingLabels((visible) => !visible)}
              title="Show or hide T/Y fitting names and three-size labels"
              aria-pressed={showFittingLabels}
            >
              <DraftingCompass size={14} /> T/Y Text
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
                value={scaleVerified ? (scaleLabel.startsWith("Calibrated") ? "custom" : scaleLabel) : ""}
                onChange={(event) => event.target.value !== "custom" && applyScalePreset(event.target.value)}
              >
                <option value="" disabled>Choose scale…</option>
                <option value={'1/8" = 1\'-0"'}>{'1/8" = 1\'-0"'}</option>
                <option value={'3/16" = 1\'-0"'}>{'3/16" = 1\'-0"'}</option>
                <option value={'1/4" = 1\'-0"'}>{'1/4" = 1\'-0"'}</option>
                <option value={'1/2" = 1\'-0"'}>{'1/2" = 1\'-0"'}</option>
                <option value="custom">Custom calibrated</option>
              </select>
              {calibrating && <input className="reference-input" aria-label="Known distance in feet" type="number" min="1" value={referenceFeet} onChange={(event) => setReferenceFeet(event.target.value)} />}
              <button className={calibrating ? "calibrate active" : "calibrate"} onClick={() => { setCalibrating((value) => !value); setMeasureDraft([]); }}>
                {calibrating ? `${referenceFeet} ft · pick 2 points` : scaleVerified ? "Recalibrate" : "Calibrate"}
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
                {[...runSizeOptions].reverse().map((size) => <option key={size} value={size}>{size}&quot;</option>)}
              </select>}
              {selectedDrawing?.symbol && <button onClick={() => rotateSelectedSymbol(-15)}>−15°</button>}
              {selectedDrawing?.symbol && <button onClick={() => rotateSelectedSymbol(15)}>+15°</button>}
              {selectedRun && selectedIds.length === 1 && <button title="Continue drawing from the first endpoint" onClick={() => extendSelectedRun(true)}><Route size={15} /> Extend A</button>}
              {selectedRun && selectedIds.length === 1 && <button title="Continue drawing from the last endpoint" onClick={() => extendSelectedRun(false)}><Route size={15} /> Extend B</button>}
              {selectedRun && selectedIds.length === 1 && <button className={splitMode ? "active" : ""} title="Click the selected run where it should split" onClick={() => { setActiveTool("select"); setSplitMode((enabled) => !enabled); }}><Scissors size={15} /> Split</button>}
              {selectedIds.length === 2 && <button title="Join the two nearest compatible run endpoints" onClick={joinSelectedRuns}><Route size={15} /> Join runs</button>}
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
            {pdf && activeTool === "branch" && <div className={`branch-workflow-hud ${pendingBranchFittingId ? "awaiting-branch" : ""} ${queuedBranchRunId ? "run-armed" : ""} ${branchPlacementResult ? "complete" : ""}`} aria-live="polite">
              <div className="branch-workflow-heading">
                <span><DraftingCompass size={14} /> {branchWorkflow === "run-first" ? "RUN-FIRST T/Y PASS" : "SMART T/Y"}</span>
                <b>{branchPlacementResult
                  ? "3 / 3 CONNECTED"
                  : pendingBranchFittingId
                    ? "PORT 3 OPEN"
                    : queuedBranchRunId
                      ? "BRANCH ARMED"
                      : branchWorkflow === "run-first" ? "PICK BRANCH" : "READY"}</b>
              </div>
              <div className="branch-workflow-steps">
                {(branchWorkflow === "run-first" ? [
                  { number: 1, label: "Pick branch run", state: queuedBranchRunId || branchPlacementResult ? "done" : "active" },
                  { number: 2, label: "Click trunk", state: branchPlacementResult ? "done" : queuedBranchRunId ? "active" : "next" },
                  { number: 3, label: "Auto-connect", state: branchPlacementResult ? "done" : "next" },
                ] : [
                  { number: 1, label: "Pick trunk", state: pendingBranchFittingId || branchPlacementResult ? "done" : "active" },
                  { number: 2, label: "Split + place", state: pendingBranchFittingId || branchPlacementResult ? "done" : branchPreview?.mainRunId ? "active" : "next" },
                  { number: 3, label: "Attach Port 3", state: branchPlacementResult ? "done" : pendingBranchFittingId ? "active" : "next" },
                ]).map((step) => <div className={`branch-workflow-step ${step.state}`} key={step.number}>
                  <i>{step.state === "done" ? <CheckCircle2 size={13} /> : step.number}</i>
                  <span>{step.label}</span>
                </div>)}
              </div>
              <div className="branch-pass-summary">
                <span><b>{pageBranchFittings.length}</b> fittings on sheet</span>
                <span className={openBranchPorts ? "warning" : ""}><b>{openBranchPorts}</b> open Port 3</span>
                <span className={(branchWorkflow === "run-first" ? runFirstCandidateRuns.length : branchOpportunityList.length) ? "ready" : ""}>
                  <b>{branchWorkflow === "run-first" ? runFirstCandidateRuns.length : branchOpportunityList.length}</b> {branchWorkflow === "run-first" ? "diffuser runs ready" : "suggested next"}
                </span>
              </div>
              <strong className="branch-workflow-message">{branchPlacementResult?.message || branchMessage || (branchWorkflow === "run-first"
                ? "Step 1 · click the completed blue run going to the diffuser."
                : "Move over a blue supply trunk, then click where the fitting belongs.")}</strong>
              {!pendingBranchFittingId && !branchPlacementResult && <div className="branch-workflow-actions">
                {branchWorkflow === "run-first" ? <>
                  {!queuedBranchRunId && <button
                    className="primary"
                    disabled={!runFirstCandidateRuns.length}
                    onClick={() => {
                      const run = runFirstCandidateRuns[0];
                      if (!run) return;
                      setQueuedBranchRunId(run.id);
                      setBranchHoverRunId(null);
                      setBranchPreview(null);
                      setBranchMessage(`${run.size}″ diffuser run armed for Port 3 · click any blue trunk where the T/Y belongs`);
                      const viewport = canvasViewportRef.current;
                      const terminal = drawings.find((drawing) => drawing.symbol?.connectedRunId === run.id);
                      const point = terminal?.points[0] || run.points[run.points.length - 1];
                      if (viewport) updateCamera({
                        x: viewport.clientWidth / 2 - point.x * zoomRef.current,
                        y: viewport.clientHeight / 2 - point.y * zoomRef.current,
                      });
                    }}
                  >Pick next diffuser run</button>}
                  {queuedBranchRunId && <button onClick={() => {
                    setQueuedBranchRunId(null);
                    setBranchPreview(null);
                    setBranchMessage("Branch selection cleared · click another completed diffuser run");
                  }}>Change selected branch</button>}
                  <small>{queuedBranchRunId
                    ? "Branch is locked for Port 3. Click the main trunk to complete all three connections."
                    : "Click any blue branch manually, or jump to the next diffuser-linked run."}</small>
                </> : <>
                  <button
                    className="primary"
                    disabled={!branchOpportunityList.length}
                    onClick={() => focusNextBranchOpportunity(branchOpportunityList)}
                  >Find next suggested T/Y</button>
                  <small>Suggestions only highlight likely junctions. You confirm every fitting.</small>
                </>}
              </div>}
              {pendingBranchFittingId && <div className="branch-workflow-actions">
                <button onClick={() => {
                  setPendingBranchFittingId(null);
                  setBranchPreview(null);
                  setBranchMessage("Fitting kept with Port 3 open · select it later to reattach");
                }}>Leave Port 3 open</button>
                <button className="danger" onClick={undo}><Undo2 size={13} /> Undo fitting</button>
              </div>}
              {branchPlacementResult && <div className="branch-workflow-actions">
                <button
                  className="primary"
                  disabled={branchWorkflow === "run-first" ? !runFirstCandidateRuns.length : !branchOpportunityList.length}
                  onClick={() => {
                    if (branchWorkflow === "run-first") {
                      const run = runFirstCandidateRuns[0];
                      if (!run) return;
                      setBranchPlacementResult(null);
                      setQueuedBranchRunId(run.id);
                      setBranchPreview(null);
                      setBranchMessage(`${run.size}″ diffuser run armed for Port 3 · click any blue trunk where the T/Y belongs`);
                    } else {
                      focusNextBranchOpportunity(branchOpportunityList);
                    }
                  }}
                >{branchWorkflow === "run-first" ? "Pick next branch run" : "Next suggested T/Y"}</button>
                <button onClick={() => {
                  const fitting = drawings.find((drawing) => drawing.id === branchPlacementResult.fittingId && drawing.fitting);
                  if (!fitting) return;
                  setBranchWorkflow("place-first");
                  setQueuedBranchRunId(null);
                  setPendingBranchFittingId(fitting.id);
                  setSelectedId(fitting.id);
                  setBranchPlacementResult(null);
                  setBranchPreview(null);
                  setBranchMessage("Choose a different blue run · the selected endpoint will move to Port 3");
                }}>Change Port 3</button>
                <button className="danger" onClick={undo}><Undo2 size={13} /> Undo connection</button>
              </div>}
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
              <div className="pdf-stage" style={{ transform: `translate3d(${camera.x}px, ${camera.y}px, 0)` }}>
                <div ref={planSheetRef} className="plan-sheet" style={{ width: renderSize.width * zoom, height: renderSize.height * zoom }}>
                  <canvas ref={canvasRef} aria-label={`PDF page ${pageNumber}`} style={{ opacity: backgroundOpacity / 100 }} />
                  <svg
                    className={`drawing-layer tool-${activeTool}`}
                    viewBox={`0 0 ${renderSize.width || 1} ${renderSize.height || 1}`}
                    onPointerDown={handleDrawingClick}
                    onPointerMove={handlePointerMove}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    onPointerLeave={() => { if (!dragRef.current) { setHoverPoint(null); setSnapMarker(null); setSnapInfo(null); setAlignmentGuides([]); setBranchPreview(null); setSymbolPreview(null); } }}
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
                        const portVisuals = ([0, 1, 2] as const).map((port) => fittingPortVisual(drawing, port));
                        const portSizes = portVisuals.map((visual) => visual.size);
                        const portStates = ([0, 1, 2] as const).map((port) => fittingPortState(drawing, port));
                        const fittingFullyConnected = portStates.every((state) => state.connected);
                        const showPortGuides = pendingBranchFittingId === drawing.id;
                        const labelAngle = axis - drawing.fitting.side * Math.PI / 2;
                        const fittingLabelPoint = {
                          x: center.x + Math.cos(labelAngle) * 15,
                          y: center.y + Math.sin(labelAngle) * 15,
                        };
                        return <g
                          key={drawing.id}
                          className={`branch-fitting ${fittingFullyConnected ? "complete-fitting" : "open-fitting"} ${showPortGuides ? "showing-port-guides" : ""} ${activeTrace.fittingIds.has(drawing.id) ? "traced-fitting" : ""} ${isSelected(drawing.id) ? "selected-fitting" : ""} ${branchPlacementResult?.fittingId === drawing.id ? "connection-confirmed" : ""}`}
                          onPointerDown={(event) => startFittingDrag(event, drawing)}
                        >
                          <circle className="fitting-hit" cx={center.x} cy={center.y} r="22" />
                          <path className={`fitting-leg ${portStates[0].overloaded ? "overloaded" : ""}`} style={{ strokeWidth: portVisuals[0].strokeWidth }} d={`M ${inlet.x} ${inlet.y} L ${center.x} ${center.y}`} />
                          <path className={`fitting-leg ${portStates[1].overloaded ? "overloaded" : ""}`} style={{ strokeWidth: portVisuals[1].strokeWidth }} d={`M ${center.x} ${center.y} L ${outlet.x} ${outlet.y}`} />
                          <path className={`fitting-leg ${portStates[2].overloaded ? "overloaded" : ""}`} style={{ strokeWidth: portVisuals[2].strokeWidth }} d={`M ${shoulderA.x} ${shoulderA.y} Q ${center.x} ${center.y} ${shoulderB.x} ${shoulderB.y} L ${branchPort.x} ${branchPort.y}`} />
                          {[outletArrow, branchArrow].map((arrow, index) => <path
                            className="fitting-flow-arrow"
                            key={`flow-${index}`}
                            d={`M ${arrow.left.x} ${arrow.left.y} L ${arrow.tip.x} ${arrow.tip.y} L ${arrow.right.x} ${arrow.right.y}`}
                          />)}
                          {showPortGuides && [inlet, outlet, branchPort].map((port, index) => <g className={`${portStates[index].connected ? "connected-port" : "disconnected-port"} ${portStates[index].overloaded ? "overloaded-port" : ""}`} key={index}>
                            <circle className="fitting-port" cx={port.x} cy={port.y} r="5.8" />
                            <text className="port-number" x={port.x} y={port.y + 2.7} textAnchor="middle">{index + 1}</text>
                            <text className="fitting-port-size" x={port.x} y={port.y - 9} textAnchor="middle">{portSizes[index]}&quot;</text>
                            {showCfmLabels && <text className="fitting-port-cfm" x={port.x} y={port.y + 14} textAnchor="middle">{portStates[index].cfm} CFM</text>}
                            <text className="port-role" x={port.x} y={port.y + (showCfmLabels ? 23 : 15)} textAnchor="middle">{["IN", "OUT", "BRANCH"][index]}</text>
                          </g>)}
                          {showFittingLabels && <text
                            className="fitting-label"
                            x={fittingLabelPoint.x}
                            y={fittingLabelPoint.y}
                            textAnchor="middle"
                          >{drawing.fitting.style === "tee90" ? "TEE" : "WYE"} {portSizes.join("×")}{drawing.elevation ? ` · EL ${drawing.elevation}` : ""}</text>
                          }
                          {branchPlacementResult?.fittingId === drawing.id && <text className="connection-confirmed-label" x={center.x} y={center.y - 30} textAnchor="middle">✓ 3 / 3 CONNECTED</text>}
                        </g>;
                      }
                      const path = drawing.points.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ");
                      const middle = drawing.points[Math.floor(drawing.points.length / 2)];
                      const runLabelPoint = {
                        x: middle.x + 8 + (drawing.labelOffset?.x || 0),
                        y: middle.y - 8 + (drawing.labelOffset?.y || 0),
                      };
                      const branchCandidateClass = queuedBranchRunId === drawing.id
                        ? "branch-run-armed"
                        : branchHoverRunId === drawing.id
                          ? "branch-run-pick"
                          : branchPreview?.mainRunId === drawing.id
                            ? "branch-candidate-main"
                            : branchPreview?.runIds?.includes(drawing.id) || branchPreview?.branchRunId === drawing.id
                            ? "branch-candidate-route"
                              : "";
                      const runSelected = isSelected(drawing.id);
                      const showRunNodeHandles = runSelected || Boolean(branchCandidateClass);
                      return <g key={drawing.id} className={`${activeTrace.runIds.has(drawing.id) ? "traced-run" : ""} ${runSelected ? "selected-drawing" : ""} ${branchCandidateClass}`.trim()} onPointerDown={(event) => {
                        if (activeTool !== "select" || drawingLocked(drawing)) return;
                        event.stopPropagation();
                        event.shiftKey ? toggleSelection(drawing.id) : selectOnly(drawing.id);
                      }}>
                        <path className="hit-line" d={path} onPointerDown={(event) => startLineDrag(event, drawing)} />
                        <path className="duct-line" d={path} stroke={drawingColors[drawing.type as DrawType]} style={{ strokeWidth: runStrokeWidth(drawing.lineWeight) }} />
                        {showRunNodeHandles && drawing.points.map((point, index) => <circle
                          className={runSelected ? `edit-handle ${index === 0 || index === drawing.points.length - 1 ? "endpoint-grip" : "vertex-grip"}` : "branch-candidate-node"}
                          key={index}
                          cx={point.x}
                          cy={point.y}
                          r={runSelected ? 6 : 3.5}
                          fill={drawingColors[drawing.type as DrawType]}
                          onPointerDown={(event) => startPointDrag(event, drawing.id, index)}
                        />)}
                        {runSelected && drawing.points.slice(0, -1).map((point, index) => {
                          const next = drawing.points[index + 1];
                          return <circle
                            className="midpoint-grip"
                            key={`mid-${index}`}
                            cx={(point.x + next.x) / 2}
                            cy={(point.y + next.y) / 2}
                            r="4"
                            onPointerDown={(event) => startMidpointStretch(event, drawing.id, index)}
                          />;
                        })}
                        {queuedBranchRunId === drawing.id && <text className="branch-run-armed-label" x={middle.x + 8} y={middle.y - 24}>PORT 3 RUN ARMED</text>}
                        <text
                          className={`run-label ${drawing.labelOffset ? "custom-position" : ""}`}
                          x={runLabelPoint.x}
                          y={runLabelPoint.y}
                          onPointerDown={(event) => startRunLabelDrag(event, drawing)}
                        >
                          <title>Drag to reposition this duct-size label</title>
                          {drawing.size}&quot;
                          {showLengthLabels ? ` · ${drawingLengthFeet(drawing).toFixed(1)} LF` : ""}
                          {showCfmLabels ? ` · ${runAirflow(drawing)} CFM${airflowNetwork().calculated.get(drawing.id) ? " AUTO" : ""}` : ""}
                          {drawing.elevation ? ` · EL ${drawing.elevation}` : ""}
                        </text>
                      </g>;
                    })}
                    {reviewIssueMarkers(activeReviewedIssueRows).map((marker) => <g
                      className={`review-marker ${marker.issue.severity} ${marker.resolvedByDecision ? "accepted" : ""} ${marker.issue.id === activeReviewIssueId ? "active" : ""}`}
                      key={`marker-${marker.issue.id}`}
                      transform={`translate(${marker.point.x + marker.offset.x / Math.max(.1, zoom)} ${marker.point.y + marker.offset.y / Math.max(.1, zoom)}) scale(${1 / Math.max(.1, zoom)})`}
                      onPointerDown={(event) => {
                        if (event.button !== 0) return;
                        event.stopPropagation();
                        focusReviewIssue(marker.issue);
                      }}
                    >
                      <title>{marker.issue.title}: {marker.issue.detail}</title>
                      <path d="M 0 -10 L 9 7 L -9 7 Z" />
                      <circle cx="0" cy="0" r="7" />
                      <text x="0" y="2.5" textAnchor="middle">{marker.reference}</text>
                    </g>)}
                    {selectionBox && <g className={`selection-box ${selectionBox.end.x < selectionBox.start.x ? "crossing" : "window"}`}>
                      <rect
                        x={Math.min(selectionBox.start.x, selectionBox.end.x)}
                        y={Math.min(selectionBox.start.y, selectionBox.end.y)}
                        width={Math.abs(selectionBox.end.x - selectionBox.start.x)}
                        height={Math.abs(selectionBox.end.y - selectionBox.start.y)}
                      />
                      <text
                        x={Math.min(selectionBox.start.x, selectionBox.end.x) + 6}
                        y={Math.min(selectionBox.start.y, selectionBox.end.y) - 7}
                      >{selectionBox.end.x < selectionBox.start.x ? "CROSSING" : "WINDOW"}</text>
                    </g>}
                    {alignmentGuides.map((guide, index) => guide.axis === "x"
                      ? <line key={`guide-${index}`} className="alignment-guide" x1={guide.value} y1={0} x2={guide.value} y2={renderSize.height} />
                      : <line key={`guide-${index}`} className="alignment-guide" x1={0} y1={guide.value} x2={renderSize.width} y2={guide.value} />)}
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
                      <polyline points={[...draft, ...(hoverPoint ? [hoverPoint] : [])].map((point) => `${point.x},${point.y}`).join(" ")} stroke={drawingColors[activeTool as DrawType]} style={{ strokeWidth: runStrokeWidth(runLineWeight) }} />
                      {draft.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r="4" fill={drawingColors[activeTool as DrawType]} />)}
                    </g>}
                    {measureDraft.length > 0 && hoverPoint && <g className="measure-preview">
                      <path d={`M ${measureDraft[0].x} ${measureDraft[0].y} L ${hoverPoint.x} ${hoverPoint.y}`} />
                      <text x={(measureDraft[0].x + hoverPoint.x) / 2} y={(measureDraft[0].y + hoverPoint.y) / 2 - 8} textAnchor="middle">
                        {calibrating ? `${referenceFeet} FT REFERENCE` : `${(Math.hypot(hoverPoint.x - measureDraft[0].x, hoverPoint.y - measureDraft[0].y) * scaleFeetPerUnit).toFixed(1)} FT`}
                      </text>
                    </g>}
                    {activeTool === "branch" && !pendingBranchFittingId && branchOpportunityList.slice(0, 8).map((opportunity, index) => <g className="branch-opportunity-marker" key={opportunity.id}>
                      <circle cx={opportunity.center.x} cy={opportunity.center.y} r="10" />
                      <text x={opportunity.center.x} y={opportunity.center.y + 2.8} textAnchor="middle">{index + 1}</text>
                      {index === 0 && <text className="branch-opportunity-label" x={opportunity.center.x + 14} y={opportunity.center.y - 12}>SUGGESTED T/Y</text>}
                    </g>)}
                    {branchPreview && (() => {
                      const center = branchPreview.center;
                      const previewStyle = branchPreview.style || "wye45";
                      const branchAxis = branchPreview.branchAngle ?? branchPreview.angle + branchPreview.side * (previewStyle === "tee90" ? Math.PI / 2 : Math.PI / 4);
                      const inlet = { x: center.x - Math.cos(branchPreview.angle) * 13, y: center.y - Math.sin(branchPreview.angle) * 13 };
                      const outlet = { x: center.x + Math.cos(branchPreview.angle) * 13, y: center.y + Math.sin(branchPreview.angle) * 13 };
                      const branchPort = { x: center.x + Math.cos(branchAxis) * 18, y: center.y + Math.sin(branchAxis) * 18 };
                      return <g className={`branch-preview ${branchPreview.valid ? "" : "invalid"}`}>
                        {branchPreview.mode === "attach-run" && branchPreview.candidateEndpoint && <>
                          <path className="candidate-endpoint-guide" d={`M ${branchPreview.candidateEndpoint.x} ${branchPreview.candidateEndpoint.y} L ${branchPort.x} ${branchPort.y}`} />
                          <circle className="candidate-endpoint" cx={branchPreview.candidateEndpoint.x} cy={branchPreview.candidateEndpoint.y} r="7" />
                          <text className="candidate-endpoint-label" x={branchPreview.candidateEndpoint.x + 10} y={branchPreview.candidateEndpoint.y - 9}>
                            THIS END MOVES TO PORT 3{branchPreview.candidateEndpointDistance ? ` · ${(branchPreview.candidateEndpointDistance * scaleFeetPerUnit).toFixed(1)} FT` : ""}
                          </text>
                        </>}
                        <circle cx={center.x} cy={center.y} r="22" />
                        <path d={`M ${inlet.x} ${inlet.y} L ${center.x} ${center.y} L ${outlet.x} ${outlet.y} M ${center.x} ${center.y} L ${branchPort.x} ${branchPort.y}`} />
                        {[inlet, outlet, branchPort].map((port, index) => <g key={index}>
                          <circle
                            className={`preview-port ${index < 2 || branchPreview.matchedExisting ? "ready" : "missing"}`}
                            cx={port.x}
                            cy={port.y}
                            r="6"
                          />
                          <text className="preview-port-number" x={port.x} y={port.y + 2.8} textAnchor="middle">{index + 1}</text>
                          <text className="preview-port-role" x={port.x} y={port.y + 16} textAnchor="middle">{["IN", "OUT", "BRANCH"][index]}</text>
                        </g>)}
                        {branchPreview.mode === "split-trunk" && <text className="preview-trunk-label" x={center.x} y={center.y - 29} textAnchor="middle">TRUNK TO SPLIT</text>}
                        {branchPreview.mode === "attach-run" && branchPreview.branchRunId && branchPreview.candidateProjected && <text className="preview-run-label" x={branchPreview.candidateProjected.x} y={branchPreview.candidateProjected.y - 13} textAnchor="middle">BRANCH RUN SELECTED</text>}
                        <text x={branchPort.x + 7} y={branchPort.y - 6}>
                          {branchPreview.mode === "attach-run"
                            ? branchPreview.matchedExisting
                              ? `CLICK TO ATTACH · ${previewStyle === "tee90" ? "TEE" : "WYE"}`
                              : "SELECT ANY BLUE BRANCH RUN"
                            : branchPreview.matchedExisting
                              ? `READY · ${previewStyle === "tee90" ? "TEE" : "WYE"} · ${branchPreview.mode === "three-runs" ? "3 SEPARATE RUNS" : "TRUNK + BRANCH"}`
                              : "PLACE HERE · PORT 3 STAYS OPEN"} · {branchPreview.parentSize}×{steppedSize(branchPreview.parentSize, 1)}×{steppedSize(branchPreview.parentSize, 2)}
                        </text>
                      </g>;
                    })()}
                    {symbolPreview && (() => {
                      const preset = symbolPresets.find((item) => item.id === activePresetId && item.kind === symbolPreview.kind);
                      const fallback = {
                        diffuser: { label: "12×12 SUPPLY", size: "12×12", cfm: 225, elevation: "CEILING" },
                        returnGrille: { label: "14×14 RETURN", size: "14×14", cfm: 1200, elevation: "CEILING" },
                        equipment: { label: `${systemLabel(activeSystem).toUpperCase()} · 3 TON AHU`, size: "3 TON", cfm: 1200, elevation: "" },
                        fan: { label: "EF-1", size: "EF-1", cfm: 80, elevation: "CEILING" },
                      }[symbolPreview.kind];
                      const selected = preset || fallback;
                      const equipmentType = symbolPreview.kind === "equipment" ? equipmentTypeName(preset?.variant || "air-handler") : "";
                      return renderSymbol({
                        id: "symbol-preview",
                        type: "symbol",
                        points: [symbolPreview.point],
                        size: selected.size,
                        page: pageNumber,
                        cfm: selected.cfm,
                        elevation: selected.elevation,
                        systemId: activeSystem,
                        symbol: {
                          kind: symbolPreview.kind,
                          rotation: placementRotation,
                          variant: preset?.variant,
                          label: equipmentType
                            ? `${systemLabel(activeSystem).toUpperCase()} · ${selected.size} ${equipmentType}`
                            : selected.label,
                        },
                      }, true);
                    })()}
                    {snapMarker && <g className={`snap-marker snap-${snapInfo?.kind.replace(" ", "-") || "point"}`}>
                      <circle cx={snapMarker.x} cy={snapMarker.y} r="9" />
                      <path d={`M ${snapMarker.x - 5} ${snapMarker.y} L ${snapMarker.x + 5} ${snapMarker.y} M ${snapMarker.x} ${snapMarker.y - 5} L ${snapMarker.x} ${snapMarker.y + 5}`} />
                      {snapInfo && <text x={snapMarker.x + 13} y={snapMarker.y - 11}>{snapInfo.label}</text>}
                    </g>}
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
              {driveConfigured === null && <div className="drive-setup-note">Checking Google Drive connection…</div>}
              {driveConfigured === false && <div className="drive-setup-note">Google Drive needs administrator configuration before it can open plans.</div>}
              <div className="file-note"><CircleDot size={13} /> PDF up to 100 MB · Set drawing scale after upload</div>
            </div>}
          </div>
        </section>

        <aside className="right-panel">
          <div className="right-tabs" role="tablist" aria-label="HVAC workspace panels">
            <button role="tab" aria-selected={rightTab === "builder"} className={rightTab === "builder" ? "active" : ""} onClick={() => setRightTab("builder")}>Builder</button>
            <button role="tab" aria-selected={rightTab === "layers"} className={rightTab === "layers" ? "active" : ""} onClick={() => setRightTab("layers")}>Layers</button>
            <button role="tab" aria-selected={rightTab === "rooms"} className={rightTab === "rooms" ? "active" : ""} onClick={() => openSystemBalanceWorkspace("system")}>Balance</button>
            <button role="tab" aria-selected={rightTab === "takeoff"} className={rightTab === "takeoff" ? "active" : ""} onClick={() => setRightTab("takeoff")}>Takeoff</button>
            <button role="tab" aria-selected={rightTab === "checks"} className={rightTab === "checks" ? "active" : ""} onClick={() => setRightTab("checks")}>Review</button>
            <button role="tab" aria-selected={rightTab === "field"} className={rightTab === "field" ? "active" : ""} onClick={() => setRightTab("field")}>Field</button>
            <button className="right-collapse" aria-label="Collapse inspector" onClick={() => setRightPanelOpen(false)}><PanelRightClose size={15} /></button>
          </div>
          {rightTab === "builder" ? <div className="system-builder-panel">
            <div className="builder-hero">
              <div className="builder-hero-heading">
                <span><Sparkles size={17} /></span>
                <div><strong>SMART SYSTEM BUILDER</strong><small>{systemLabel(activeSystem)} · lines first, fittings second, cans last</small></div>
                <b>{activeWorkflow.progress}%</b>
              </div>
              <div className="builder-progress"><i style={{ width: `${activeWorkflow.progress}%` }} /></div>
              <div className="builder-stage-strip">
                {activeWorkflow.stages.map((stage) => <button
                  className={stage.status}
                  key={stage.id}
                  onClick={() => continueSystemWorkflow(stage.id)}
                  title={stage.detail}
                >
                  <b>{stage.status === "complete" ? <CheckCircle2 size={9} /> : stage.number}</b>
                  {stage.shortLabel}
                </button>)}
              </div>
            </div>

            <div className="workflow-next-action">
              <div>
                <span>NEXT SAFE ACTION</span>
                <strong>{activeWorkflow.nextAction}</strong>
                <small>{activeWorkflow.stages.find((stage) => stage.status === "active")?.detail}</small>
              </div>
              <button onClick={() => continueSystemWorkflow(activeWorkflow.activeStage)}>Continue system <ArrowRight size={13} /></button>
            </div>

            <div className="builder-metrics">
              <div><span>Runs</span><strong>{activeBuilderSummary.runs.length}</strong></div>
              <div><span>T/Y fittings</span><strong>{activeBuilderSummary.fittings.length}</strong></div>
              <div className={activeBuilderSummary.unconnectedDevices ? "attention" : "good"}><span>Open devices</span><strong>{activeBuilderSummary.unconnectedDevices}</strong></div>
              <div className={activeBuilderSummary.brokenPorts ? "attention" : "good"}><span>Broken ports</span><strong>{activeBuilderSummary.brokenPorts}</strong></div>
              <div className={activeBuilderSummary.sizing.length ? "attention" : "good"}><span>Size reviews</span><strong>{activeBuilderSummary.sizing.length}</strong></div>
              <div className={activeBuilderSummary.audit.counts.critical ? "critical" : "good"}><span>Critical</span><strong>{activeBuilderSummary.audit.counts.critical}</strong></div>
            </div>

            <div className="builder-workflow">
              <div className={`builder-action-card ${activeBuilderSummary.unconnectedDevices || activeBuilderSummary.brokenPorts ? "attention" : "complete"}`}>
                <div className="builder-action-icon"><Route size={17} /></div>
                <span><i>STEP 1</i><strong>Connect &amp; repair the system</strong><small>Snaps nearby equipment, supply cans, and return cans to existing run endpoints. Repairs saved T/Y ports without creating branch stubs or rerouting ductwork.</small></span>
                <div className="builder-action-buttons">
                  <button disabled={!activeBuilderSummary.unconnectedDevices} onClick={autoConnectActiveSystemDevices}>Connect nearby</button>
                  <button disabled={!activeBuilderSummary.brokenPorts} onClick={repairActiveSystemNetwork}>Repair all ports</button>
                </div>
              </div>

              <div className={`builder-action-card ${activeBuilderSummary.sizing.length ? "attention" : "complete"}`}>
                <div className="builder-action-icon"><Gauge size={17} /></div>
                <span><i>STEP 2</i><strong>Calculate CFM &amp; review duct sizes</strong><small>Propagates terminal airflow through connected T/Y fittings and prepares safe size recommendations using your velocity limits and 16″ residential maximum.</small></span>
                <div className={`system-airflow-setup ${!activeAirflowSetup.primaryUnit ? "missing-unit" : ""}`}>
                  <div className="airflow-setup-heading">
                    <span><Wind size={15} /><strong>SYSTEM AIRFLOW SETUP</strong></span>
                    <b>{activeAirflowSetup.primaryUnit ? `${activeAirflowSetup.targetCfm} CFM` : "UNIT REQUIRED"}</b>
                  </div>
                  <label>Primary equipment tonnage · 400 CFM per ton
                    <select
                      aria-label="Active system equipment tonnage"
                      value={activeAirflowSetup.primaryTons || 3}
                      disabled={!activeAirflowSetup.primaryUnit}
                      onChange={(event) => updateActiveSystemTonnage(Number(event.target.value))}
                    >
                      {[1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((tons) => <option key={tons} value={tons}>{tons} ton · {tons * 400} CFM</option>)}
                    </select>
                  </label>
                  {activeAirflowSetup.primaryUnit ? <>
                    <div className="airflow-balance-grid">
                      <div className={activeAirflowSetup.supplyBalanced ? "good" : "attention"}>
                        <span>Supply scheduled</span>
                        <strong>{activeAirflowSetup.supplyCfm} CFM</strong>
                        <small>{activeAirflowSetup.supplyGap > 0 ? `${activeAirflowSetup.supplyGap} CFM remaining` : activeAirflowSetup.supplyGap < 0 ? `${Math.abs(activeAirflowSetup.supplyGap)} CFM over` : "Target matched"}</small>
                      </div>
                      <div className={activeAirflowSetup.returnBalanced ? "good" : "attention"}>
                        <span>Return scheduled</span>
                        <strong>{activeAirflowSetup.returnCfm} CFM</strong>
                        <small>{activeAirflowSetup.returnGap > 0 ? `${activeAirflowSetup.returnGap} CFM remaining` : activeAirflowSetup.returnGap < 0 ? `${Math.abs(activeAirflowSetup.returnGap)} CFM over` : "Target matched"}</small>
                      </div>
                    </div>
                    <div className="airflow-progress-row">
                      <span>Supply <b>{activeAirflowSetup.supplyPercent}%</b><i><em style={{ width: `${Math.min(100, Math.max(0, activeAirflowSetup.supplyPercent))}%` }} /></i></span>
                      <span>Return <b>{activeAirflowSetup.returnPercent}%</b><i><em style={{ width: `${Math.min(100, Math.max(0, activeAirflowSetup.returnPercent))}%` }} /></i></span>
                    </div>
                    <div className="airflow-field-guidance">
                      <span><b>{activeAirflowSetup.connectedSupplyTerminals}/{activeAirflowSetup.supplyTerminals.length}</b> supply cans connected · {activeAirflowSetup.connectedSupplyCfm} CFM connected</span>
                      <span><b>{activeAirflowSetup.connectedReturnTerminals}/{activeAirflowSetup.returnTerminals.length}</b> return cans connected · {activeAirflowSetup.connectedReturnCfm} CFM connected</span>
                      <span><b>{activeAirflowSetup.supplyPathCount}</b> parallel {activeAirflowSetup.maximumFlexSize}″ supply path{activeAirflowSetup.supplyPathCount === 1 ? "" : "s"} at ≤{supplyVelocityLimit} FPM</span>
                      <span><b>{activeAirflowSetup.returnPathCount}</b> parallel {activeAirflowSetup.maximumFlexSize}″ return path{activeAirflowSetup.returnPathCount === 1 ? "" : "s"} at ≤{returnVelocityLimit} FPM</span>
                    </div>
                    <p>Even-division values are coordination checks—not room-load calculations. Keep room CFM manual and review every size change below.</p>
                  </> : <p>Place an equipment symbol in {systemLabel(activeSystem)}, then choose 1–5 tons here to establish design airflow.</p>}
                </div>
                <div className="builder-action-stats"><b>{activeAirflowSetup.targetCfm}</b> design · <b>{activeAirflowSetup.supplyCfm}</b> supply · <b>{activeAirflowSetup.returnCfm}</b> return CFM</div>
                <div className="builder-action-buttons">
                  <button disabled={!activeAirflowSetup.primaryUnit} onClick={() => openSystemBalanceWorkspace("rooms")}>Open room balancing</button>
                  <button disabled={!activeBuilderSummary.runs.length} onClick={openSystemSizingWorkflow}>Review duct sizes</button>
                </div>
              </div>

              <div className={`builder-action-card ${activeBuilderSummary.audit.counts.critical ? "critical" : activeBuilderSummary.audit.counts.warning ? "attention" : "complete"}`}>
                <div className="builder-action-icon"><ShieldAlert size={17} /></div>
                <span><i>STEP 3</i><strong>Run the HVAC plan audit</strong><small>Checks disconnected cans, airflow balance, velocity, size progression, return paths, elevations, fresh air, controls, and accidental zone connections.</small></span>
                <div className="builder-audit-strip">
                  <b>{activeBuilderSummary.audit.score} score</b>
                  <span>{activeBuilderSummary.audit.counts.critical} critical</span>
                  <span>{activeBuilderSummary.audit.counts.warning} warnings</span>
                </div>
                <button className="builder-primary-action" onClick={openSystemAuditWorkflow}>Open audit &amp; select first issue</button>
              </div>

              <div className={`builder-action-card ${activeBuilderSummary.packageSummary.ready ? "complete" : "attention"}`}>
                <div className="builder-action-icon"><FileText size={17} /></div>
                <span><i>STEP 4</i><strong>Prepare the field package</strong><small>Creates the run schedule, material takeoff, flex-box quantities, fabrication holds, field checklist, room airflow schedule, RFIs, and printable installation package.</small></span>
                <div className="builder-action-buttons">
                  <button onClick={() => setRightTab("takeoff")}>Open takeoff</button>
                  <button onClick={() => setRightTab("field")}>Field package</button>
                </div>
              </div>
            </div>
            <div className="builder-safety-note"><ShieldAlert size={13} /><span><strong>You stay in control.</strong> Connections and repairs happen only when you press a button. Size changes still require individual approval and remain undoable. No automatic run numbering, rerouting, branch stubs, or balancing dampers.</span></div>
          </div> : rightTab === "layers" ? <>
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
                <div><dt>Indoor airflow units</dt><dd>{drawings.filter((drawing) => isPrimaryAirflowEquipment(drawing) && drawingSystem(drawing) === activeSystem).length}</dd></div>
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
          </> : rightTab === "rooms" ? <div className="balance-workspace">
            <div className="balance-workspace-header">
              <div>
                <strong>SYSTEM BALANCING WORKSPACE</strong>
                <small>{systemLabel(activeSystem)} · review first, apply once</small>
              </div>
              <span className={`check-pill ${activeAirflowSetup.supplyBalanced && activeAirflowSetup.returnBalanced ? "clear" : "warning"}`}>
                {activeAirflowSetup.targetCfm ? activeAirflowSetup.supplyBalanced && activeAirflowSetup.returnBalanced ? "READY" : "REVIEW" : "NO UNIT"}
              </span>
            </div>
            <div className="balance-view-tabs" role="tablist" aria-label="Balance workspace views">
              {(["system", "rooms", "runs"] as const).map((view) => <button
                role="tab"
                aria-selected={balanceView === view}
                className={balanceView === view ? "active" : ""}
                key={view}
                onClick={() => setBalanceView(view)}
              >{view === "system" ? "System" : view === "rooms" ? "Rooms" : "Runs"}</button>)}
            </div>

            {balanceView === "system" ? <>
              <div className="balance-system-hero">
                <span><Wind size={18} /></span>
                <div><small>DESIGN AIRFLOW</small><strong>{activeAirflowSetup.targetCfm} CFM</strong><p>{activeAirflowSetup.equipment.length} indoor airflow source{activeAirflowSetup.equipment.length === 1 ? "" : "s"} · 400 CFM/ton</p></div>
                <button disabled={!activeAirflowSetup.primaryUnit} onClick={() => { setSelectedId(activeAirflowSetup.primaryUnit?.id || null); setActiveTool("select"); }}>Select unit</button>
              </div>
              <div className="balance-system-grid">
                <div className={activeAirflowSetup.supplyBalanced ? "good" : "attention"}><span>Supply scheduled</span><strong>{activeAirflowSetup.supplyCfm}</strong><small>{activeAirflowSetup.supplyGap > 0 ? `${activeAirflowSetup.supplyGap} remaining` : activeAirflowSetup.supplyGap < 0 ? `${Math.abs(activeAirflowSetup.supplyGap)} over` : "Target matched"}</small></div>
                <div className={activeAirflowSetup.returnBalanced ? "good" : "attention"}><span>Return scheduled</span><strong>{activeAirflowSetup.returnCfm}</strong><small>{activeAirflowSetup.returnGap > 0 ? `${activeAirflowSetup.returnGap} remaining` : activeAirflowSetup.returnGap < 0 ? `${Math.abs(activeAirflowSetup.returnGap)} over` : "Target matched"}</small></div>
                <div><span>Supply connected</span><strong>{activeAirflowSetup.connectedSupplyCfm}</strong><small>{activeAirflowSetup.connectedSupplyTerminals}/{activeAirflowSetup.supplyTerminals.length} cans</small></div>
                <div><span>Return connected</span><strong>{activeAirflowSetup.connectedReturnCfm}</strong><small>{activeAirflowSetup.connectedReturnTerminals}/{activeAirflowSetup.returnTerminals.length} grilles</small></div>
              </div>
              <div className="balance-capacity-note">
                <b>{activeAirflowSetup.maximumFlexSize}″ MAX RESIDENTIAL FLEX</b>
                <span>{activeAirflowSetup.supplyPathCount} supply path{activeAirflowSetup.supplyPathCount === 1 ? "" : "s"} at ≤{supplyVelocityLimit} FPM</span>
                <span>{activeAirflowSetup.returnPathCount} return path{activeAirflowSetup.returnPathCount === 1 ? "" : "s"} at ≤{returnVelocityLimit} FPM</span>
              </div>
              {networkBalanceRows().length ? <div className="network-balance-list compact">
                {networkBalanceRows().map((row) => <div className={`network-balance-card ${row.balanced ? "balanced" : "attention"}`} key={row.unit.id}>
                  <button className="network-unit-heading" onClick={() => { setSelectedId(row.unit.id); setActiveTool("select"); }}>
                    <span><strong>{row.unit.symbol?.label || "HVAC EQUIPMENT"}</strong><small>{row.rootRunId ? `${row.runCount} runs · ${row.fittingCount} fittings · ${row.terminalCount} connected supplies` : "Supply trunk not connected"}</small></span>
                    <b>{row.balanced ? "SUPPLY OK" : row.rootRunId ? "REVIEW" : "DISCONNECTED"}</b>
                  </button>
                  <div className="network-airflow-grid">
                    <div><span>Unit design</span><strong>{row.designCfm} CFM</strong></div>
                    <div><span>Connected supply</span><strong>{row.assignedCfm} CFM</strong></div>
                    <div className={Math.abs(row.remainingCfm) <= Math.max(25, row.designCfm * .1) ? "good" : "attention"}><span>Remaining</span><strong>{row.remainingCfm > 0 ? "+" : ""}{row.remainingCfm} CFM</strong></div>
                    <div><span>System return total</span><strong>{row.returnCfm} CFM</strong></div>
                  </div>
                  <div className="network-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={row.percent}>
                    <i style={{ width: `${Math.min(100, Math.max(0, row.percent))}%` }} /><span>{row.percent}% assigned</span>
                  </div>
                  <div className="network-problem-grid">
                    <span className={row.detachedPorts ? "warning" : "clear"}>{row.detachedPorts} detached</span>
                    <span className={row.missingPorts ? "warning" : "clear"}>{row.missingPorts} missing</span>
                    <span className={row.overloadedPorts ? "warning" : "clear"}>{row.overloadedPorts} undersized</span>
                    <span className={row.progressionCount ? "warning" : "clear"}>{row.progressionCount} progression</span>
                  </div>
                </div>)}
              </div> : <div className="empty-takeoff">Place an indoor airflow unit and connect its supply trunk to build the system network.</div>}
              <div className="balance-workspace-note">System return is shown once as a system total. A return is never assigned to an individual unit unless you explicitly separate it into another system.</div>
            </> : balanceView === "rooms" ? <>
              <div className="balance-toolbar">
                <button disabled={!roomSchedule().length || !activeAirflowSetup.targetCfm} onClick={recalculateRoomAirflowTargets}><Sparkles size={12} /> Recalculate targets</button>
                <button disabled={!roomSchedule().length} onClick={exportRoomScheduleCsv}><Save size={12} /> Export CSV</button>
              </div>
              <div className="room-summary-grid balance-summary">
                <div><span>Design</span><strong>{activeAirflowSetup.targetCfm} CFM</strong></div>
                <div><span>Scheduled</span><strong>{roomScheduleSummary().supplyCfm} CFM</strong></div>
                <div className={roomScheduleSummary().bedrooms === roomScheduleSummary().bedroomsWithReturn ? "good" : "attention"}><span>Bedroom returns</span><strong>{roomScheduleSummary().bedroomsWithReturn}/{roomScheduleSummary().bedrooms}</strong></div>
                <div className={terminalCfmProposals().length ? "attention" : "good"}><span>Pending CFM</span><strong>{terminalCfmProposals().length}</strong></div>
              </div>
              {roomSchedule().length ? <div className="balance-room-list">
                {roomSchedule().map((room) => {
                  const target = activeRoomAirflowTargets()[room.name.toLowerCase()] || { supplyCfm: 0, returnCfm: 0, priority: "standard" as RoomAirflowPriority };
                  const supplyVariance = room.supplyCfm - target.supplyCfm;
                  const returnVariance = room.returnCfm - target.returnCfm;
                  const connectedIds = room.drawingIds.filter((id) => airflowNetwork().terminalRun.has(id));
                  return <article className={`balance-room-card ${room.needsReturn ? "needs-return" : ""}`} key={room.name}>
                    <div className="balance-room-heading">
                      <span><strong>{room.name}</strong><small>{room.type} · {connectedIds.length}/{room.diffusers + room.returns} terminals connected</small></span>
                      <button onClick={() => selectRoomOnPlan(room.drawingIds)}>Show room</button>
                    </div>
                    <div className="balance-room-current">
                      <span><small>Supply scheduled</small><b>{room.supplyCfm} CFM</b><em className={supplyVariance ? "attention" : "good"}>{supplyVariance > 0 ? "+" : ""}{supplyVariance} vs target</em></span>
                      <span><small>Return scheduled</small><b>{room.returnCfm} CFM</b><em className={returnVariance ? "attention" : "good"}>{returnVariance > 0 ? "+" : ""}{returnVariance} vs target</em></span>
                      <span><small>Net room air</small><b>{room.balanceCfm > 0 ? "+" : ""}{room.balanceCfm} CFM</b><em>Supply minus return</em></span>
                    </div>
                    <div className="balance-room-targets">
                      <label>Supply target<input aria-label={`${room.name} supply target CFM`} type="number" min="0" step="5" value={target.supplyCfm} onChange={(event) => updateRoomAirflowTarget(room.name, { supplyCfm: Number(event.target.value) })} /></label>
                      <label>Return target<input aria-label={`${room.name} return target CFM`} type="number" min="0" step="5" value={target.returnCfm} disabled={!room.returns} onChange={(event) => updateRoomAirflowTarget(room.name, { returnCfm: Number(event.target.value) })} /></label>
                      <label>Comfort priority<select aria-label={`${room.name} comfort priority`} value={target.priority} onChange={(event) => updateRoomAirflowTarget(room.name, { priority: event.target.value as RoomAirflowPriority })}><option value="standard">Standard</option><option value="high">High load / glass</option><option value="low">Low load</option></select></label>
                    </div>
                    {room.needsReturn && <p><AlertTriangle size={12} /> Bedroom has supply air but no dedicated return grille. Add one or field-verify a transfer path.</p>}
                    {!room.diffusers && <p><AlertTriangle size={12} /> No supply diffuser is assigned to this room.</p>}
                  </article>;
                })}
              </div> : <div className="empty-takeoff">Assign room names to supply diffusers and return grilles to build room targets.</div>}
              <div className="cfm-review-tray">
                <div className="cfm-review-heading"><span><strong>REVIEWED CFM CHANGES</strong><small>Equal splits are proposals—not room-load calculations</small></span><b>{selectedCfmProposalIds.length}/{terminalCfmProposals().length}</b></div>
                <div className="cfm-review-actions">
                  <button disabled={!terminalCfmProposals().length} onClick={() => setSelectedCfmProposalIds(terminalCfmProposals().map((proposal) => proposal.id))}>Select all</button>
                  <button disabled={!selectedCfmProposalIds.length} onClick={() => setSelectedCfmProposalIds([])}>Clear</button>
                </div>
                {terminalCfmProposals().length ? <div className="cfm-proposal-list">
                  {terminalCfmProposals().map((proposal) => <div className={!proposal.connected ? "disconnected" : ""} key={proposal.id}>
                    <input aria-label={`Approve ${proposal.room} ${proposal.label} CFM change`} type="checkbox" checked={selectedCfmProposalIds.includes(proposal.id)} onChange={() => setSelectedCfmProposalIds((current) => current.includes(proposal.id) ? current.filter((id) => id !== proposal.id) : [...current, proposal.id])} />
                    <button onClick={() => { setSelectedId(proposal.drawingId); setActiveTool("select"); }}>
                      <span><strong>{proposal.room} · {proposal.kind}</strong><small>{proposal.label} · {proposal.connected ? "connected" : "connect before release"}</small></span>
                      <b>{proposal.current} → {proposal.proposed}</b>
                    </button>
                  </div>)}
                </div> : <div className="cfm-review-clear"><CheckCircle2 size={16} /> Scheduled terminal CFM matches the room targets.</div>}
                <button className="apply-cfm-proposals" disabled={!selectedCfmProposalIds.length} onClick={applySelectedCfmProposals}>Apply {selectedCfmProposalIds.length} selected CFM change{selectedCfmProposalIds.length === 1 ? "" : "s"} · one Undo</button>
              </div>
              <div className="balance-workspace-note">Targets are coordination values you can edit. Final room airflow still requires load review, equipment data, field balancing, and your approval.</div>
            </> : <>
              <div className="balance-toolbar">
                <button disabled={!sizingSuggestions().some((suggestion) => !suggestion.overCapacity)} onClick={() => setSelectedSizingIds(sizingSuggestions().filter((suggestion) => !suggestion.overCapacity).map((suggestion) => suggestion.id))}>Select safe sizes</button>
                <button disabled={!selectedSizingIds.length} onClick={() => setSelectedSizingIds([])}>Clear</button>
              </div>
              <div className="run-review-rules">
                <span><b>{residentialFlexMax}″</b> maximum residential flex</span>
                <span><b>{supplyVelocityLimit}</b> supply FPM limit</span>
                <span><b>{returnVelocityLimit}</b> return FPM limit</span>
              </div>
              {sizingSuggestions().length ? <div className="balance-run-list">
                {sizingSuggestions().map((suggestion) => <div className={`balance-run-row ${suggestion.overCapacity ? "over-capacity" : ""}`} key={suggestion.id}>
                  <input aria-label={`Approve ${suggestion.room} duct size change`} type="checkbox" disabled={suggestion.overCapacity} checked={selectedSizingIds.includes(suggestion.id)} onChange={() => toggleSizingSuggestion(suggestion.id)} />
                  <button onClick={() => { setSelectedId(suggestion.id); setActiveTool("select"); }}>
                    <span><strong>{suggestion.room} · {suggestion.type.toUpperCase()}</strong><small>{suggestion.cfm} CFM · {suggestion.currentVelocity} FPM now · {suggestion.velocity} FPM proposed</small></span>
                    <b>{suggestion.current}″ → {suggestion.recommended}″</b>
                  </button>
                  {suggestion.overCapacity && <p>Over the {suggestion.limit} FPM limit even at {residentialFlexMax}″. Add a parallel path or revise the design manually.</p>}
                </div>)}
              </div> : <div className="cfm-review-clear"><CheckCircle2 size={17} /> All connected runs match the current sizing rules.</div>}
              <button className="balance-apply-sizes" disabled={!selectedSizingIds.length} onClick={applySizingSuggestions}>Apply {selectedSizingIds.length} approved size change{selectedSizingIds.length === 1 ? "" : "s"} · one Undo</button>
              <div className={`progression-summary ${sizeProgressionIssues().length ? "attention" : "good"}`}>
                <span><strong>{sizeProgressionIssues().length} progression review{sizeProgressionIssues().length === 1 ? "" : "s"}</strong><small>Keep reductions gradual—such as 14×12×10 → 12×10×10 → 10×8×8.</small></span>
                <button onClick={openSystemSizingWorkflow}>Full sizing checks</button>
              </div>
              <div className="balance-workspace-note">Existing and recommended sizes are shown together. Nothing resizes until you check rows and press Apply; over-capacity runs are blocked.</div>
            </>}
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
              <div><strong>MATERIAL &amp; PREFAB</strong><small>{systemLabel(activeSystem)} · {buildTakeoff().length} line items</small></div>
              <button onClick={() => window.print()}>Print / PDF</button>
            </div>
            <div className="material-controls">
              <label>Material allowance
                <select value={materialWastePercent} onChange={(event) => setMaterialWastePercent(Number(event.target.value))}>
                  {[0, 5, 10, 15, 20].map((value) => <option value={value} key={value}>{value}% waste</option>)}
                </select>
              </label>
              <button disabled={!buildTakeoff().length} onClick={exportPurchaseSheetCsv}><Save size={13} /> Purchase CSV</button>
            </div>
            <div className="material-summary-grid">
              <div><span>25-ft flex boxes</span><strong>{materialSummary().flexBoxes}</strong></div>
              <div><span>Air devices</span><strong>{materialSummary().deviceCount}</strong></div>
              <div><span>T/Y fittings</span><strong>{materialSummary().fittingCount}</strong></div>
              <div className={materialSummary().holds.length ? "attention" : "good"}><span>Fabrication holds</span><strong>{materialSummary().holds.length}</strong></div>
            </div>
            {materialSummary().holds.length > 0 && <div className="fabrication-holds">
              <div><ShieldAlert size={15} /><span><strong>DO NOT FABRICATE YET</strong><small>Resolve these coordination items first</small></span></div>
              {materialSummary().holds.slice(0, 5).map((issue, index) => <button key={`${issue.title}-hold-${index}`} onClick={() => issue.drawingId && focusDrawingOnPlan(issue.drawingId)}>
                <AlertTriangle size={11} /><span><strong>{issue.title}</strong><small>{issue.detail}</small></span>
              </button>)}
            </div>}
            {buildTakeoff().length ? <div className="takeoff-list">
              {buildTakeoff().map((row, index) => <div className="takeoff-row" key={`${row.item}-${row.size}-${index}`}>
                <div><i>{row.category}</i><strong>{row.item}</strong><small>{row.size} · {row.note}</small></div>
                <b>{row.quantity}</b>
              </div>)}
            </div> : <div className="empty-takeoff">Draw ductwork or place HVAC symbols to build the takeoff.</div>}
            <div className="takeoff-note">One 25-ft flex box is ordered for every 25 feet or portion thereof after the selected allowance. Measure twice and field-verify offsets, elevations, access, and fabricated dimensions before shop release.</div>
          </div> : rightTab === "field" ? <div className="field-package-panel">
            <div className="workspace-panel-hero">
              <div><ShieldAlert size={18} /><span><strong>FIELD RELEASE CENTER</strong><small>{systemLabel(activeSystem)} · installer package, coordination, and closeout</small></span></div>
              <b className={activeFieldPackage.stale ? "stale" : activeFieldPackage.released ? "released" : activeFieldPackage.gatesClear ? "ready" : "hold"}>{activeFieldPackage.status}</b>
            </div>
            <nav className="workspace-subtabs" role="tablist" aria-label="Field workflow">
              <button role="tab" aria-selected={fieldView === "release"} className={fieldView === "release" ? "active" : ""} onClick={() => setFieldView("release")}>Release</button>
              <button role="tab" aria-selected={fieldView === "installer"} className={fieldView === "installer" ? "active" : ""} onClick={() => setFieldView("installer")}>Installer</button>
              <button role="tab" aria-selected={fieldView === "coordination"} className={fieldView === "coordination" ? "active" : ""} onClick={() => setFieldView("coordination")}>RFI &amp; Punch</button>
              <button role="tab" aria-selected={fieldView === "startup"} className={fieldView === "startup" ? "active" : ""} onClick={() => setFieldView("startup")}>Startup</button>
            </nav>
            {fieldView === "release" && <>
            <div className="project-command-center">
              <div className="command-center-heading">
                <div><strong>16-SYSTEM PROJECT COMMAND CENTER</strong><small>Whole-project readiness · select a system to continue work</small></div>
                <b>{activeProjectCommand.progress}%</b>
              </div>
              <div className="command-center-progress"><i style={{ width: `${activeProjectCommand.progress}%` }} /></div>
              <div className="command-center-metrics">
                <span><b>{activeProjectCommand.rows.length}</b> Active</span>
                <span><b>{activeProjectCommand.designReady}</b> Design</span>
                <span><b>{activeProjectCommand.fieldReady}</b> Field</span>
                <span><b>{activeProjectCommand.commissioned}</b> Commissioned</span>
                <span className={activeProjectCommand.openRfis ? "attention" : ""}><b>{activeProjectCommand.openRfis}</b> RFI</span>
                <span className={activeProjectCommand.openPunches ? "attention" : ""}><b>{activeProjectCommand.openPunches}</b> Punch</span>
                <span className={activeProjectCommand.closeoutReady === activeProjectCommand.rows.length && activeProjectCommand.rows.length ? "complete" : ""}><b>{activeProjectCommand.closeoutReady}</b> Closed</span>
              </div>
              <div className="command-center-controls">
                <div>
                  {(["all", "blocked", "ready"] as const).map((filter) => <button className={projectSystemFilter === filter ? "active" : ""} key={filter} onClick={() => setProjectSystemFilter(filter)}>{filter}</button>)}
                </div>
                <button disabled={!activeProjectCommand.rows.length} onClick={exportProjectStatusCsv}><Save size={11} /> Project CSV</button>
              </div>
              {filteredProjectRowsSnapshot.length ? <div className="command-system-list">
                {filteredProjectRowsSnapshot.map((system) => <button className={`${system.closeoutReady ? "ready" : "blocked"} ${activeSystem === system.id ? "active" : ""}`} key={system.id} onClick={() => openSystemFromCommandCenter(system.id)}>
                  <b className="command-system-number">S{system.id.replace("system-", "")}</b>
                  <span>
                    <strong>{systemLabel(system.id)}</strong>
                    <small>{system.stats.designCfm || 0} design CFM · {system.runs} runs · {system.supplyTerminals} outlets</small>
                    <i>{system.blockers.length ? system.blockers.join(" · ") : "All closeout gates complete"}</i>
                  </span>
                  <em>
                    <b>{system.progress}%</b>
                    <small>{system.closeoutReady ? "CLOSED" : system.fieldReady ? "FIELD" : system.designReady ? "DESIGN" : "HOLD"}</small>
                  </em>
                </button>)}
              </div> : <div className="command-center-empty">{projectSystemFilter === "all" ? "Place equipment and ductwork to activate a system." : `No ${projectSystemFilter} systems in this project.`}</div>}
              <p>Review-only command center. It reports saved drawing and closeout status; it never reroutes, resizes, reconnects, renumbers, or moves your work.</p>
            </div>
            <div className="checks-heading">
              <div><strong>FIELD INSTALLATION PACKAGE</strong><small>{systemLabel(activeSystem)} · controlled release</small></div>
              <span className={`check-pill ${activeFieldPackage.stale ? "critical" : activeFieldPackage.released ? "clear" : activeFieldPackage.gatesClear ? "warning" : activeFieldPackage.critical ? "critical" : "warning"}`}>
                {activeFieldPackage.status}
              </span>
            </div>
            <div className={`field-release-card ${activeFieldPackage.stale ? "stale" : activeFieldPackage.released ? "ready" : activeFieldPackage.gatesClear ? "approval" : "hold"}`}>
              <div>{activeFieldPackage.released ? <CheckCircle2 size={23} /> : <ShieldAlert size={23} />}</div>
              <span>
                <strong>{activeFieldPackage.stale ? "Release package changed after issue" : activeFieldPackage.released ? `Released revision ${activeFieldPackage.latestRelease?.revision}` : activeFieldPackage.gatesClear ? "Ready for named approval" : "Hold for coordination"}</strong>
                <small>{activeFieldPackage.stale ? "Re-run the review and issue a new revision before field use." : activeFieldPackage.released ? `${activeFieldPackage.latestRelease?.releasedBy} · ${new Date(activeFieldPackage.latestRelease!.releasedAt).toLocaleString()}` : activeFieldPackage.gatesClear ? "Enter the revision and approver below. Nothing is issued automatically." : "Clear every open gate before release."}</small>
              </span>
            </div>
            <div className="field-package-actions">
              <button onClick={() => window.print()}><FileText size={13} /> Print package</button>
              <button disabled={!activeFieldRuns.length} onClick={exportFieldRunScheduleCsv}><Save size={13} /> Run CSV</button>
              <button onClick={exportReleaseManifestCsv}><Save size={13} /> Release CSV</button>
            </div>
            <div className="release-gate-list">
              {activeFieldPackage.gates.map((gate) => <button className={gate.clear ? "clear" : "hold"} key={gate.id} onClick={() => openReleaseGate(gate.id)}>
                {gate.clear ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                <span><strong>{gate.label}</strong><small>{gate.detail}</small></span>
                <b>{gate.clear ? "CLEAR" : "HOLD"}</b>
              </button>)}
            </div>
            <div className="field-checklist-card">
              <div className="field-section-heading"><strong>FIELD RELEASE CHECKLIST</strong><span>{activeFieldPackage.checklistComplete}/{fieldChecklistItems.length}</span></div>
              {fieldChecklistItems.map((item) => <label key={item.id}>
                <input type="checkbox" checked={Boolean(activeFieldChecklist()[item.id])} onChange={(event) => updateFieldChecklist(item.id, event.target.checked)} />
                <span>{item.label}</span>
              </label>)}
              <p>Checklist status is saved separately for this system. It records coordination only and never changes the drawing.</p>
            </div>
            <div className="release-approval-card">
              <div className="field-section-heading"><strong>ISSUE CONTROLLED FIELD REVISION</strong><span>MANUAL APPROVAL</span></div>
              <div className="release-approval-fields">
                <label>Revision<input value={releaseRevision} onChange={(event) => setReleaseRevision(event.target.value)} placeholder="A, B, IFC-1…" /></label>
                <label>Released by<input value={releaseBy} onChange={(event) => setReleaseBy(event.target.value)} placeholder="Name / initials" /></label>
                <label className="wide">Release note<textarea value={releaseNote} onChange={(event) => setReleaseNote(event.target.value)} placeholder="Scope, approved exceptions, and installer instructions…" /></label>
              </div>
              <button disabled={!activeFieldPackage.gatesClear || !releaseRevision.trim() || !releaseBy.trim() || Boolean(activeFieldPackage.released && activeFieldPackage.latestRelease?.revision.toLowerCase() === releaseRevision.trim().toLowerCase())} onClick={issueSystemRelease}>
                {activeFieldPackage.stale ? "Issue updated revision" : "Issue for field use"}
              </button>
              <p>Every release stores a drawing fingerprint. Any later duct, fitting, equipment, airflow, room, scale, or rule change marks it stale.</p>
              {releaseRecords.filter((record) => record.systemId === activeSystem).length > 0 && <div className="release-history">
                {releaseRecords.filter((record) => record.systemId === activeSystem).slice().sort((a, b) => b.releasedAt.localeCompare(a.releasedAt)).map((record) => {
                  const current = record.id === activeFieldPackage.latestRelease?.id && record.drawingSignature === activeFieldPackage.signature && record.releaseSignature === activeFieldPackage.releaseSignature && activeFieldPackage.gatesClear;
                  return <div className={current ? "current" : "superseded"} key={record.id}>
                  <b>REV {record.revision}</b>
                  <span><strong>{record.releasedBy}</strong><small>{new Date(record.releasedAt).toLocaleString()} · {record.runCount} runs · {record.designCfm} CFM · {record.gateSnapshot?.filter((gate) => gate.clear).length ?? 0}/{record.gateSnapshot?.length ?? 0} gates</small></span>
                  <em>{current ? "CURRENT" : "SUPERSEDED"}</em>
                </div>;
                })}
              </div>}
            </div>
            </>}
            {fieldView === "coordination" && <div className="rfi-card">
              <div className="field-section-heading"><strong>FIELD RFI &amp; CHANGE LOG</strong><span>{activeRfiItems().filter((item) => !["approved", "closed"].includes(item.status)).length} OPEN</span></div>
              <div className="rfi-summary">
                <span><b>{rfiItems.length}</b> Project RFIs</span>
                <span><b>{rfiItems.filter((item) => item.status === "submitted").length}</b> Waiting</span>
                <span><b>{rfiItems.filter((item) => item.status === "approved").length}</b> Approved</span>
              </div>
              <div className={`punch-link ${selectedId ? "linked" : ""}`}><CircleDot size={12} /><span><strong>{selectedId ? "RFI linked to selected plan object" : "RFI applies to the active system"}</strong><small>{selectedObjectDescription()}</small></span></div>
              <div className="rfi-form">
                <label className="wide">RFI subject<input value={rfiSubject} onChange={(event) => setRfiSubject(event.target.value)} placeholder="Example: Supply run conflicts with structural beam" /></label>
                <label>Category<select value={rfiCategory} onChange={(event) => setRfiCategory(event.target.value as RfiItem["category"])}>{["Coordination", "Design", "Equipment", "Access", "Change order"].map((value) => <option key={value}>{value}</option>)}</select></label>
                <label>Priority<select value={rfiPriority} onChange={(event) => setRfiPriority(event.target.value as RfiItem["priority"])}><option value="critical">Critical</option><option value="normal">Normal</option><option value="low">Low</option></select></label>
                <label className="wide">Question / field conflict<textarea value={rfiQuestion} onChange={(event) => setRfiQuestion(event.target.value)} placeholder="Describe the condition, location, dimensions, and why work cannot proceed as shown…" /></label>
                <label className="wide">Proposed solution<textarea value={rfiSolution} onChange={(event) => setRfiSolution(event.target.value)} placeholder="Describe the field-preferred solution for review. Nothing changes until approved." /></label>
                <label className="wide">Assigned to<input value={rfiAssignedTo} onChange={(event) => setRfiAssignedTo(event.target.value)} placeholder="Architect, engineer, GC, owner…" /></label>
                <label>Cost impact<input value={rfiCostImpact} onChange={(event) => setRfiCostImpact(event.target.value)} placeholder="None / TBD / amount" /></label>
                <label>Schedule impact<input value={rfiScheduleImpact} onChange={(event) => setRfiScheduleImpact(event.target.value)} placeholder="None / days / TBD" /></label>
              </div>
              <div className="rfi-actions">
                <button disabled={!rfiSubject.trim() || !rfiQuestion.trim()} onClick={createRfiItem}>Create draft RFI</button>
                <button disabled={!rfiItems.length} onClick={exportRfiLogCsv}><Save size={12} /> Project RFI CSV</button>
              </div>
              {activeRfiItems().length ? <div className="rfi-list">
                {activeRfiItems().map((item) => <div className={`rfi-row ${item.priority} ${item.status}`} key={item.id}>
                  <button className="rfi-select" disabled={!item.drawingId} onClick={() => {
                    if (!item.drawingId) return;
                    focusDrawingOnPlan(item.drawingId);
                  }}>
                    <b>RFI-{String(item.number).padStart(3, "0")}</b>
                    <span><i>{item.category} · {item.priority}</i><strong>{item.subject}</strong><small>{item.question}</small></span>
                    <em>{item.drawingId ? "PLAN" : "GENERAL"}</em>
                  </button>
                  <div className="rfi-impact"><span>Cost: {item.costImpact}</span><span>Schedule: {item.scheduleImpact}</span></div>
                  <textarea value={item.response} onChange={(event) => updateRfiItem(item.id, { response: event.target.value })} placeholder="Record architect, engineer, GC, or owner response…" />
                  <input className="rfi-approval-by" value={item.approvalBy || ""} onChange={(event) => updateRfiItem(item.id, { approvalBy: event.target.value })} placeholder="Response / approval by (name)" />
                  <select value={item.status} onChange={(event) => updateRfiItem(item.id, { status: event.target.value as RfiItem["status"] })}>
                    <option value="draft">Draft</option>
                    <option value="submitted">Submitted</option>
                    <option value="answered">Answered</option>
                    <option value="approved" disabled={!item.response.trim() || !item.approvalBy?.trim()}>Approved · response + name required</option>
                    <option value="closed" disabled={!item.approvedAt}>Closed · approval required</option>
                  </select>
                  {item.approvedAt && <small className="rfi-approved-at">Approved by {item.approvalBy || "—"} · {new Date(item.approvedAt).toLocaleString()}</small>}
                </div>)}
              </div> : <div className="punch-empty">No RFIs recorded for this system.</div>}
              <p>Approval status is a manual record. An approved RFI documents authorization but never changes, moves, reconnects, resizes, or renumbers the plan.</p>
            </div>}
            {fieldView === "startup" && <div className={`commissioning-card ${commissioningSummary().ready ? "ready" : "open"}`}>
              <div className="field-section-heading"><strong>STARTUP, BALANCING &amp; COMMISSIONING</strong><span>{commissioningSummary().ready ? "COMPLETE" : `${commissioningSummary().checklistComplete}/${commissioningChecklistItems.length}`}</span></div>
              <div className="commissioning-status">
                <Gauge size={19} />
                <span><strong>{commissioningSummary().ready ? "System closeout complete" : "Measured closeout required"}</strong><small>{commissioningSummary().totalStatic.toFixed(2)} in. w.g. total static · {commissioningSummary().airflowPercent}% of design airflow</small></span>
              </div>
              <div className="commissioning-fields equipment-fields">
                <label>Equipment model<input value={activeCommissioningRecord().model} onChange={(event) => updateCommissioningField("model", event.target.value)} placeholder="Model number" /></label>
                <label>Serial number<input value={activeCommissioningRecord().serial} onChange={(event) => updateCommissioningField("serial", event.target.value)} placeholder="Serial number" /></label>
                <label>Filter size<input value={activeCommissioningRecord().filterSize} onChange={(event) => updateCommissioningField("filterSize", event.target.value)} placeholder="20×25×1" /></label>
                <label>Measured airflow<input type="number" value={activeCommissioningRecord().measuredCfm} onChange={(event) => updateCommissioningField("measuredCfm", event.target.value)} placeholder="CFM" /></label>
              </div>
              <div className="commissioning-fields reading-fields">
                <label>Supply static<input type="number" step=".01" value={activeCommissioningRecord().supplyStatic} onChange={(event) => updateCommissioningField("supplyStatic", event.target.value)} placeholder="in. w.g." /></label>
                <label>Return static<input type="number" step=".01" value={activeCommissioningRecord().returnStatic} onChange={(event) => updateCommissioningField("returnStatic", event.target.value)} placeholder="in. w.g." /></label>
                <label>Rated max static<input type="number" step=".01" value={activeCommissioningRecord().ratedMaxStatic} onChange={(event) => updateCommissioningField("ratedMaxStatic", event.target.value)} placeholder=".50" /></label>
                <label>Temperature split<input type="number" step=".1" value={activeCommissioningRecord().temperatureSplit} onChange={(event) => updateCommissioningField("temperatureSplit", event.target.value)} placeholder="°F" /></label>
              </div>
              {commissioningSummary().ratedMax > 0 && commissioningSummary().totalStatic > commissioningSummary().ratedMax && <div className="commissioning-warning"><AlertTriangle size={13} /> Measured total static exceeds the entered equipment maximum. Review filter, coil, duct, grilles, and blower setup.</div>}
              <div className="commissioning-fields closeout-fields">
                <label>Technician<input value={activeCommissioningRecord().technician} onChange={(event) => updateCommissioningField("technician", event.target.value)} placeholder="Name" /></label>
                <label>Date<input type="date" value={activeCommissioningRecord().date} onChange={(event) => updateCommissioningField("date", event.target.value)} /></label>
              </div>
              <div className="commissioning-checklist">
                {commissioningChecklistItems.map((item) => <label key={item.id}>
                  <input type="checkbox" checked={Boolean(activeCommissioningRecord().checklist[item.id])} onChange={(event) => updateCommissioningCheck(item.id, event.target.checked)} />
                  <span>{item.label}</span>
                </label>)}
              </div>
              <label className="commissioning-notes">Closeout notes<textarea value={activeCommissioningRecord().notes} onChange={(event) => updateCommissioningField("notes", event.target.value)} placeholder="Record adjustments, punch items, and field conditions…" /></label>
              <button className="commissioning-export" onClick={exportCommissioningCsv}><Save size={13} /> Export commissioning CSV</button>
              <p>Compare measured values with the equipment manufacturer’s approved data. This record does not alter the design drawing.</p>
            </div>}
            {fieldView === "coordination" && <div className="punch-card">
              <div className="field-section-heading"><strong>FIELD PUNCH LIST &amp; AS-BUILT TRACKER</strong><span>{activePunchItems().filter((item) => item.status === "open").length} OPEN</span></div>
              <div className="punch-summary">
                <span><b>{activePunchItems().filter((item) => item.status === "open").length}</b> Open</span>
                <span><b>{activePunchItems().filter((item) => item.priority === "critical" && item.status === "open").length}</b> Critical</span>
                <span><b>{activePunchItems().filter((item) => item.status === "resolved").length}</b> Resolved</span>
              </div>
              <div className={`punch-link ${selectedId ? "linked" : ""}`}><CircleDot size={12} /><span><strong>{selectedId ? "Linked to selected drawing object" : "Create as a general system issue"}</strong><small>{selectedObjectDescription()}</small></span></div>
              <div className="punch-form">
                <label className="wide">Issue description<input value={punchTitle} onChange={(event) => setPunchTitle(event.target.value)} placeholder="Example: Raise return run above light conflict" /></label>
                <label>Category<select value={punchCategory} onChange={(event) => setPunchCategory(event.target.value as PunchItem["category"])}>{["Installation", "Coordination", "Airflow", "Equipment", "Closeout"].map((value) => <option key={value}>{value}</option>)}</select></label>
                <label>Priority<select value={punchPriority} onChange={(event) => setPunchPriority(event.target.value as PunchItem["priority"])}><option value="critical">Critical</option><option value="normal">Normal</option><option value="low">Low</option></select></label>
                <label className="wide">Assigned to<input value={punchAssignedTo} onChange={(event) => setPunchAssignedTo(event.target.value)} placeholder="Crew, technician, GC, shop…" /></label>
                <label className="wide">Field / as-built note<textarea value={punchNote} onChange={(event) => setPunchNote(event.target.value)} placeholder="Record the field condition, approved change, or closeout requirement…" /></label>
              </div>
              <div className="punch-actions">
                <button disabled={!punchTitle.trim()} onClick={createPunchItem}>Add field issue</button>
                <button disabled={!activePunchItems().length} onClick={exportPunchListCsv}><Save size={12} /> Export CSV</button>
              </div>
              {activePunchItems().length ? <div className="punch-list">
                {activePunchItems().map((item) => <div className={`punch-row ${item.priority} ${item.status}`} key={item.id}>
                  <button className="punch-select" disabled={!item.drawingId} onClick={() => {
                    if (!item.drawingId) return;
                    focusDrawingOnPlan(item.drawingId);
                  }}>
                    <span><i>{item.category} · {item.priority}</i><strong>{item.title}</strong><small>{item.assignedTo || "Unassigned"} · {new Date(item.createdAt).toLocaleDateString()}{item.note ? ` · ${item.note}` : ""}</small></span>
                    <b>{item.drawingId ? "PLAN" : "GENERAL"}</b>
                  </button>
                  <button className="punch-status" onClick={() => togglePunchStatus(item.id)}>{item.status === "open" ? "Mark resolved" : "Reopen issue"}</button>
                </div>)}
              </div> : <div className="punch-empty">No field issues recorded for this system.</div>}
              <p>As-built and punch records are manual. Resolving an issue never moves, resizes, reconnects, or renumbers drawing objects.</p>
            </div>}
            {fieldView === "installer" && <div className="installer-workspace">
            <div className="installer-summary-card">
              <div><Route size={19} /><span><strong>INSTALLER RUN BOOK</strong><small>Tap any run to jump directly to it on the plan</small></span></div>
              <dl>
                <div><dt>Runs</dt><dd>{activeFieldRuns.length}</dd></div>
                <div><dt>Length</dt><dd>{activeFieldRuns.reduce((total, run) => total + run.length, 0).toFixed(1)} LF</dd></div>
                <div><dt>Connection holds</dt><dd>{activeFieldPackage.connectionProblems}</dd></div>
                <div><dt>Elevation holds</dt><dd>{activeFieldPackage.missingElevation}</dd></div>
              </dl>
              <div className="field-package-actions installer-actions">
                <button onClick={() => window.print()}><FileText size={13} /> Print installer package</button>
                <button disabled={!activeFieldRuns.length} onClick={exportFieldRunScheduleCsv}><Save size={13} /> Run CSV</button>
              </div>
            </div>
            <div className="field-run-card">
              <div className="field-section-heading"><strong>INSTALL RUN SCHEDULE</strong><span>{activeFieldRuns.length} runs</span></div>
              {activeFieldRuns.length ? <div className="field-run-list">
                {activeFieldRuns.map((run) => <button key={run.drawing.id} onClick={() => focusDrawingOnPlan(run.drawing.id)}>
                  <i className={run.drawing.type} />
                  <span><strong>{run.size} {run.type} · {run.room}</strong><small>{run.length.toFixed(1)} LF · {run.cfm} CFM · {run.elevation}</small></span>
                  <b className={run.connected ? "connected" : "review"}>{run.connected ? "OK" : "REVIEW"}</b>
                </button>)}
              </div> : <div className="empty-takeoff">Draw duct runs to build the installer schedule.</div>}
            </div>
            <div className="installer-material-card">
              <div className="field-section-heading"><strong>ORDER &amp; PREFAB SUMMARY</strong><span>{buildTakeoff().length} ITEMS</span></div>
              {buildTakeoff().slice(0, 12).map((row, index) => <div key={`${row.item}-installer-${index}`}><span><strong>{row.item}</strong><small>{row.size} · {row.note}</small></span><b>{row.quantity}</b></div>)}
              <button onClick={() => setRightTab("takeoff")}>Open full material takeoff</button>
            </div>
            </div>}
            <div className="takeoff-note">Field package is a coordination aid. Approved plans, code, inspector comments, equipment instructions, and actual site conditions govern installation.</div>
          </div> : <div className="checks-panel">
            <div className="workspace-panel-hero review">
              <div><ShieldAlert size={18} /><span><strong>SMART PLAN REVIEW</strong><small>{systemLabel(activeSystem)} · prioritized HVAC QA with plan links</small></span></div>
              <b className={activeReviewSummary.critical ? "critical" : activeReviewSummary.openWarnings ? "hold" : "ready"}>{activeReviewSummary.blockers ? `${activeReviewSummary.blockers} OPEN` : "REVIEWED"}</b>
            </div>
            <nav className="workspace-subtabs" role="tablist" aria-label="Plan review views">
              <button role="tab" aria-selected={reviewView === "overview"} className={reviewView === "overview" ? "active" : ""} onClick={() => setReviewView("overview")}>Overview</button>
              <button role="tab" aria-selected={reviewView === "issues"} className={reviewView === "issues" ? "active" : ""} onClick={() => setReviewView("issues")}>Issues</button>
              <button role="tab" aria-selected={reviewView === "engineering"} className={reviewView === "engineering" ? "active" : ""} onClick={() => setReviewView("engineering")}>Engineering</button>
            </nav>
            {reviewView === "overview" && <div className="review-overview">
              <div className="review-metric-grid">
                <button className={activeReviewSummary.critical ? "critical" : "clear"} onClick={() => { setReviewQueueFilter("open"); setReviewView("issues"); }}><span>Critical blockers</span><strong>{activeReviewSummary.critical}</strong><small>Must be fixed on the plan</small></button>
                <button className={activeReviewSummary.openWarnings ? "warning" : "clear"} onClick={() => { setReviewQueueFilter("open"); setReviewView("issues"); }}><span>Open warnings</span><strong>{activeReviewSummary.openWarnings}</strong><small>Review or document</small></button>
                <button className="accepted" onClick={() => { setReviewQueueFilter("accepted"); setReviewView("issues"); }}><span>Decisions recorded</span><strong>{activeReviewSummary.acceptedWarnings}</strong><small>Named reviewer + note</small></button>
                <button className="advisory" onClick={() => { setReviewQueueFilter("all"); setReviewView("issues"); }}><span>Advisories</span><strong>{activeReviewSummary.advisory}</strong><small>Non-blocking guidance</small></button>
              </div>
              <div className={`review-next-card ${activeReviewSummary.blockers ? "open" : "clear"}`}>
                <div>{activeReviewSummary.blockers ? <AlertTriangle size={21} /> : <CheckCircle2 size={21} />}<span><strong>{activeReviewSummary.blockers ? "Next review action" : "Plan review is clear"}</strong><small>{activeReviewSummary.blockers ? "Work the queue in severity order. Critical conditions cannot be waived." : "No unresolved critical issues or warnings remain."}</small></span></div>
                <button disabled={!activeReviewedIssueRows.some((row) => !row.resolvedByDecision && row.issue.drawingId)} onClick={selectNextValidationIssue}>Jump to next issue</button>
              </div>
              <div className="review-control-row">
                <label><input type="checkbox" checked={showReviewMarkers} onChange={(event) => setShowReviewMarkers(event.target.checked)} /> Show plan issue markers</label>
                <button disabled={!activeReviewedIssueRows.length} onClick={exportReviewLogCsv}><Save size={13} /> Review CSV</button>
              </div>
              <div className="review-release-readiness">
                <div className="field-section-heading"><strong>FIELD RELEASE READINESS</strong><span>{activeFieldPackage.status}</span></div>
                {activeFieldPackage.gates.map((gate) => <button className={gate.clear ? "clear" : "hold"} key={`review-${gate.id}`} onClick={() => openReleaseGate(gate.id)}>
                  {gate.clear ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                  <span><strong>{gate.label}</strong><small>{gate.detail}</small></span>
                </button>)}
                <button className="open-release-center" onClick={() => { setRightTab("field"); setFieldView("release"); }}>Open field release center</button>
              </div>
              <div className="review-safety-note"><ShieldAlert size={15} /><span><strong>Manual approval stays in control.</strong><small>The review finds and organizes conditions. It never moves, reconnects, resizes, reroutes, renumbers, or releases anything by itself.</small></span></div>
            </div>}
            {reviewView === "issues" && <div className="review-issues-workspace">
              <div className="review-queue-controls">
                <div>
                  {(["open", "accepted", "all"] as const).map((filter) => <button className={reviewQueueFilter === filter ? "active" : ""} key={filter} onClick={() => setReviewQueueFilter(filter)}>
                    {filter === "open" ? `Open ${activeReviewSummary.blockers + activeReviewSummary.advisory}` : filter === "accepted" ? `Decided ${activeReviewSummary.acceptedWarnings}` : `All ${activeReviewedIssueRows.length}`}
                  </button>)}
                </div>
                <label><input type="checkbox" checked={showReviewMarkers} onChange={(event) => setShowReviewMarkers(event.target.checked)} /> Markers</label>
              </div>
              <div className="review-queue-list">
                {filteredReviewIssueRows(activeReviewedIssueRows).length ? filteredReviewIssueRows(activeReviewedIssueRows).map((row) => {
                  return <button className={`review-queue-row ${row.issue.severity} ${row.resolvedByDecision ? "accepted" : ""} ${activeReviewIssueId === row.issue.id ? "active" : ""}`} key={row.issue.id} onClick={() => focusReviewIssue(row.issue)}>
                    <b>{reviewIssueReference(row.issue)}</b>
                    {row.issue.severity === "info" ? <CircleDot size={15} /> : <AlertTriangle size={15} />}
                    <span><i>{issueCategory(row.issue.title)} · {row.issue.severity}</i><strong>{row.issue.title}</strong><small>{row.issue.detail}</small></span>
                    <em>{row.decision ? `${row.decision.status.toUpperCase()}${row.resolvedByDecision ? "" : " · PENDING"}` : row.issue.drawingId ? "PLAN" : "SYSTEM"}</em>
                  </button>;
                }) : <div className="checks-clear"><CheckCircle2 size={24} /><strong>No issues in this queue</strong><span>Choose another queue or continue to release review.</span></div>}
              </div>
              {activeReviewRow && <div className={`review-decision-card ${activeReviewRow.issue.severity}`}>
                <div className="review-decision-heading">
                  <span><i>{activeReviewRow.issue.severity}</i><strong>{activeReviewRow.issue.title}</strong><small>{activeReviewRow.issue.detail}</small></span>
                  {activeReviewRow.issue.drawingId && <button onClick={() => focusDrawingOnPlan(activeReviewRow.issue.drawingId!)}>Show on plan</button>}
                </div>
                {activeReviewRow.issue.severity === "critical" && <div className="critical-policy"><ShieldAlert size={14} /> Critical issues stay open until the drawing condition is fixed. An RFI or punch item documents the problem but does not waive it.</div>}
                <label>Reviewer / responsible person<input value={reviewerName} onChange={(event) => setReviewerName(event.target.value)} placeholder="Name or initials" /></label>
                <label>Decision, field condition, or proposed action<textarea value={reviewDecisionNote} onChange={(event) => setReviewDecisionNote(event.target.value)} placeholder="Record what was verified, accepted, or sent for coordination…" /></label>
                <div className="review-decision-actions">
                  {activeReviewRow.issue.severity !== "critical" && <button disabled={!reviewerName.trim() || !reviewDecisionNote.trim()} onClick={() => resolveReviewIssue(activeReviewRow.issue, "accepted")}>Accept with note</button>}
                  <button disabled={!reviewerName.trim() || !reviewDecisionNote.trim()} onClick={() => resolveReviewIssue(activeReviewRow.issue, "rfi")}>Create RFI</button>
                  <button disabled={!reviewerName.trim() || !reviewDecisionNote.trim()} onClick={() => resolveReviewIssue(activeReviewRow.issue, "punch")}>Add punch item</button>
                  {activeReviewRow.decision && <button className="reopen" onClick={() => reopenReviewIssue(activeReviewRow.issue.id)}>Reopen review</button>}
                </div>
                {activeReviewRow.decision && <div className={`recorded-decision ${activeReviewRow.resolvedByDecision ? "complete" : "pending"}`}>
                  {activeReviewRow.resolvedByDecision ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                  <span>
                    <strong>{activeReviewRow.decision.status.toUpperCase()} · {activeReviewRow.resolvedByDecision ? "REVIEW COMPLETE" : "PENDING CLOSEOUT"} · {activeReviewRow.decision.reviewer}</strong>
                    <small>{activeReviewRow.decision.note} · {new Date(activeReviewRow.decision.updatedAt).toLocaleString()}</small>
                  </span>
                </div>}
              </div>}
            </div>}
            {reviewView === "engineering" && <>
            <div className="checks-heading">
              <div><strong>ENGINEERING REVIEW</strong><small>Airflow, pressure, sizing, and return-path checks</small></div>
              <span className={`check-pill ${activeValidationIssues.some((issue) => issue.severity === "critical") ? "critical" : activeValidationIssues.length ? "warning" : "clear"}`}>
                {activeValidationIssues.filter((issue) => issue.severity !== "info").length || "Clear"}
              </span>
            </div>
            <div className={`readiness-card ${activeValidationDashboard.counts.critical ? "critical" : activeValidationDashboard.counts.warning ? "warning" : "clear"}`}>
              <div className="readiness-score">
                <strong>{activeValidationDashboard.score}</strong>
                <span>FIELD<br />READINESS</span>
              </div>
              <div className="readiness-summary">
                <strong>{activeValidationDashboard.counts.critical ? "Critical review required" : activeValidationDashboard.counts.warning ? "Coordination items remain" : "Ready for field review"}</strong>
                <small>Review-only score. Your drawing is never changed automatically.</small>
              </div>
              <div className="readiness-metrics">
                <span><b>{activeValidationDashboard.counts.critical}</b> Critical</span>
                <span><b>{activeValidationDashboard.counts.warning}</b> Warnings</span>
                <span><b>{activeValidationDashboard.connectionProblems}</b> Connections</span>
                <span><b>{activeValidationDashboard.bedroomReturnRisks.length}</b> Bedroom risks</span>
              </div>
              <button onClick={selectNextValidationIssue} disabled={!activeValidationIssues.some((issue) => issue.drawingId)}>
                Select next drawing problem
              </button>
            </div>
            <div className={`return-path-card ${activeValidationDashboard.bedroomReturnRisks.length || activeValidationDashboard.returnDeficit ? "attention" : "good"}`}>
              <div><Route size={16} /><span><strong>RETURN &amp; DOOR-CLOSED PRESSURE</strong><small>Bedroom return-path field review</small></span></div>
              <div className="return-path-grid">
                <span><b>{activeValidationDashboard.suppliedBedrooms.length}</b> Supplied bedrooms</span>
                <span><b>{activeValidationDashboard.suppliedBedrooms.length - activeValidationDashboard.bedroomReturnRisks.length}</b> With return path</span>
                <span><b>{activeValidationDashboard.bedroomReturnRisks.length}</b> Need review</span>
                <span><b>{activeValidationDashboard.returnDeficit}</b> Return CFM short</span>
              </div>
              {activeValidationDashboard.bedroomReturnRisks.length ? <div className="return-risk-list">
                {activeValidationDashboard.bedroomReturnRisks.map((room) => <button key={room.name} onClick={() => {
                  const drawingId = room.drawingIds[0];
                  if (drawingId) {
                    setSelectedId(drawingId);
                    setSelectedIds([drawingId]);
                    setActiveTool("select");
                  }
                }}><AlertTriangle size={12} /><span><strong>{room.name}</strong><small>{room.supplyCfm} supply CFM · no assigned return path</small></span></button>)}
              </div> : <p>Every supplied bedroom with room data has an assigned return path. Verify transfer paths and pressure in the field.</p>}
            </div>
            <div className="auto-size-card">
              <div><Sparkles size={16} /><span><strong>SMART DUCT SIZING</strong><small>Calculated CFM · your residential size rules</small></span></div>
              <div className="sizing-controls">
                <label>Supply max
                  <select value={supplyVelocityLimit} onChange={(event) => setSupplyVelocityLimit(Number(event.target.value))}>
                    {[700, 750, 800, 850, 900, 950].map((value) => <option key={value} value={value}>{value} FPM</option>)}
                  </select>
                </label>
                <label>Return max
                  <select value={returnVelocityLimit} onChange={(event) => setReturnVelocityLimit(Number(event.target.value))}>
                    {[500, 550, 600, 650, 700, 750].map((value) => <option key={value} value={value}>{value} FPM</option>)}
                  </select>
                </label>
                <label>Fresh-air max
                  <select value={freshVelocityLimit} onChange={(event) => setFreshVelocityLimit(Number(event.target.value))}>
                    {[400, 450, 500, 550, 600, 650].map((value) => <option key={value} value={value}>{value} FPM</option>)}
                  </select>
                </label>
                <label>Flex maximum
                  <select value={residentialFlexMax} onChange={(event) => setResidentialFlexMax(event.target.value)}>
                    {["12", "14", "16"].map((value) => <option key={value} value={value}>{value}&quot;</option>)}
                  </select>
                </label>
              </div>
              <button onClick={() => showSizingReview ? setShowSizingReview(false) : openSizingReview()}>
                {showSizingReview ? "Close review" : `Review ${sizingSuggestions().length} changes`}
              </button>
              {showSizingReview && <div className="sizing-review">
                {sizingSuggestions().length ? <>
                  <div className="sizing-rule">{residentialFlexMax}″ maximum flex · Supply ≤{supplyVelocityLimit} FPM · Return ≤{returnVelocityLimit} FPM</div>
                  {sizingSuggestions().map((suggestion) => <div className={`sizing-suggestion ${suggestion.overCapacity ? "over-capacity" : ""}`} key={suggestion.id}>
                    <input
                      aria-label={`Approve ${suggestion.current} inch to ${suggestion.recommended} inch change`}
                      type="checkbox"
                      checked={selectedSizingIds.includes(suggestion.id)}
                      disabled={suggestion.overCapacity}
                      onChange={() => toggleSizingSuggestion(suggestion.id)}
                    />
                    <button onClick={() => { setSelectedId(suggestion.id); setActiveTool("select"); }}>
                      <span>
                        <strong>{suggestion.type.toUpperCase()} · {suggestion.cfm} CFM · {suggestion.room}</strong>
                        <small>{suggestion.current}″ existing → {suggestion.recommended}″ recommended · {suggestion.currentVelocity} → {suggestion.velocity} FPM</small>
                      </span>
                      <b>{suggestion.overCapacity ? `OVER ${suggestion.limit}` : `${suggestion.velocity} FPM`}</b>
                    </button>
                  </div>)}
                  <button className="apply-sizing" onClick={applySizingSuggestions} disabled={!selectedSizingIds.length}>
                    Apply {selectedSizingIds.filter((id) => sizingSuggestions().some((suggestion) => suggestion.id === id && !suggestion.overCapacity)).length} approved changes
                  </button>
                </> : <div className="sizing-clear"><CheckCircle2 size={17} /> Connected runs already match the sizing rules.</div>}
              </div>}
              <p className="sizing-safety-note">Recommendations are advisory. Only checked rows change, every apply is one undoable action, and over-capacity runs are never applied.</p>
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
              <span>Supply maximum {supplyVelocityLimit} FPM</span>
              <span>Return maximum {returnVelocityLimit} FPM</span>
              <span>Fresh-air maximum {freshVelocityLimit} FPM</span>
              <span>Residential flex maximum {residentialFlexMax}&quot;</span>
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
            <div className="issue-filters" aria-label="Filter design issues">
              {(["all", "critical", "warning", "info"] as const).map((filter) => <button
                className={validationFilter === filter ? "active" : ""}
                key={filter}
                onClick={() => setValidationFilter(filter)}
              >
                {filter === "all" ? `All ${activeValidationIssues.length}` : `${filter === "warning" ? "Warnings" : filter[0].toUpperCase() + filter.slice(1)} ${activeValidationIssues.filter((issue) => issue.severity === filter).length}`}
              </button>)}
            </div>
            <div className="issue-list">
              {filteredValidationIssues().length ? filteredValidationIssues().map((issue, index) => (
                <button
                  className={`issue-row ${issue.severity}`}
                  key={`${issue.title}-${index}`}
                  onClick={() => focusReviewIssue(issue)}
                >
                  {issue.severity === "info" ? <CircleDot size={15} /> : <AlertTriangle size={15} />}
                  <span><i>{issueCategory(issue.title)}</i><strong>{issue.title}</strong><small>{issue.detail}</small></span>
                </button>
              )) : <div className="checks-clear"><CheckCircle2 size={24} /><strong>{activeValidationIssues.length ? "No issues in this filter" : "Plan checks clear"}</strong><span>{activeValidationIssues.length ? "Choose another severity to continue the review." : "Airflow is balanced within ±10% and no velocity warnings were found."}</span></div>}
            </div>
            <div className="takeoff-note">Design-intent review only. Engineering objects and scheduled values govern. Field verify before fabrication and final balance.</div>
            </>}
          </div>}
          <div className="status-card"><span className="pulse" /><div><strong>{splitMode ? "Split run mode" : calibrating && pdf ? "Scale calibration" : activeTool === "measure" && pdf ? "Measurement tool" : symbolTools.includes(activeTool as SymbolKind) && pdf ? "HVAC symbol placement" : activeTool === "branch" && pdf ? pendingBranchFittingId ? "Choose branch run" : queuedBranchRunId ? "Run-first branch armed" : branchWorkflow === "run-first" ? "Pick completed branch run" : "Smart T/Y placement" : continuingRunId ? "Extending connected branch run" : draft.length ? "Drawing in progress" : pdf ? "Construction plan loaded" : "Drawing engine ready"}</strong><small>{splitMode ? "Click the duct centerline where you want two editable sections · Esc cancels" : calibrating && pdf ? `Pick two points exactly ${referenceFeet} ft apart` : activeTool === "measure" && pdf ? "Pick two points to place a field dimension" : symbolTools.includes(activeTool as SymbolKind) && pdf ? `Wheel rotates preview · Shift+wheel 45° · ${placementRotation}° · click places` : activeTool === "branch" && pdf ? branchMessage || (branchWorkflow === "run-first" ? "Click a completed diffuser run, then click its main trunk location" : "Click anywhere on a blue supply run · trunk splits automatically") : continuingRunId ? "Left-click: add route points · Shift: lock 45°/90° · Right-click: finish on the same run" : draft.length ? "Left-click: add point · Shift: lock 45°/90° · Right-click: finish · Esc: cancel" : pdf ? `${pdf.numPages} page PDF · ${drawings.length} drawing objects` : "Upload a plan to start drafting"}</small></div></div>
        </aside>
      </section>

      <section className="print-takeoff">
        <div className="print-section-heading">
          <strong>MATERIAL TAKEOFF</strong>
          <span>Approximate quantities · field verify before ordering</span>
        </div>
        <table>
          <thead><tr><th>Category</th><th>Item</th><th>Size</th><th>Quantity</th><th>Field note</th></tr></thead>
          <tbody>
            {buildTakeoff().map((row, index) => <tr key={`${row.item}-print-${index}`}>
              <td>{row.category}</td><td>{row.item}</td><td>{row.size}</td><td>{row.quantity}</td><td>{row.note}</td>
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
          {activeReviewedIssueRows.filter((row) => row.issue.severity !== "info").map((row, index) => <span key={`${row.issue.title}-print-${index}`}>• {row.issue.title}: {row.issue.detail}{row.decision ? ` · ${row.issue.severity === "critical" ? "DOCUMENTED / STILL BLOCKING" : row.resolvedByDecision ? row.decision.status.toUpperCase() : `${row.decision.status.toUpperCase()} / PENDING`} by ${row.decision.reviewer}` : ""}</span>)}
          {!activeReviewedIssueRows.filter((row) => row.issue.severity !== "info").length && <span>✓ No critical airflow or velocity issues detected.</span>}
        </div>
        <div className="print-field-package">
          <div className="print-section-heading">
            <strong>FIELD INSTALLATION RELEASE · {systemLabel(activeSystem)}</strong>
            <span>{activeFieldPackage.status}</span>
          </div>
          <div className="print-release-certificate">
            <span>Revision: <b>{activeFieldPackage.latestRelease?.revision || "NOT ISSUED"}</b></span>
            <span>Released by: <b>{activeFieldPackage.latestRelease?.releasedBy || "—"}</b></span>
            <span>Released: <b>{activeFieldPackage.latestRelease ? new Date(activeFieldPackage.latestRelease.releasedAt).toLocaleString() : "—"}</b></span>
            <span>Drawing fingerprint: <b>{activeFieldPackage.signature}</b></span>
          </div>
          <div className="print-release-summary">
            <span>Critical issues: <b>{activeFieldPackage.critical}</b></span>
            <span>Open warnings: <b>{activeFieldPackage.openWarnings}</b></span>
            <span>Connection problems: <b>{activeFieldPackage.connectionProblems}</b></span>
            <span>Missing elevations: <b>{activeFieldPackage.missingElevation}</b></span>
            <span>Checklist: <b>{activeFieldPackage.checklistComplete}/{fieldChecklistItems.length}</b></span>
          </div>
          <div className="print-field-checklist">
            {fieldChecklistItems.map((item) => <span key={`${item.id}-print`}>{activeFieldChecklist()[item.id] ? "☑" : "☐"} {item.label}</span>)}
          </div>
          {activeFieldRuns.length > 0 && <table>
            <thead><tr><th>Duct type</th><th>Size</th><th>Length</th><th>CFM</th><th>Room / area</th><th>Elevation</th><th>Connection</th></tr></thead>
            <tbody>{activeFieldRuns.map((run) => <tr key={`${run.drawing.id}-field-print`}>
              <td>{run.type}</td><td>{run.size}</td><td>{run.length.toFixed(1)} LF</td><td>{run.cfm}</td><td>{run.room}</td><td>{run.elevation}</td><td>{run.connected ? "OK" : "REVIEW"}</td>
            </tr>)}</tbody>
          </table>}
        </div>
        {activeRfiItems().length > 0 && <div className="print-rfi-list">
          <div className="print-section-heading">
            <strong>RFI &amp; CHANGE LOG · {systemLabel(activeSystem)}</strong>
            <span>{activeRfiItems().filter((item) => !["approved", "closed"].includes(item.status)).length} OPEN</span>
          </div>
          <table>
            <thead><tr><th>RFI</th><th>Status</th><th>Priority</th><th>Subject</th><th>Question</th><th>Proposed / response</th><th>Approved by</th></tr></thead>
            <tbody>{activeRfiItems().map((item) => <tr key={`${item.id}-rfi-print`}>
              <td>RFI-{String(item.number).padStart(3, "0")}</td><td>{item.status}</td><td>{item.priority}</td><td>{item.subject}</td><td>{item.question}</td><td>{item.response || item.proposedSolution || "—"}</td><td>{item.approvalBy || "—"}{item.approvedAt ? ` · ${new Date(item.approvedAt).toLocaleDateString()}` : ""}</td>
            </tr>)}</tbody>
          </table>
        </div>}
        <div className="print-commissioning">
          <div className="print-section-heading">
            <strong>STARTUP, BALANCING &amp; COMMISSIONING · {systemLabel(activeSystem)}</strong>
            <span>{commissioningSummary().ready ? "COMPLETE" : "OPEN"}</span>
          </div>
          <div className="print-release-summary">
            <span>Model: <b>{activeCommissioningRecord().model || "—"}</b></span>
            <span>Serial: <b>{activeCommissioningRecord().serial || "—"}</b></span>
            <span>Filter: <b>{activeCommissioningRecord().filterSize || "—"}</b></span>
            <span>Technician: <b>{activeCommissioningRecord().technician || "—"}</b></span>
            <span>Measured airflow: <b>{activeCommissioningRecord().measuredCfm || "—"} CFM</b></span>
            <span>Total static: <b>{commissioningSummary().totalStatic.toFixed(2)} in. w.g.</b></span>
            <span>Rated maximum: <b>{activeCommissioningRecord().ratedMaxStatic || "—"} in. w.g.</b></span>
            <span>Temperature split: <b>{activeCommissioningRecord().temperatureSplit || "—"}°F</b></span>
          </div>
          <div className="print-field-checklist">
            {commissioningChecklistItems.map((item) => <span key={`${item.id}-commissioning-print`}>{activeCommissioningRecord().checklist[item.id] ? "☑" : "☐"} {item.label}</span>)}
          </div>
          {activeCommissioningRecord().notes && <div className="print-commissioning-notes"><b>Closeout notes:</b> {activeCommissioningRecord().notes}</div>}
        </div>
        {activePunchItems().length > 0 && <div className="print-punch-list">
          <div className="print-section-heading">
            <strong>FIELD PUNCH LIST &amp; AS-BUILT RECORD · {systemLabel(activeSystem)}</strong>
            <span>{activePunchItems().filter((item) => item.status === "open").length} OPEN · {activePunchItems().filter((item) => item.status === "resolved").length} RESOLVED</span>
          </div>
          <table>
            <thead><tr><th>Status</th><th>Priority</th><th>Category</th><th>Issue</th><th>Assigned</th><th>Plan link</th><th>Field / as-built note</th></tr></thead>
            <tbody>{activePunchItems().map((item) => <tr key={`${item.id}-punch-print`}>
              <td>{item.status}</td><td>{item.priority}</td><td>{item.category}</td><td>{item.title}</td><td>{item.assignedTo || "Unassigned"}</td><td>{item.drawingId ? "Linked" : "General"}</td><td>{item.note || "—"}</td>
            </tr>)}</tbody>
          </table>
        </div>}
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

      <footer inert={showProjectHome || showProjectSetup ? true : undefined} aria-hidden={showProjectHome || showProjectSetup}>
        <span><i className="online" /> Ready</span>
        <span>{selectedIds.length ? `${selectedIds.length} selected · Arrow nudge · Shift+Arrow 10× · midpoint grips stretch` : "Right-click drag pans anywhere · left-click selects/draws · wheel zooms at cursor"}</span>
        <span><Ruler size={11} /> {scaleLabel}</span>
        <span className="footer-right">{saveState === "saving" ? "Autosaving…" : "All changes saved"} · Project Home &amp; Studio Shell v101 · Project Intelligence v100</span>
      </footer>
      <ProjectHome
        open={showProjectHome && !showProjectSetup}
        hasPlan={Boolean(pdf)}
        currentProjectName={fileName}
        currentRevisionLabel={workingCloudRevisionId ? `Cloud revision R${cloudProjectRisk?.latestRevisionNumber || "—"}` : "Local working copy"}
        driveConfigured={driveConfigured}
        busy={loading}
        notice={error}
        onClose={() => setShowProjectHome(false)}
        onNewProject={() => {
          setError("");
          setShowProjectSetup(true);
        }}
        onOpenLocal={() => {
          setError("");
          inputRef.current?.click();
        }}
        onOpenDrive={() => {
          setError("");
          void openFromDrive();
        }}
        onOpenProjectHub={(projectId) => {
          setCloudInitialProjectId(projectId || null);
          setShowProjectHome(false);
          setShowCloudProjects(true);
        }}
        onOpenCommand={() => setShowCommandPalette(true)}
      />
      {showProjectSetup && <GuidedProjectSetup
        open
        driveConfigured={driveConfigured}
        onCancel={() => setShowProjectSetup(false)}
        onStart={startGuidedProject}
      />}
      <CloudProjectsPanel
        open={showCloudProjects}
        currentName={fileName}
        currentSourceFileName={pdf ? sourceFileName || `${fileName}.pdf` : undefined}
        currentSourceDriveFileId={sourceDriveFileId}
        workingProjectId={workingCloudProjectId}
        initialProjectId={cloudInitialProjectId}
        buildSnapshot={() => buildProjectSnapshot() as unknown as Record<string, unknown>}
        onRestoreRevision={(snapshot, project, revision) => void restoreCloudRevision(snapshot, project, revision)}
        onWorkingProjectChange={(projectId) => {
          setWorkingCloudProjectId(projectId);
          setWorkingCloudRevisionId(null);
          setWorkingCloudRevisionFingerprint(null);
        }}
        onWorkingRevisionSaved={(revision) => {
          setWorkingCloudRevisionId(revision.id);
          setWorkingCloudRevisionFingerprint(
            revision.release_fingerprint ||
            String(revision.snapshot.cloudReleaseFingerprint || currentCloudReleaseFingerprint),
          );
        }}
        onProjectRiskChange={setCloudProjectRisk}
        onContinueWorkflow={() => {
          setShowCloudProjects(false);
          continueSystemWorkflow(activeWorkflow.activeStage);
        }}
        onClose={() => {
          setShowCloudProjects(false);
          if (!pdf) setShowProjectHome(true);
        }}
      />
      <ProjectCommandPalette
        open={showCommandPalette}
        commands={projectCommands}
        onClose={() => setShowCommandPalette(false)}
      />
    </main>
  );
}
