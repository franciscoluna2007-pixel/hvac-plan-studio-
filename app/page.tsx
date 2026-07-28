"use client";

import { ChangeEvent, Component, DragEvent, ErrorInfo, KeyboardEvent as ReactKeyboardEvent, PointerEvent, ReactNode, WheelEvent as ReactWheelEvent, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { checkDriveConfiguration, loadPdfFromDriveId, pickPdfFromDrive, saveProjectPackageToDrive } from "./googleDrive";
import CloudProjectsPanel, { type CloudProjectRisk } from "./CloudProjectsPanel";
import AIPlanWorkspace from "./AIPlanWorkspace";
import FieldPackageComposer from "./FieldPackageComposer";
import GuidedProjectSetup, { type ProjectSetupValues } from "./GuidedProjectSetup";
import ProjectCommandPalette, { type ProjectCommand } from "./ProjectCommandPalette";
import ProjectHome from "./ProjectHome";
import SymbolActionWheel from "./PlanSymbolActionWheel";
import { trackProductEvent } from "./productAnalytics";
import SystemBalanceStudio from "./SystemBalanceStudio";
import MarkupAssistantStudio, {
  type FixPlanIssueAnswer,
  type PlanHelperPrimaryView,
} from "./MarkupAssistantStudio";
import { type FieldPackageSectionId } from "./fieldPackage";
import type { PlanAnalysis, PlanEvidence } from "./planReader";
import { buildAdvancedPlanIntelligence } from "./advancedPlanIntelligence";
import { buildAssistantSuggestionLayer } from "./assistantSuggestionLayer";
import { buildSmartPlanSetup, type PlanScaleCandidate } from "./planSetup";
import { buildDesignStandardProfile } from "./designStandard";
import { resolveDetectedDrawingScale, scaleRatioFromLabel } from "./drawingScale";
import { deriveDrawFirstWorkflow } from "./jobWorkflow";
import {
  ASSISTANT_REPAIR_VERSION,
  buildRepairPlan,
  validateRepairSelection,
  type RepairAutonomyMode,
  type RepairBatchRecord,
  type RepairChange,
  type RunNumberRepairAction,
  type RunSizeRepairAction,
  type TerminalCfmRepairAction,
} from "./repairPlan";
import {
  applyRunNumberEdits,
  buildRunNumberCandidates,
} from "./assistantRunDetails";
import {
  describeRepairMutationChanges,
  validateRepairMutationScope,
  type RepairMutationAction,
} from "./repairSafety";
import { buildTakeoffImpact } from "./takeoffIntelligence";
import {
  clampZoom,
  midpoint,
  pinchCamera,
  pointDistance,
  renderQualityPlan,
  workspaceLayoutFor,
  type RenderQualityMode,
  type ScreenPoint,
  type WorkspaceDensity,
  type WorkspaceLayoutMode,
} from "./workspaceDisplay";
import { planFocusTarget } from "./planFocus";
import {
  loadCloudWorkspacePreferences,
  loadLocalWorkspacePreferences,
  saveCloudWorkspacePreferences,
  saveLocalWorkspacePreferences,
} from "./workspacePreferences";
import {
  PDF_START_PREFERENCE_VERSION,
  loadPdfStartPreference,
  savePdfStartPreference,
  type PdfStartMode,
} from "./pdfStartPreference";
import { projectStorageKey, resolveProjectRestore } from "./projectStorage";
import {
  DEFAULT_SYMBOL_ACTION_WHEEL_OBJECT_RADIUS_CAP_PX,
  positionSymbolActionWheel,
} from "./symbolActionWheel";
import {
  clampSymbolLabelOffset,
  compactSymbolLabelScale,
  compactSymbolScale,
  defaultSymbolLabelScale,
  defaultSymbolScale,
  estimateSymbolLabelBox,
  normalizedSymbolLabelScale,
  normalizedSymbolScale,
  signedCornerScale,
  stepSymbolLabelScale,
  stepSymbolScale,
} from "./symbolEditing";
import {
  normalizedDuctLabelScale,
  resetDuctLabelScale,
  stepDuctLabelScale,
} from "./ductLabelEditing";
import {
  buildFindingIdentity,
  type PlanFindingCategory,
  type PlanIntelligenceFinding,
} from "./planIntelligence";
import {
  buildMarkupRecommendations,
  summarizeMarkupAssistant,
  type MarkupRecommendation,
} from "./markupAssistant";
import {
  buildConnectionRepairPlan,
  prepareConnectionRepairBatch,
  type ConnectionRepairItem,
  type ConnectionRepairTarget,
  type ConnectionRunSnapshot,
} from "./connectionRepair";
import {
  FIX_PLAN_ANSWER_VERSION,
  fixPlanAnswerCompletesReview,
  isFixPlanAnswerStale,
  type FixPlanAnswerStatus,
  type FixPlanHandledReason,
} from "./fixPlanAnswers";
import {
  BALANCE_CALCULATION_VERSION,
  summarizeSystemBalance,
  type BalanceReviewRecord,
  type SystemBalanceModel,
} from "./systemBalance";
import {
  DUCT_SIZING_CALCULATION_VERSION,
  estimateRunPressureDrop,
  recommendFlexibleDuctSize,
  roundDuctVelocityFpm,
} from "./ductSizing";
import {
  listCloudApprovals,
  listCloudRepairBatches,
  listCloudRevisions,
  listCloudWorkItems,
  issueCloudFieldRelease,
  saveCloudRepairBatch,
  saveCloudPlanAnalysis,
  saveCloudTakeoffPackage,
  updateCloudPlanFindingDecision,
  type CloudProject,
  type CloudRepairBatch,
  type CloudRevision,
} from "./cloudProjects";
import { buildSystemWorkflow, type WorkflowSummary } from "./workflowEngine";
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
  Eye,
  Fan,
  FileText,
  FolderOpen,
  HardDrive,
  Home as HomeIcon,
  Grid3X3,
  Gauge,
  Lock,
  Minimize2,
  MousePointer2,
  PanelTop,
  PanelLeftClose,
  PanelRightClose,
  FlipHorizontal2,
  X,
  ChevronLeft,
  ChevronRight,
  Hand,
  Redo2,
  Route,
  Ruler,
  ScanSearch,
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
  { id: "note", label: "Plan note", icon: StickyNote, tone: "orange" },
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
const showLegacyConnectionRepairPanel = false;

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
  labelOffset?: Point;
  labelScale?: number;
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
  cfmSource?: "planning-seed" | "manual" | "room-target";
  systemId?: string;
  roomName?: string;
  roomType?: "general" | "bedroom" | "bathroom" | "closet";
  elevation?: string;
  labelOffset?: Point;
  labelScale?: number;
  runNumber?: string;
  sizeReviewed?: boolean;
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
  currentSource: "planning-seed" | "manual" | "room-target" | "unset";
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
const drawingScalePresets = [
  '1/8" = 1\'-0"',
  '3/16" = 1\'-0"',
  '1/4" = 1\'-0"',
  '1/2" = 1\'-0"',
] as const;
const defaultScaleFeetPerUnit = 1 / 24.3;
const defaultScaleLabel = '1/4" = 1\'-0"';
const allowedResidentialFlexSizes = ["4", "6", "7", "8", "10", "12", "14", "16"];

function isPrimaryAirflowEquipment(drawing?: Drawing) {
  return Boolean(
    drawing?.symbol?.kind === "equipment" &&
    primaryAirflowEquipmentVariants.has(drawing.symbol.variant || "")
  );
}

function terminalLinkedRunId(drawing: Drawing) {
  return ["diffuser", "returnGrille"].includes(drawing.symbol?.kind || "")
    ? drawing.symbol?.connectedRunId
    : undefined;
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
  | ({ kind: "point"; drawingId: string; pointIndex: number; before: Drawing[] } & EditPointer)
  | ({ kind: "line"; drawingId: string; start: Point; original: Point[]; before: Drawing[] } & EditPointer)
  | ({ kind: "label"; drawingId: string; start: Point; originalOffset: Point; before: Drawing[] } & EditPointer)
  | ({ kind: "symbol-label"; drawingId: string; start: Point; originalOffset: Point; before: Drawing[] } & EditPointer)
  | ({ kind: "symbol-label-resize"; drawingId: string; anchor: Point; startDistance: number; originalScale: number; before: Drawing[] } & EditPointer)
  | ({ kind: "fitting"; drawingId: string; start: Point; originalCenter: Point; originalPorts: Point[]; connectedIds: string[]; before: Drawing[] } & EditPointer)
  | ({ kind: "symbol"; drawingId: string; before: Drawing[] } & EditPointer)
  | ({ kind: "symbol-resize"; drawingId: string; center: Point; rotation: number; halfWidth: number; halfHeight: number; cornerX: -1 | 1; cornerY: -1 | 1; before: Drawing[] } & EditPointer)
  | ({ kind: "group"; start: Point; ids: string[]; originals: Record<string, Point[]>; before: Drawing[] } & EditPointer);
type EditPointer = {
  pointerId: number;
  pointerType: string;
};
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
type TouchGestureState = {
  pointerIds: [number, number];
  startDistance: number;
  startZoom: number;
  anchorPlan: ScreenPoint;
  latestZoom: number;
  latestCamera: ScreenPoint;
  frameId: number | null;
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

type EditTransactionSnapshot = {
  pointerId: number;
  drawings: Drawing[];
  draft: Point[];
  undoStack: Drawing[][];
  redoStack: Drawing[][];
  measureDraft: Point[];
  selectedId: string | null;
  selectedIds: string[];
  continuingRunId: string | null;
  pendingBranchFittingId: string | null;
  branchPlacementResult: { fittingId: string; message: string } | null;
  queuedBranchRunId: string | null;
  branchPreview: BranchPreview | null;
  branchMessage: string;
  branchHoverRunId: string | null;
  symbolPreview: { kind: SymbolKind; point: Point } | null;
  scaleFeetPerUnit: number;
  scaleLabel: string;
  scaleLocked: boolean;
  scaleVerified: boolean;
  calibrating: boolean;
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

type SheetScaleState = {
  feetPerUnit: number;
  label: string;
  verified: boolean;
};

type SavedProject = {
  version: 1 | 2 | 3 | 4 | 5 | 6;
  fileName: string;
  drawings: Drawing[];
  savedAt: string;
  pdfFingerprint?: string;
  scaleFeetPerUnit?: number;
  scaleLabel?: string;
  scaleVerified?: boolean;
  sheetScales?: Record<string, SheetScaleState>;
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
  roomAirflowTargetReviewFingerprints?: Record<string, string>;
  balanceReviewRecords?: BalanceReviewRecord[];
  reviewDecisionsBySystem?: Record<string, Record<string, ReviewDecision>>;
  releaseRecords?: SystemReleaseRecord[];
  takeoffPackageRecords?: TakeoffPackageRecord[];
  assistantAutonomyMode?: RepairAutonomyMode;
  assistantRepairRecords?: RepairBatchRecord[];
  activePlanAnalysis?: PlanAnalysis | null;
  workflowSummary?: WorkflowSummary;
  cloudProjectId?: string;
  cloudRevisionId?: string;
  cloudReleaseFingerprint?: string;
};

function boundedPlanAnalysisSnapshot(analysis: PlanAnalysis | null) {
  if (!analysis) return null;
  const evidence = analysis.evidence.slice(0, 600).map((row) => ({
    ...row,
    excerpt: row.excerpt.slice(0, 360),
  }));
  const findings = analysis.findings.slice(0, 160);
  const takeoff = analysis.takeoff.slice(0, 300);
  return {
    ...analysis,
    evidence,
    findings,
    takeoff,
    persistence: {
      truncated:
        evidence.length < analysis.evidence.length ||
        findings.length < analysis.findings.length ||
        takeoff.length < analysis.takeoff.length,
      originalEvidenceCount: analysis.evidence.length,
      savedEvidenceCount: evidence.length,
      originalFindingCount: analysis.findings.length,
      savedFindingCount: findings.length,
      originalTakeoffCount: analysis.takeoff.length,
      savedTakeoffCount: takeoff.length,
    },
  } satisfies PlanAnalysis;
}

function repairRecordFromCloud(batch: CloudRepairBatch): RepairBatchRecord {
  return {
    id: batch.client_receipt_id,
    cloudBatchId: batch.id,
    repairPlanId: batch.repair_plan_id,
    systemId: batch.system_id,
    repairVersion: batch.assistant_version,
    evidenceFingerprint: batch.evidence_fingerprint,
    beforeDrawingFingerprint: batch.before_fingerprint,
    afterDrawingFingerprint: batch.after_fingerprint,
    autonomyMode: batch.autonomy_mode,
    actionIds: batch.action_payload.map((action) => action.id),
    actions: batch.action_payload,
    takeoffImpact: batch.takeoff_delta,
    reviewer: batch.reviewer_name,
    note: batch.note,
    planningOverrideAcknowledged: batch.planning_override_acknowledged,
    createdAt: batch.created_at,
    cloudSync: "synced",
  };
}

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
  ruleId: string;
  evidenceFingerprint: string;
  legacyId?: string;
  instanceKey?: string;
  severity: ValidationSeverity;
  title: string;
  detail: string;
  drawingId?: string;
};
type ReviewDecisionStatus = FixPlanAnswerStatus;
type ReviewDecision = {
  issueId: string;
  evidenceFingerprint?: string;
  sourceFingerprint?: string;
  answerVersion?: typeof FIX_PLAN_ANSWER_VERSION;
  systemId?: string;
  page?: number;
  status: ReviewDecisionStatus;
  reviewer: string;
  note: string;
  updatedAt: string;
  linkedRecordId?: string;
  handledReason?: FixPlanHandledReason;
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
  issueSnapshot?: Array<{ id: string; ruleId: string; evidenceFingerprint: string; severity: ValidationSeverity; title: string; detail: string; disposition: string; reviewer: string; note: string }>;
  rulesSnapshot?: {
    scaleLabel: string;
    scaleFeetPerUnit: number;
    sheetScales?: Record<string, SheetScaleState>;
    supplyVelocityLimit: number;
    returnVelocityLimit: number;
    freshVelocityLimit: number;
    residentialFlexMax: string;
  };
};

type TakeoffRow = {
  category: string;
  item: string;
  size: string;
  quantity: string;
  note: string;
};

type TakeoffPackageRecord = {
  id: string;
  systemId: string;
  name: string;
  revision: string;
  preparedBy: string;
  createdAt: string;
  drawingSignature: string;
  lineItemCount: number;
  flexRollCount: number;
  deviceCount: number;
  fittingCount: number;
  holdCount: number;
  driveFileId?: string;
  driveUrl?: string;
};

type PdfOpenContext = {
  requestId: number;
  mode: PdfStartMode;
  source: "local" | "drive";
  origin: "home" | "workspace" | "drop" | "guided";
  setup: ProjectSetupValues | null;
};

type ProjectRestoreResult = "new" | "restored" | "source-mismatch";
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
    void trackProductEvent("application_error", { area: "workspace_boundary" });
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
  const pendingPdfOpenRef = useRef<PdfOpenContext | null>(null);
  const pdfOpenRequestRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasViewportRef = useRef<HTMLDivElement>(null);
  const pdfStageRef = useRef<HTMLDivElement>(null);
  const planSheetRef = useRef<HTMLDivElement>(null);
  const displaySettingsTriggerRef = useRef<HTMLButtonElement>(null);
  const displaySettingsCloseRef = useRef<HTMLButtonElement>(null);
  const displaySettingsPanelRef = useRef<HTMLElement>(null);
  const displaySettingsLastFocusRef = useRef<HTMLElement | null>(null);
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pdfFingerprint, setPdfFingerprint] = useState("");
  const [sourceDriveFileId, setSourceDriveFileId] = useState<string | null>(null);
  const [sourceFileName, setSourceFileName] = useState<string | null>(null);
  const [fileName, setFileName] = useState("Untitled HVAC Plan");
  const [workingCloudProjectId, setWorkingCloudProjectId] = useState<string | null>(null);
  const [workingCloudRevisionId, setWorkingCloudRevisionId] = useState<string | null>(null);
  const [workingCloudRevisionFingerprint, setWorkingCloudRevisionFingerprint] = useState<string | null>(null);
  const [cloudProjectRisk, setCloudProjectRisk] = useState<CloudProjectRisk | null>(null);
  const [cloudPlanAnalysisRunId, setCloudPlanAnalysisRunId] = useState<string | null>(null);
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
  const [runLineWeights, setRunLineWeights] = useState({ supply: 0.1, return: 0.1 });
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [undoStack, setUndoStack] = useState<Drawing[][]>([]);
  const [redoStack, setRedoStack] = useState<Drawing[][]>([]);
  const [draft, setDraft] = useState<Point[]>([]);
  const [continuingRunId, setContinuingRunId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectionBox, setSelectionBox] = useState<{ start: Point; end: Point; additive: boolean; pointerId: number } | null>(null);
  const [renderSize, setRenderSize] = useState({ width: 0, height: 0 });
  const [canvasViewportSize, setCanvasViewportSize] = useState({ width: 1, height: 1 });
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
  const [connectionReviewOpen, setConnectionReviewOpen] = useState(false);
  const [connectionReviewFingerprint, setConnectionReviewFingerprint] = useState("");
  const [selectedConnectionRepairIds, setSelectedConnectionRepairIds] = useState<string[]>([]);
  const [focusedConnectionRepairId, setFocusedConnectionRepairId] = useState<string | null>(null);
  const [connectionCandidateChoices, setConnectionCandidateChoices] = useState<Record<string, string>>({});
  const [scaleFeetPerUnit, setScaleFeetPerUnit] = useState(defaultScaleFeetPerUnit);
  const [scaleLabel, setScaleLabel] = useState(defaultScaleLabel);
  const [scaleLocked, setScaleLocked] = useState(true);
  const [scaleVerified, setScaleVerified] = useState(false);
  const [sheetScales, setSheetScales] = useState<Record<string, SheetScaleState>>({});
  const [calibrating, setCalibrating] = useState(false);
  const [scaleHelperReturnPending, setScaleHelperReturnPending] = useState(false);
  const [referenceFeet, setReferenceFeet] = useState("10");
  const [measureDraft, setMeasureDraft] = useState<Point[]>([]);
  const [rightTab, setRightTab] = useState<"builder" | "layers" | "rooms" | "network" | "takeoff" | "field" | "checks">("builder");
  const [leftPanelView, setLeftPanelView] = useState<"draw" | "symbols" | "properties">("draw");
  const [balanceView, setBalanceView] = useState<"system" | "rooms" | "runs">("system");
  const [saveState, setSaveState] = useState<"saved" | "saving">("saved");
  const [showCloudProjects, setShowCloudProjects] = useState(false);
  const [cloudInitialProjectId, setCloudInitialProjectId] = useState<string | null>(null);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showPlanIntelligence, setShowPlanIntelligence] = useState(false);
  const [planWorkspaceInitialView, setPlanWorkspaceInitialView] = useState<"setup" | "reader" | "findings">("setup");
  const [showFieldPackageComposer, setShowFieldPackageComposer] = useState(false);
  const [showSystemBalanceStudio, setShowSystemBalanceStudio] = useState(false);
  const [showMarkupAssistant, setShowMarkupAssistant] = useState(false);
  const [assistantInitialView, setAssistantInitialView] = useState<PlanHelperPrimaryView>("setup");
  const [activeMarkupRecommendation, setActiveMarkupRecommendation] = useState<MarkupRecommendation | undefined>();
  const [assistantFocusedRecommendationId, setAssistantFocusedRecommendationId] = useState("");
  const [showAssistantSuggestionLayer, setShowAssistantSuggestionLayer] = useState(false);
  const [assistantAutonomyMode, setAssistantAutonomyMode] = useState<RepairAutonomyMode>("prepare");
  const [assistantSelectedActionIds, setAssistantSelectedActionIds] = useState<string[]>([]);
  const [assistantPreparedEvidenceFingerprint, setAssistantPreparedEvidenceFingerprint] = useState("");
  const [assistantPreparedRepairPlanId, setAssistantPreparedRepairPlanId] = useState("");
  const [assistantRepairRecords, setAssistantRepairRecords] = useState<RepairBatchRecord[]>([]);
  const [activePlanAnalysis, setActivePlanAnalysis] = useState<PlanAnalysis | null>(null);
  const [planEvidenceRegion, setPlanEvidenceRegion] = useState<{
    page: number;
    region: NonNullable<PlanEvidence["region"]>;
  } | null>(null);
  const [printPackageSections, setPrintPackageSections] = useState<FieldPackageSectionId[]>([
    "plan",
    "release",
    "materials",
    "airflow",
    "review",
    "coordination",
    "startup",
  ]);
  const [showProjectHome, setShowProjectHome] = useState(true);
  const [showProjectSetup, setShowProjectSetup] = useState(false);
  const [pdfStartMode, setPdfStartMode] = useState<PdfStartMode>("direct");
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
  useEffect(() => {
    setShowAssistantSuggestionLayer(false);
  }, [pageNumber, pdfFingerprint]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const handleFilePickerCancel = () => {
      const pendingOpen = pendingPdfOpenRef.current;
      pendingPdfOpenRef.current = null;
      if (pendingOpen?.origin !== "workspace") setShowProjectHome(true);
    };
    input.addEventListener("cancel", handleFilePickerCancel);
    return () => input.removeEventListener("cancel", handleFilePickerCancel);
  }, []);

  useEffect(() => {
    setPdfStartMode(loadPdfStartPreference().mode);
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
  const [takeoffPackageRecords, setTakeoffPackageRecords] = useState<TakeoffPackageRecord[]>([]);
  const [takeoffView, setTakeoffView] = useState<"overview" | "materials" | "installer" | "packages">("overview");
  const [takeoffPackageName, setTakeoffPackageName] = useState("");
  const [takeoffRevision, setTakeoffRevision] = useState("");
  const [takeoffPreparedBy, setTakeoffPreparedBy] = useState("");
  const [takeoffSaving, setTakeoffSaving] = useState(false);
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
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [workspaceLayout, setWorkspaceLayout] = useState<WorkspaceLayoutMode>("desktop");
  const [workspaceDensity, setWorkspaceDensity] = useState<WorkspaceDensity>("comfortable");
  const [renderQuality, setRenderQuality] = useState<RenderQualityMode>("auto");
  const [showDisplaySettings, setShowDisplaySettings] = useState(false);
  const [devicePixelRatio, setDevicePixelRatio] = useState(1);
  const [renderQualityStatus, setRenderQualityStatus] = useState({
    label: "Auto · preparing",
    megapixels: 0,
    reduced: false,
  });
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
  const [roomAirflowTargetReviewFingerprints, setRoomAirflowTargetReviewFingerprints] = useState<Record<string, string>>({});
  const [selectedCfmProposalIds, setSelectedCfmProposalIds] = useState<string[]>([]);
  const [balanceReviewRecords, setBalanceReviewRecords] = useState<BalanceReviewRecord[]>([]);

  const currentCloudReleaseFingerprint = useMemo(() => cloudReleaseFingerprintFromProject({
    drawings,
    pdfFingerprint,
    scaleFeetPerUnit,
    scaleLabel,
    scaleVerified,
    sheetScales,
    systemNames,
    supplyVelocityLimit,
    returnVelocityLimit,
    freshVelocityLimit,
    residentialFlexMax,
    fieldChecklistBySystem,
    punchItems,
    rfiItems,
    roomAirflowTargets,
    roomAirflowTargetReviewFingerprints,
    balanceReviewRecords,
    reviewDecisionsBySystem,
  }), [balanceReviewRecords, drawings, fieldChecklistBySystem, freshVelocityLimit, pdfFingerprint, punchItems, residentialFlexMax, returnVelocityLimit, reviewDecisionsBySystem, rfiItems, roomAirflowTargetReviewFingerprints, roomAirflowTargets, scaleFeetPerUnit, scaleLabel, scaleVerified, sheetScales, supplyVelocityLimit, systemNames]);

  useEffect(() => {
    setSelectedCfmProposalIds([]);
    setSelectedSizingIds([]);
    setActiveMarkupRecommendation(undefined);
  }, [activeSystem]);

  useEffect(() => {
    if (!workingCloudProjectId || rightTab !== "field" || fieldView !== "release") return;
    void refreshWorkingCloudRisk();
    const timer = window.setInterval(() => void refreshWorkingCloudRisk(), 60_000);
    return () => window.clearInterval(timer);
  }, [fieldView, refreshWorkingCloudRisk, rightTab, workingCloudProjectId]);

  const dragRef = useRef<DragState | null>(null);
  const panRef = useRef<PanState | null>(null);
  const touchPointersRef = useRef(new Map<number, ScreenPoint>());
  const touchGestureRef = useRef<TouchGestureState | null>(null);
  const activeEditPointerIdRef = useRef<number | null>(null);
  const completedEditPointerIdsRef = useRef(new Set<number>());
  const editTransactionRef = useRef<EditTransactionSnapshot | null>(null);
  const activePenPointerIdRef = useRef<number | null>(null);
  const lastPenActivityRef = useRef(Number.NEGATIVE_INFINITY);
  const pdfRenderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);
  const pdfRenderGenerationRef = useRef(0);
  const pdfRenderKeyRef = useRef("");
  const renderedPageNumberRef = useRef(0);
  const viewportSizeRef = useRef({ width: 0, height: 0 });
  const preferencesHydratedRef = useRef(false);
  const initialResponsiveLayoutRef = useRef(false);
  const pendingFocusRef = useRef<{
    page: number;
    point: Point;
    avoidAssistant?: boolean;
  } | null>(null);
  const zoomRef = useRef(zoom);

  useLayoutEffect(() => {
    if (!pdfStageRef.current || panRef.current || touchGestureRef.current) return;
    pdfStageRef.current.style.transformOrigin = "0 0";
    pdfStageRef.current.style.transform = `translate3d(${camera.x}px, ${camera.y}px, 0)`;
  }, [camera.x, camera.y, pdf, renderSize.height, renderSize.width]);
  const cameraRef = useRef(camera);
  const clipboardRef = useRef<Drawing | null>(null);
  const placementWheelAtRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const applyPreferences = (preferences: ReturnType<typeof loadLocalWorkspacePreferences>) => {
      const coarse = window.matchMedia("(pointer: coarse)").matches;
      const layout = workspaceLayoutFor(window.innerWidth, window.innerHeight, coarse);
      const closeConflictingTabletDrawers =
        layout !== "desktop" && preferences.leftPanelOpen && preferences.rightPanelOpen;
      setRenderQuality(preferences.renderQuality);
      setWorkspaceDensity(coarse && preferences.density === "compact" ? "comfortable" : preferences.density);
      setLeftPanelOpen(closeConflictingTabletDrawers ? false : preferences.leftPanelOpen);
      setRightPanelOpen(false);
    };
    applyPreferences(loadLocalWorkspacePreferences());
    void loadCloudWorkspacePreferences().then((cloudPreferences) => {
      if (!cancelled && cloudPreferences) applyPreferences(cloudPreferences);
    }).finally(() => {
      if (!cancelled) preferencesHydratedRef.current = true;
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!preferencesHydratedRef.current) return;
    const preferences = {
      renderQuality,
      density: workspaceDensity,
      leftPanelOpen,
      rightPanelOpen,
    };
    saveLocalWorkspacePreferences(preferences);
    const timer = window.setTimeout(() => void saveCloudWorkspacePreferences(preferences), 900);
    return () => window.clearTimeout(timer);
  }, [leftPanelOpen, renderQuality, rightPanelOpen, workspaceDensity]);

  useEffect(() => {
    const closeTransientWorkspaceUi = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (showDisplaySettings) {
        setShowDisplaySettings(false);
        return;
      }
      if (workspaceLayout !== "desktop" && (leftPanelOpen || rightPanelOpen)) {
        setLeftPanelOpen(false);
        setRightPanelOpen(false);
      }
    };
    window.addEventListener("keydown", closeTransientWorkspaceUi);
    return () => window.removeEventListener("keydown", closeTransientWorkspaceUi);
  }, [leftPanelOpen, rightPanelOpen, showDisplaySettings, workspaceLayout]);

  useEffect(() => {
    if (showDisplaySettings) {
      displaySettingsLastFocusRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const frame = requestAnimationFrame(() => displaySettingsCloseRef.current?.focus());
      return () => cancelAnimationFrame(frame);
    }
    const previous = displaySettingsLastFocusRef.current;
    displaySettingsLastFocusRef.current = null;
    previous?.focus();
  }, [showDisplaySettings]);

  useEffect(() => {
    const viewport = canvasViewportRef.current;
    if (!viewport) return;
    const measure = () => {
      const bounds = viewport.getBoundingClientRect();
      const width = Math.max(1, bounds.width);
      const height = Math.max(1, bounds.height);
      const coarse = window.matchMedia("(pointer: coarse)").matches;
      const nextLayout = workspaceLayoutFor(window.innerWidth, window.innerHeight, coarse);
      setWorkspaceLayout(nextLayout);
      setDevicePixelRatio(Math.max(1, window.devicePixelRatio || 1));

      const previous = viewportSizeRef.current;
      if (pdf && previous.width && previous.height && (previous.width !== width || previous.height !== height)) {
        const planCenter = {
          x: (previous.width / 2 - cameraRef.current.x) / zoomRef.current,
          y: (previous.height / 2 - cameraRef.current.y) / zoomRef.current,
        };
        updateCamera({
          x: width / 2 - planCenter.x * zoomRef.current,
          y: height / 2 - planCenter.y * zoomRef.current,
        });
      }
      viewportSizeRef.current = { width, height };
      setCanvasViewportSize((current) =>
        current.width === width && current.height === height ? current : { width, height }
      );

      if (!initialResponsiveLayoutRef.current) {
        initialResponsiveLayoutRef.current = true;
        if (nextLayout !== "desktop") {
          setLeftPanelOpen(false);
          setRightPanelOpen(false);
        }
      }
    };
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
    };
  }, [pdf]);

  const airflowNetworkModel = useMemo(() => calculateAirflowNetwork(), [drawings]);
  const activeValidationIssues = useMemo(
    () => validationIssues(),
    [activeSystem, drawings, freshVelocityLimit, residentialFlexMax, returnVelocityLimit, scaleFeetPerUnit, sheetScales, supplyVelocityLimit, systemNames],
  );
  const activeReviewedIssueRows = useMemo(
    () => reviewedIssueRows(activeValidationIssues),
    [activeSystem, activeValidationIssues, fileName, pdfFingerprint, punchItems, reviewDecisionsBySystem, rfiItems],
  );
  const activePlanIntelligenceFindings = useMemo<PlanIntelligenceFinding[]>(
    () => activeReviewedIssueRows.map((row) => ({
      ...row.issue,
      category: issueCategory(row.issue.title),
      reference: reviewIssueReference(row.issue),
      resolved: row.resolvedByDecision,
      decisionStatus: row.decision?.status,
      decisionStale: row.decisionStale,
    })),
    [activeReviewedIssueRows],
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
    [activeFieldConnections, activeReviewSummary, activeSystem, cloudProjectRisk, currentCloudReleaseFingerprint, drawings, fieldChecklistBySystem, freshVelocityLimit, pdfFingerprint, punchItems, releaseRecords, residentialFlexMax, returnVelocityLimit, rfiItems, roomAirflowTargets, scaleFeetPerUnit, scaleLabel, scaleVerified, sheetScales, supplyVelocityLimit, workingCloudProjectId, workingCloudRevisionFingerprint, workingCloudRevisionId],
  );
  const activeConnectionRepairPlan = useMemo(
    () => buildActiveConnectionRepairPlan(),
    // The planner reads only these reactive values; geometry helpers are pure function declarations in this component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeSystem, connectionCandidateChoices, drawings, pageNumber, scaleFeetPerUnit, scaleVerified, sheetScales],
  );
  const activeBuilderSummary = useMemo(
    () => systemBuilderSummary(activeValidationDashboard, activeFieldPackage, activeConnectionRepairPlan),
    [activeConnectionRepairPlan, activeFieldPackage, activeSystem, activeValidationDashboard, drawings, residentialFlexMax, returnVelocityLimit, supplyVelocityLimit],
  );
  const activeConnectionRepairIssues = activeConnectionRepairPlan.items.filter((item) => item.status !== "healthy");
  const focusedConnectionRepairItem = activeConnectionRepairPlan.items.find((item) => item.id === focusedConnectionRepairId);
  const selectedReadyConnectionRepairIds = selectedConnectionRepairIds.filter((id) =>
    activeConnectionRepairPlan.items.some((item) => item.id === id && item.status === "ready")
  );
  const connectionReviewStale = Boolean(
    connectionReviewFingerprint &&
    connectionReviewFingerprint !== activeConnectionRepairPlan.fingerprint
  );
  const projectCommandSnapshot = useMemo(
    () => projectCommandSummary(),
    [activeFieldPackage, activeSystem, commissioningBySystem, drawings, fieldChecklistBySystem, pageNumber, punchItems, releaseRecords, reviewDecisionsBySystem, rfiItems, scaleFeetPerUnit, scaleLabel, scaleVerified, sheetScales],
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
    setLeftPanelView((current) => selectedId ? "properties" : current === "properties" ? "draw" : current);
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

  function scaleStateForPage(page: number): SheetScaleState {
    const saved = sheetScales[String(page)];
    if (
      saved &&
      Number.isFinite(saved.feetPerUnit) &&
      saved.feetPerUnit > 0
    ) {
      return saved;
    }
    return {
      feetPerUnit: defaultScaleFeetPerUnit,
      label: defaultScaleLabel,
      verified: false,
    };
  }

  function activateSheetScale(page: number) {
    const next = scaleStateForPage(page);
    setScaleFeetPerUnit(next.feetPerUnit);
    setScaleLabel(next.label);
    setScaleVerified(next.verified);
    setScaleLocked(true);
  }

  function rememberActiveSheetScale(page: number, next: SheetScaleState) {
    setSheetScales((current) => ({ ...current, [String(page)]: next }));
    setScaleFeetPerUnit(next.feetPerUnit);
    setScaleLabel(next.label);
    setScaleVerified(next.verified);
    setScaleLocked(true);
  }

  function systemScaleStatus(systemId = activeSystem) {
    const pages = [...new Set(drawings
      .filter((drawing) =>
        drawingSystem(drawing) === systemId &&
        (
          ["supply", "return", "fresh"].includes(drawing.type) ||
          ["diffuser", "returnGrille"].includes(drawing.symbol?.kind || "") ||
          isPrimaryAirflowEquipment(drawing)
        )
      )
      .map((drawing) => drawing.page))]
      .sort((left, right) => left - right);
    if (!pages.length) {
      return {
        verified: scaleVerified,
        pages: [pageNumber],
        missingPages: scaleVerified ? [] : [pageNumber],
        detail: scaleVerified ? scaleLabel : `Sheet ${pageNumber} needs a scale`,
      };
    }
    const missingPages = pages.filter((page) => !scaleStateForPage(page).verified);
    const labels = [...new Set(pages
      .map((page) => scaleStateForPage(page))
      .filter((scale) => scale.verified)
      .map((scale) => scale.label))];
    return {
      verified: missingPages.length === 0,
      pages,
      missingPages,
      detail: missingPages.length
        ? `Verify scale on sheet${missingPages.length === 1 ? "" : "s"} ${missingPages.join(", ")}`
        : labels.length === 1
          ? `${labels[0]} on ${pages.length} sheet${pages.length === 1 ? "" : "s"}`
          : `${pages.length} sheet scales verified`,
    };
  }

  function systemSheetScaleSnapshot(systemId = activeSystem) {
    return Object.fromEntries(
      systemScaleStatus(systemId).pages.map((page) => [
        String(page),
        { ...scaleStateForPage(page) },
      ]),
    );
  }

  function resetProjectWorkflowState() {
    setScaleFeetPerUnit(defaultScaleFeetPerUnit);
    setScaleLabel(defaultScaleLabel);
    setScaleLocked(true);
    setScaleVerified(false);
    setSheetScales({});
    setScaleHelperReturnPending(false);
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
    setRoomAirflowTargetReviewFingerprints({});
    setBalanceReviewRecords([]);
    setReviewDecisionsBySystem({});
    setReleaseRecords([]);
    setTakeoffPackageRecords([]);
    setAssistantAutonomyMode("prepare");
    setAssistantSelectedActionIds([]);
    setAssistantPreparedEvidenceFingerprint("");
    setAssistantPreparedRepairPlanId("");
    setAssistantRepairRecords([]);
    setActivePlanAnalysis(null);
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
    const restoredSheetScales = Object.fromEntries(
      Object.entries(project.sheetScales || {}).filter(([, scale]) =>
        Number.isFinite(scale?.feetPerUnit) &&
        scale.feetPerUnit > 0 &&
        Boolean(scale.label)
      )
    ) as Record<string, SheetScaleState>;
    if (!Object.keys(restoredSheetScales).length && project.scaleVerified) {
      const legacyScale: SheetScaleState = {
        feetPerUnit: project.scaleFeetPerUnit || defaultScaleFeetPerUnit,
        label: project.scaleLabel || defaultScaleLabel,
        verified: true,
      };
      // Older saves had one global scale. Keep that evidence on the first sheet only;
      // every additional sheet must be confirmed instead of inheriting a possibly wrong scale.
      restoredSheetScales["1"] = legacyScale;
    }
    const firstSheetScale = restoredSheetScales["1"] || {
      feetPerUnit: defaultScaleFeetPerUnit,
      label: defaultScaleLabel,
      verified: false,
    };
    setDrawings(synchronizeFittingSizes(restoredDrawings, restoredDrawings));
    setPageNumber(1);
    setSheetScales(restoredSheetScales);
    setScaleFeetPerUnit(firstSheetScale.feetPerUnit);
    setScaleLabel(firstSheetScale.label);
    setScaleLocked(true);
    setScaleVerified(firstSheetScale.verified);
    setCalibrating(false);
    setScaleHelperReturnPending(false);
    if (sourceFingerprint && project.pdfFingerprint && project.pdfFingerprint !== sourceFingerprint) {
      setBranchMessage("A revised PDF was detected. Existing markups were restored, but every prior field release is now stale");
    }
    setSystemNames({ ...defaultSystemNames, ...(project.systemNames || {}) });
    setActiveSystem(project.workflowSummary?.activeSystemId || "system-1");
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
    setRoomAirflowTargetReviewFingerprints(project.roomAirflowTargetReviewFingerprints || {});
    setBalanceReviewRecords(Array.isArray(project.balanceReviewRecords) ? project.balanceReviewRecords : []);
    setReviewDecisionsBySystem(project.reviewDecisionsBySystem || {});
    setReleaseRecords(project.releaseRecords || []);
    setTakeoffPackageRecords(project.takeoffPackageRecords || []);
    setAssistantAutonomyMode(project.assistantAutonomyMode || "prepare");
    setAssistantSelectedActionIds([]);
    setAssistantPreparedEvidenceFingerprint("");
    setAssistantPreparedRepairPlanId("");
    setAssistantRepairRecords(Array.isArray(project.assistantRepairRecords) ? project.assistantRepairRecords : []);
    setActivePlanAnalysis(
      project.activePlanAnalysis &&
      (!sourceFingerprint || project.activePlanAnalysis.sourceFingerprint === sourceFingerprint)
        ? project.activePlanAnalysis
        : null,
    );
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

  function resetForNewSource() {
    setDrawings([]);
    setWorkingCloudProjectId(null);
    setWorkingCloudRevisionId(null);
    setWorkingCloudRevisionFingerprint(null);
    resetProjectWorkflowState();
    setUndoStack([]);
    setRedoStack([]);
  }

  function restoreProject(name: string, sourceFingerprint: string): ProjectRestoreResult {
    try {
      const exactStored = localStorage.getItem(projectStorageKey(name, sourceFingerprint));
      const legacyStored = localStorage.getItem(projectStorageKey(name));
      const decision = resolveProjectRestore<SavedProject>(
        exactStored,
        legacyStored,
        sourceFingerprint,
      );
      if (decision.status !== "restored") {
        resetForNewSource();
        return decision.status;
      }
      applyProjectSnapshot(decision.project, sourceFingerprint);
      return "restored";
    } catch {
      resetForNewSource();
      return "new";
    }
  }

  function applyProjectSetup(setup: ProjectSetupValues | null) {
    if (!setup) return;
    const unitsPerFoot: Record<ProjectSetupValues["scale"], number> = {
      '1/8" = 1\'-0"': 12.15,
      '3/16" = 1\'-0"': 18.225,
      '1/4" = 1\'-0"': 24.3,
      '1/2" = 1\'-0"': 48.6,
    };
    setDuctSize(setup.defaultDuctSize);
    const setupScale: SheetScaleState = {
      feetPerUnit: 1 / unitsPerFoot[setup.scale],
      label: setup.scale,
      verified: false,
    };
    setSheetScales({ "1": setupScale });
    setScaleFeetPerUnit(setupScale.feetPerUnit);
    setScaleLabel(setupScale.label);
    setScaleLocked(true);
    setScaleVerified(false);
    setCalibrating(false);
    setScaleHelperReturnPending(false);
    setMeasureDraft([]);
    setBranchMessage(
      `Project setup ready · ${setup.tonnage} ton / ${Number(setup.tonnage) * 400} CFM reference · verify the drawing scale before measurement`,
    );
    setShowProjectHome(false);
    if (setup.collaboration === "cloud") setShowCloudProjects(true);
  }

  function createPdfOpenContext(
    source: PdfOpenContext["source"],
    mode: PdfOpenContext["mode"],
    origin: PdfOpenContext["origin"],
    setup: ProjectSetupValues | null = null,
  ): PdfOpenContext {
    return {
      requestId: ++pdfOpenRequestRef.current,
      source,
      mode,
      origin,
      setup,
    };
  }

  function updatePdfStartMode(mode: PdfStartMode) {
    setPdfStartMode(mode);
    savePdfStartPreference({
      version: PDF_START_PREFERENCE_VERSION,
      mode,
    });
    void trackProductEvent("pdf_start_preference_changed", { mode });
  }

  function startDirectLocalPdf(origin: "home" | "workspace" = "workspace") {
    if (loading) return;
    pendingPdfOpenRef.current = createPdfOpenContext("local", "direct", origin);
    inputRef.current?.click();
  }

  function startGuidedProject(setup: ProjectSetupValues) {
    setShowProjectSetup(false);
    const context = createPdfOpenContext(setup.source, "guided", "guided", setup);
    if (setup.source === "drive") {
      void openFromDrive(context);
    } else {
      pendingPdfOpenRef.current = context;
      inputRef.current?.click();
    }
  }

  async function replacePdfDocument(
    document: pdfjsLib.PDFDocumentProxy,
    requestId?: number,
  ) {
    if (requestId && requestId !== pdfOpenRequestRef.current) {
      await document.destroy();
      return false;
    }
    pdfRenderGenerationRef.current += 1;
    pdfRenderTaskRef.current?.cancel();
    pdfRenderTaskRef.current = null;
    pdfRenderKeyRef.current = "";
    renderedPageNumberRef.current = 0;
    const previous = pdf;
    if (previous && previous !== document) {
      try {
        await previous.destroy();
      } catch {
        // A replaced worker may already be shutting down. The new plan can still open safely.
      }
    }
    if (requestId && requestId !== pdfOpenRequestRef.current) {
      await document.destroy();
      return false;
    }
    setPdf(document);
    return true;
  }

  function directOpenStatus(result: ProjectRestoreResult) {
    if (result === "source-mismatch") {
      return "PDF opened as a new job because its contents differ from the saved plan with this name. The older markups were kept separately.";
    }
    if (result === "restored") {
      return "PDF open. Your matching saved markups were restored, and plan information is being checked in the background.";
    }
    return "PDF open. Start drawing now; scale, rooms, heights, and equipment are being checked in the background.";
  }

  async function openPdf(file?: File, openContext?: PdfOpenContext) {
    if (!file) return;
    const context = openContext || createPdfOpenContext("local", "direct", "workspace");
    const pdfByName = /\.pdf$/i.test(file.name);
    if (file.type !== "application/pdf" && !pdfByName) {
      setError("Please choose a PDF construction plan.");
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      setError("This PDF is larger than 100 MB. Optimize or split the plan set, then try again.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (context.requestId !== pdfOpenRequestRef.current) return;
      const sourceFingerprint = stableByteHash(bytes);
      const document = await pdfjsLib.getDocument({ data: bytes }).promise;
      if (context.requestId !== pdfOpenRequestRef.current) {
        await document.destroy();
        return;
      }
      const projectName = context.setup?.projectName.trim() || file.name.replace(/\.pdf$/i, "");
      if (!await replacePdfDocument(document, context.requestId)) return;
      setPdfFingerprint(sourceFingerprint);
      setSourceDriveFileId(null);
      setSourceFileName(file.name);
      setWorkingCloudProjectId(null);
      setWorkingCloudRevisionId(null);
      setWorkingCloudRevisionFingerprint(null);
      setFileName(projectName);
      setPageNumber(1);
      setZoom(1);
      const restoreResult = restoreProject(projectName, sourceFingerprint);
      applyProjectSetup(context.setup);
      if (context.mode === "direct") setBranchMessage(directOpenStatus(restoreResult));
      setShowProjectHome(false);
      setShowProjectSetup(false);
      void trackProductEvent("pdf_opened", {
        origin: context.origin === "drop" ? "drop" : "local",
        entry_mode: context.mode,
        page_count: document.numPages,
      });
    } catch {
      if (context.requestId === pdfOpenRequestRef.current) {
        setError("This PDF could not be opened. Try another file.");
      }
    } finally {
      if (context.requestId === pdfOpenRequestRef.current) setLoading(false);
    }
  }

  async function openPdfBytes(
    name: string,
    bytes: Uint8Array,
    driveFileId?: string | null,
    openContext?: PdfOpenContext,
  ) {
    const context = openContext || createPdfOpenContext(
      driveFileId ? "drive" : "local",
      "direct",
      "workspace",
    );
    if (bytes.byteLength > 100 * 1024 * 1024) {
      setError("This Drive PDF is larger than 100 MB. Optimize or split the plan set, then try again.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      if (context.requestId !== pdfOpenRequestRef.current) return;
      const sourceFingerprint = stableByteHash(bytes);
      const document = await pdfjsLib.getDocument({ data: bytes }).promise;
      if (context.requestId !== pdfOpenRequestRef.current) {
        await document.destroy();
        return;
      }
      const projectName = context.setup?.projectName.trim() || name.replace(/\.pdf$/i, "");
      if (!await replacePdfDocument(document, context.requestId)) return;
      setPdfFingerprint(sourceFingerprint);
      setSourceDriveFileId(driveFileId || null);
      setSourceFileName(name);
      setWorkingCloudProjectId(null);
      setWorkingCloudRevisionId(null);
      setWorkingCloudRevisionFingerprint(null);
      setFileName(projectName);
      setPageNumber(1);
      setZoom(1);
      const restoreResult = restoreProject(projectName, sourceFingerprint);
      applyProjectSetup(context.setup);
      if (context.mode === "direct") setBranchMessage(directOpenStatus(restoreResult));
      setShowProjectHome(false);
      setShowProjectSetup(false);
      void trackProductEvent("pdf_opened", {
        origin: driveFileId ? "drive" : "local",
        entry_mode: context.mode,
        page_count: document.numPages,
      });
      if (driveFileId) void trackProductEvent("drive_imported", { page_count: document.numPages });
    } catch {
      if (context.requestId === pdfOpenRequestRef.current) {
        setError("This Drive PDF could not be opened.");
      }
    } finally {
      if (context.requestId === pdfOpenRequestRef.current) setLoading(false);
    }
  }

  async function openFromDrive(openContext?: PdfOpenContext) {
    if (loading) return;
    const context = openContext || createPdfOpenContext("drive", "direct", "workspace");
    try {
      const selected = await pickPdfFromDrive();
      if (context.requestId !== pdfOpenRequestRef.current) return;
      await openPdfBytes(selected.name, selected.bytes, selected.id, context);
    } catch (driveError) {
      const message = driveError instanceof Error ? driveError.message : "Google Drive could not be opened.";
      if (
        context.requestId === pdfOpenRequestRef.current
        && !/picker closed without selecting/i.test(message)
      ) {
        setError(message);
      }
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
        await replacePdfDocument(document);
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
      let receiptHistoryRefreshed = true;
      try {
        const cloudBatches = await listCloudRepairBatches(project.id);
        const mergedRecords = new Map<string, RepairBatchRecord>();
        (Array.isArray(savedProject.assistantRepairRecords) ? savedProject.assistantRepairRecords : [])
          .forEach((record) => mergedRecords.set(record.id, record));
        cloudBatches
          .map(repairRecordFromCloud)
          .forEach((record) => mergedRecords.set(record.id, {
            ...mergedRecords.get(record.id),
            ...record,
            reversedAt: mergedRecords.get(record.id)?.reversedAt,
          }));
        setAssistantRepairRecords([...mergedRecords.values()]);
      } catch {
        receiptHistoryRefreshed = false;
      }
      setBranchMessage(
        `Cloud revision R${revision.revision_number} restored · local autosave is active` +
        (receiptHistoryRefreshed ? " · repair receipts refreshed" : " · repair receipt refresh unavailable"),
      );
      setShowCloudProjects(false);
      setShowProjectHome(false);
      void trackProductEvent("revision_opened", { revision: revision.revision_number });
    } catch (cloudError) {
      setError(cloudError instanceof Error ? cloudError.message : "The cloud revision could not be restored.");
    } finally {
      setLoading(false);
    }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    const context = pendingPdfOpenRef.current
      || createPdfOpenContext("local", "direct", "workspace");
    pendingPdfOpenRef.current = null;
    if (!file) {
      return;
    }
    void openPdf(file, context);
    event.target.value = "";
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (loading) return;
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    void openPdf(file, createPdfOpenContext("local", "direct", "drop"));
  }

  useEffect(() => {
    if (!pdf || !canvasRef.current) return;
    const generation = ++pdfRenderGenerationRef.current;
    const timer = window.setTimeout(() => {
      const render = async () => {
        const page = await pdf.getPage(pageNumber);
        if (generation !== pdfRenderGenerationRef.current || !canvasRef.current) return;
        const viewport = page.getViewport({ scale: 1.35 });
        const requestedPlan = renderQualityPlan({
          logicalWidth: viewport.width,
          logicalHeight: viewport.height,
          zoom: zoomRef.current,
          devicePixelRatio,
          mode: renderQuality,
        });
        const requestedKey = `${pageNumber}:${renderQuality}:${requestedPlan.width}x${requestedPlan.height}`;
        if (pdfRenderKeyRef.current === requestedKey && canvasRef.current.width === requestedPlan.width) {
          setRenderQualityStatus({
            label: requestedPlan.label,
            megapixels: requestedPlan.megapixels,
            reduced: requestedPlan.reduced,
          });
          return;
        }

        const paint = async (
          plan: ReturnType<typeof renderQualityPlan>,
          key: string,
          fallback = false,
        ) => {
          const buffer = document.createElement("canvas");
          buffer.width = plan.width;
          buffer.height = plan.height;
          const context = buffer.getContext("2d", { alpha: false });
          if (!context) throw new Error("Canvas rendering is unavailable.");
          pdfRenderTaskRef.current?.cancel();
          const renderTask = page.render({
            canvasContext: context,
            viewport,
            transform: plan.ratio === 1 ? undefined : [plan.ratio, 0, 0, plan.ratio, 0, 0],
          });
          pdfRenderTaskRef.current = renderTask;
          try {
            await renderTask.promise;
            if (generation !== pdfRenderGenerationRef.current || !canvasRef.current) return;
            const canvas = canvasRef.current;
            canvas.width = plan.width;
            canvas.height = plan.height;
            canvas.style.width = `${viewport.width}px`;
            canvas.style.height = `${viewport.height}px`;
            const visibleContext = canvas.getContext("2d", { alpha: false });
            if (!visibleContext) return;
            visibleContext.setTransform(1, 0, 0, 1, 0, 0);
            visibleContext.drawImage(buffer, 0, 0);
            pdfRenderKeyRef.current = key;
            renderedPageNumberRef.current = pageNumber;
            setRenderSize({ width: viewport.width, height: viewport.height });
            setRenderedPageNumber(pageNumber);
            setRenderQualityStatus({
              label: fallback ? "Performance fallback" : plan.label,
              megapixels: plan.megapixels,
              reduced: fallback || plan.reduced,
            });
          } finally {
            if (pdfRenderTaskRef.current === renderTask) pdfRenderTaskRef.current = null;
            buffer.width = 1;
            buffer.height = 1;
          }
        };

        try {
          await paint(requestedPlan, requestedKey);
        } catch (renderError) {
          if ((renderError as { name?: string })?.name === "RenderingCancelledException") return;
          const fallbackPlan = renderQualityPlan({
            logicalWidth: viewport.width,
            logicalHeight: viewport.height,
            zoom: 1,
            devicePixelRatio: 1,
            mode: "performance",
          });
          try {
            await paint(
              fallbackPlan,
              `${pageNumber}:performance-fallback:${fallbackPlan.width}x${fallbackPlan.height}`,
              true,
            );
          } catch (fallbackError) {
            if ((fallbackError as { name?: string })?.name !== "RenderingCancelledException") {
              setError("The plan renderer could not finish this sheet. Try Performance mode or reopen the PDF.");
            }
          }
        }
      };
      void render();
    }, renderedPageNumberRef.current === pageNumber ? 160 : 0);
    return () => {
      window.clearTimeout(timer);
      if (generation === pdfRenderGenerationRef.current) {
        pdfRenderTaskRef.current?.cancel();
        pdfRenderTaskRef.current = null;
      }
    };
  }, [devicePixelRatio, pageNumber, pdf, renderQuality, zoom]);

  useEffect(() => {
    if (!pdf || !renderSize.width || !renderSize.height) return;
    const frame = requestAnimationFrame(() => centerPlan());
    return () => cancelAnimationFrame(frame);
  }, [pdf, pageNumber, renderSize.width, renderSize.height]);

  useEffect(() => {
    const pending = pendingFocusRef.current;
    if (!pending || pending.page !== pageNumber || renderedPageNumber !== pageNumber) return;
    const frame = requestAnimationFrame(() => {
      focusPlanPoint(pending.point, { avoidAssistant: pending.avoidAssistant });
      pendingFocusRef.current = null;
    });
    return () => cancelAnimationFrame(frame);
    // The focus routine reads the latest canvas, panel, and zoom through refs.
    // Re-run only when the requested sheet has finished rendering.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      clampZoom(+(zoomRef.current * factor).toFixed(3)),
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
    const normalizedZoom = clampZoom(+nextZoom.toFixed(3));
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
    const normalizedZoom = clampZoom(nextZoom);
    if (!viewport || normalizedZoom === zoomRef.current) return;
    const viewportBounds = viewport.getBoundingClientRect();
    const localX = clientX - viewportBounds.left;
    const localY = clientY - viewportBounds.top;
    const currentZoom = zoomRef.current;
    const planX = (localX - cameraRef.current.x) / currentZoom;
    const planY = (localY - cameraRef.current.y) / currentZoom;
    updateCamera({
      x: localX - planX * normalizedZoom,
      y: localY - planY * normalizedZoom,
    });
    zoomRef.current = normalizedZoom;
    setZoom(normalizedZoom);
  }

  function handleWheelZoom(event: ReactWheelEvent<HTMLDivElement>) {
    if (!pdf) return;
    event.preventDefault();
    if (touchGestureRef.current || panRef.current || activeEditPointerIdRef.current !== null) return;
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
    const nextZoom = clampZoom(+(zoomRef.current * Math.exp(-delta * sensitivity)).toFixed(3));
    zoomAtPoint(nextZoom, event.clientX, event.clientY);
  }

  function startPlanPan(event: PointerEvent<HTMLDivElement>) {
    if (
      !pdf ||
      event.button !== 2 ||
      draft.length ||
      panRef.current ||
      touchGestureRef.current ||
      touchPointersRef.current.size ||
      activeEditPointerIdRef.current !== null
    ) return;
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
      const nextCamera = {
        x: activePan.cameraX + activePan.latestX - activePan.startX,
        y: activePan.cameraY + activePan.latestY - activePan.startY,
      };
      if (pdfStageRef.current) {
        pdfStageRef.current.style.transform =
          `translate3d(${nextCamera.x}px, ${nextCamera.y}px, 0)`;
      }
    });
  }

  function endPlanPan(event: PointerEvent<HTMLDivElement>, cancelled = false) {
    const pan = panRef.current;
    const viewport = canvasViewportRef.current;
    if (!pan || !viewport || pan.pointerId !== event.pointerId) return;
    event.preventDefault();
    if (pan.frameId !== null) {
      cancelAnimationFrame(pan.frameId);
      pan.frameId = null;
    }
    const nextCamera = {
      x: pan.cameraX + (cancelled ? pan.latestX : event.clientX) - pan.startX,
      y: pan.cameraY + (cancelled ? pan.latestY : event.clientY) - pan.startY,
    };
    cameraRef.current = nextCamera;
    setCamera(nextCamera);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    viewport.classList.remove("panning");
    panRef.current = null;
  }

  function touchPointInViewport(point: ScreenPoint) {
    const viewport = canvasViewportRef.current;
    if (!viewport) return point;
    const bounds = viewport.getBoundingClientRect();
    return { x: point.x - bounds.left, y: point.y - bounds.top };
  }

  function beginTouchGesture() {
    if (!pdf || panRef.current || activeEditPointerIdRef.current !== null) return;
    const entries = [...touchPointersRef.current.entries()].slice(0, 2);
    if (entries.length !== 2) return;
    const first = entries[0][1];
    const second = entries[1][1];
    const center = touchPointInViewport(midpoint(first, second));
    const startZoom = zoomRef.current;
    touchGestureRef.current = {
      pointerIds: [entries[0][0], entries[1][0]],
      startDistance: Math.max(1, pointDistance(first, second)),
      startZoom,
      anchorPlan: {
        x: (center.x - cameraRef.current.x) / startZoom,
        y: (center.y - cameraRef.current.y) / startZoom,
      },
      latestZoom: startZoom,
      latestCamera: { ...cameraRef.current },
      frameId: null,
    };
    canvasViewportRef.current?.classList.add("touch-navigating");
    setHoverPoint(null);
    setSnapMarker(null);
    setSnapInfo(null);
    setAlignmentGuides([]);
    setBranchPreview(null);
    setSymbolPreview(null);
  }

  function updateTouchGesture() {
    const gesture = touchGestureRef.current;
    if (!gesture) return;
    const first = touchPointersRef.current.get(gesture.pointerIds[0]);
    const second = touchPointersRef.current.get(gesture.pointerIds[1]);
    if (!first || !second) return;
    const center = touchPointInViewport(midpoint(first, second));
    const next = pinchCamera({
      anchorPlan: gesture.anchorPlan,
      currentMidpoint: center,
      startDistance: gesture.startDistance,
      currentDistance: pointDistance(first, second),
      startZoom: gesture.startZoom,
    });
    gesture.latestZoom = next.zoom;
    gesture.latestCamera = next.camera;
    if (pdfStageRef.current) {
      const previewScale = next.zoom / Math.max(0.01, gesture.startZoom);
      pdfStageRef.current.style.transform =
        `translate3d(${next.camera.x}px, ${next.camera.y}px, 0) scale(${previewScale})`;
      pdfStageRef.current.style.transformOrigin = "0 0";
    }
  }

  function scheduleTouchGestureUpdate() {
    const gesture = touchGestureRef.current;
    if (!gesture || gesture.frameId !== null) return;
    gesture.frameId = requestAnimationFrame(() => {
      const current = touchGestureRef.current;
      if (!current) return;
      current.frameId = null;
      updateTouchGesture();
    });
  }

  function commitTouchGesture(gesture: TouchGestureState | null) {
    if (!gesture) return;
    zoomRef.current = gesture.latestZoom;
    cameraRef.current = gesture.latestCamera;
    setZoom(gesture.latestZoom);
    setCamera(gesture.latestCamera);
  }

  function finishTouchPointer(
    pointerId: number,
    target: HTMLDivElement,
    finalPoint?: ScreenPoint,
  ) {
    if (finalPoint && touchPointersRef.current.has(pointerId)) {
      touchPointersRef.current.set(pointerId, finalPoint);
    }
    const gesture = touchGestureRef.current;
    if (gesture?.pointerIds.includes(pointerId)) {
      if (gesture.frameId !== null) cancelAnimationFrame(gesture.frameId);
      updateTouchGesture();
      commitTouchGesture(gesture);
      touchGestureRef.current = null;
      canvasViewportRef.current?.classList.remove("touch-navigating");
    }
    touchPointersRef.current.delete(pointerId);
    if (target.hasPointerCapture(pointerId)) target.releasePointerCapture(pointerId);
  }

  function cancelTouchNavigation(target: HTMLDivElement) {
    const gesture = touchGestureRef.current;
    if (gesture?.frameId !== null && gesture?.frameId !== undefined) {
      cancelAnimationFrame(gesture.frameId);
    }
    if (gesture) {
      updateTouchGesture();
      commitTouchGesture(gesture);
    }
    const capturedPointerIds = [...touchPointersRef.current.keys()];
    touchPointersRef.current.clear();
    capturedPointerIds.forEach((pointerId) => {
      if (target.hasPointerCapture(pointerId)) target.releasePointerCapture(pointerId);
    });
    touchGestureRef.current = null;
    canvasViewportRef.current?.classList.remove("touch-navigating");
  }

  function isCanvasUiTarget(target: EventTarget | null) {
    return target instanceof Element && Boolean(target.closest(
      "button,input,select,textarea,a,[role='dialog'],[role='toolbar'],[data-canvas-ui]",
    ));
  }

  function beginEditTransaction(pointerId: number) {
    const owner = activeEditPointerIdRef.current;
    if (owner !== null && owner !== pointerId) return false;
    activeEditPointerIdRef.current = pointerId;
    if (editTransactionRef.current?.pointerId !== pointerId) {
      editTransactionRef.current = {
        pointerId,
        drawings,
        draft,
        undoStack,
        redoStack,
        measureDraft,
        selectedId,
        selectedIds,
        continuingRunId,
        pendingBranchFittingId,
        branchPlacementResult,
        queuedBranchRunId,
        branchPreview,
        branchMessage,
        branchHoverRunId,
        symbolPreview,
        scaleFeetPerUnit,
        scaleLabel,
        scaleLocked,
        scaleVerified,
        calibrating,
      };
    }
    return true;
  }

  function restoreEditTransaction(pointerId: number) {
    const snapshot = editTransactionRef.current;
    const drag = dragRef.current;
    if (snapshot?.pointerId === pointerId) {
      setDrawings(snapshot.drawings);
      setDraft(snapshot.draft);
      setUndoStack(snapshot.undoStack);
      setRedoStack(snapshot.redoStack);
      setMeasureDraft(snapshot.measureDraft);
      setSelectedId(snapshot.selectedId);
      setSelectedIds(snapshot.selectedIds);
      setContinuingRunId(snapshot.continuingRunId);
      setPendingBranchFittingId(snapshot.pendingBranchFittingId);
      setBranchPlacementResult(snapshot.branchPlacementResult);
      setQueuedBranchRunId(snapshot.queuedBranchRunId);
      setBranchPreview(snapshot.branchPreview);
      setBranchMessage(snapshot.branchMessage);
      setBranchHoverRunId(snapshot.branchHoverRunId);
      setSymbolPreview(snapshot.symbolPreview);
      setScaleFeetPerUnit(snapshot.scaleFeetPerUnit);
      setScaleLabel(snapshot.scaleLabel);
      setScaleLocked(snapshot.scaleLocked);
      setScaleVerified(snapshot.scaleVerified);
      setCalibrating(snapshot.calibrating);
    } else if (drag?.pointerId === pointerId) {
      setDrawings(drag.before);
    }
    if (drag?.pointerId === pointerId) dragRef.current = null;
    if (selectionBox?.pointerId === pointerId) setSelectionBox(null);
    setSnapMarker(null);
    setSnapInfo(null);
    setAlignmentGuides([]);
    setHoverPoint(null);
    activeEditPointerIdRef.current = null;
    editTransactionRef.current = null;
  }

  function handleViewportPointerDownCapture(event: PointerEvent<HTMLDivElement>) {
    if (isCanvasUiTarget(event.target)) return;
    const directTouchEdit = event.pointerType === "touch"
      && event.target instanceof Element
      && Boolean(event.target.closest("[data-plan-edit-control]"));
    if (event.pointerType === "touch") {
      if (!pdf) return;
      if (directTouchEdit) {
        event.preventDefault();
        if (
          touchPointersRef.current.size ||
          touchGestureRef.current ||
          activePenPointerIdRef.current !== null ||
          performance.now() - lastPenActivityRef.current < 650 ||
          panRef.current ||
          !beginEditTransaction(event.pointerId)
        ) {
          event.stopPropagation();
        }
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (
        activePenPointerIdRef.current !== null ||
        performance.now() - lastPenActivityRef.current < 650 ||
        activeEditPointerIdRef.current !== null ||
        panRef.current
      ) return;
      touchPointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      event.currentTarget.setPointerCapture(event.pointerId);
      if (touchPointersRef.current.size === 2) beginTouchGesture();
      return;
    }
    if (event.pointerType === "pen") {
      if (activePenPointerIdRef.current !== null && activePenPointerIdRef.current !== event.pointerId) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      cancelTouchNavigation(event.currentTarget);
      if (!beginEditTransaction(event.pointerId)) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      activePenPointerIdRef.current = event.pointerId;
      lastPenActivityRef.current = performance.now();
      return;
    }
    if (touchGestureRef.current || touchPointersRef.current.size) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (event.button === 2) {
      startPlanPan(event);
      return;
    }
    if (event.button === 0) {
      if (!beginEditTransaction(event.pointerId)) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
    }
  }

  function handleViewportPointerMoveCapture(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch") {
      if (!touchPointersRef.current.has(event.pointerId)) return;
      event.preventDefault();
      event.stopPropagation();
      if (activePenPointerIdRef.current !== null) return;
      touchPointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      scheduleTouchGestureUpdate();
      return;
    }
    if (
      event.pointerType === "pen" &&
      (activePenPointerIdRef.current === event.pointerId || event.buttons !== 0 || event.pressure > 0)
    ) {
      lastPenActivityRef.current = performance.now();
    }
    movePlanPan(event);
  }

  function handleViewportPointerUpCapture(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch") {
      if (!touchPointersRef.current.has(event.pointerId)) {
        if (activeEditPointerIdRef.current === event.pointerId && !dragRef.current) {
          activeEditPointerIdRef.current = null;
          if (editTransactionRef.current?.pointerId === event.pointerId) {
            editTransactionRef.current = null;
          }
        }
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      finishTouchPointer(
        event.pointerId,
        event.currentTarget,
        { x: event.clientX, y: event.clientY },
      );
      return;
    }
    if (event.pointerType === "pen") {
      lastPenActivityRef.current = performance.now();
      if (activePenPointerIdRef.current === event.pointerId) activePenPointerIdRef.current = null;
    }
    if (activeEditPointerIdRef.current === event.pointerId) {
      completedEditPointerIdsRef.current.add(event.pointerId);
    }
    endPlanPan(event);
    const target = event.currentTarget;
    queueMicrotask(() => {
      if (activeEditPointerIdRef.current === event.pointerId) {
        activeEditPointerIdRef.current = null;
        if (editTransactionRef.current?.pointerId === event.pointerId) {
          editTransactionRef.current = null;
        }
      }
      if (target.hasPointerCapture(event.pointerId)) {
        target.releasePointerCapture(event.pointerId);
      }
      window.setTimeout(() => completedEditPointerIdsRef.current.delete(event.pointerId), 0);
    });
  }

  function handleViewportPointerCancelCapture(event: PointerEvent<HTMLDivElement>) {
    completedEditPointerIdsRef.current.delete(event.pointerId);
    if (event.pointerType === "touch") {
      if (!touchPointersRef.current.has(event.pointerId)) {
        if (activeEditPointerIdRef.current === event.pointerId) {
          restoreEditTransaction(event.pointerId);
        }
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      finishTouchPointer(
        event.pointerId,
        event.currentTarget,
        { x: event.clientX, y: event.clientY },
      );
      return;
    }
    if (event.pointerType === "pen" && activePenPointerIdRef.current === event.pointerId) {
      activePenPointerIdRef.current = null;
      lastPenActivityRef.current = performance.now();
    }
    if (activeEditPointerIdRef.current === event.pointerId) {
      restoreEditTransaction(event.pointerId);
    }
    endPlanPan(event, true);
  }

  function handleViewportLostPointerCapture(event: PointerEvent<HTMLDivElement>) {
    if (completedEditPointerIdsRef.current.delete(event.pointerId)) return;
    handleViewportPointerCancelCapture(event);
  }

  function handleDisplaySettingsKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key !== "Tab") return;
    const panel = displaySettingsPanelRef.current;
    if (!panel) return;
    const focusable = [...panel.querySelectorAll<HTMLElement>(
      "button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])",
    )].filter((element) => element.offsetParent !== null);
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

  function openToolsPanel() {
    setLeftPanelOpen(true);
    setRightPanelOpen(false);
  }

  function openInspectorPanel() {
    setRightPanelOpen(true);
    setLeftPanelOpen(false);
  }

  function goToPage(page: number) {
    if (!pdf) return;
    const nextPage = Math.max(1, Math.min(pdf.numPages, page));
    setPlanEvidenceRegion(null);
    setPageNumber(nextPage);
    activateSheetScale(nextPage);
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
      version: 6,
      fileName,
      drawings,
      savedAt: new Date().toISOString(),
      pdfFingerprint,
      scaleFeetPerUnit,
      scaleLabel,
      scaleVerified,
      sheetScales,
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
      roomAirflowTargetReviewFingerprints,
      balanceReviewRecords,
      reviewDecisionsBySystem,
      releaseRecords,
      takeoffPackageRecords,
      assistantAutonomyMode,
      assistantRepairRecords,
      activePlanAnalysis: boundedPlanAnalysisSnapshot(activePlanAnalysis),
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
  }, [activeBuilderSummary, activeFieldPackage, activePlanAnalysis, activeSystem, assistantAutonomyMode, assistantRepairRecords, backgroundOpacity, balanceReviewRecords, commissioningBySystem, currentCloudReleaseFingerprint, drawings, fieldChecklistBySystem, fileName, freshVelocityLimit, lockedLayers, materialWastePercent, pdfFingerprint, projectCommandSnapshot, punchItems, releaseRecords, residentialFlexMax, returnVelocityLimit, reviewDecisionsBySystem, rfiItems, roomAirflowTargetReviewFingerprints, roomAirflowTargets, scaleFeetPerUnit, scaleLabel, scaleVerified, sheetScales, showCfmLabels, showFittingLabels, showGrid, showLengthLabels, snapEnabled, supplyVelocityLimit, systemNames, takeoffPackageRecords, visibleLayers, workingCloudProjectId, workingCloudRevisionId]);

  const saveProject = useCallback(() => {
    if (!pdf) return;
    const project = buildProjectSnapshot();
    const storageKey = projectStorageKey(fileName, pdfFingerprint);
    try {
      localStorage.setItem(storageKey, JSON.stringify(project));
      setSaveState("saved");
    } catch {
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify({ ...project, activePlanAnalysis: null }),
        );
        setSaveState("saved");
        setBranchMessage("The drawing was saved. Detailed plan setup information exceeded browser storage and can be read again from the PDF.");
      } catch {
        setSaveState("saving");
        setBranchMessage("Browser storage is full. Export or save a cloud revision before closing this plan.");
      }
    }
  }, [buildProjectSnapshot, fileName, pdf, pdfFingerprint]);

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
    // Persisted assistant evidence must be invariant to viewport zoom.
    // These tolerances are in the fixed logical PDF coordinate space.
    const distanceLimit = 44;

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
            if (fittingCenters.some((fittingCenter) => Math.hypot(fittingCenter.x - center.x, fittingCenter.y - center.y) < 32)) continue;

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
        Math.hypot(previous.center.x - opportunity.center.x, previous.center.y - opportunity.center.y) < 26
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

  function synchronizeFittingSizes(
    nextDrawings: Drawing[],
    previousDrawings = drawings,
    options: { fittingIds?: Set<string>; snapEndpoints?: boolean } = {},
  ) {
    let synchronized = nextDrawings;
    for (const previousFitting of previousDrawings.filter((drawing) =>
      drawing.fitting && (!options.fittingIds || options.fittingIds.has(drawing.id))
    )) {
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
      if (options.snapEndpoints !== false) {
        synchronized = snapRunsToFittingPorts(synchronized, updatedFitting, previousFitting);
      }
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
    return units * scaleStateForPage(drawing.page).feetPerUnit;
  }

  function velocityFpm(size: string, cfm = 0) {
    return Math.round(roundDuctVelocityFpm(size, cfm));
  }

  function runPressure(drawing: Drawing) {
    const bends = Math.max(0, drawing.points.length - 2);
    const pressure = estimateRunPressureDrop({
      diameterInches: drawing.size,
      cfm: runAirflow(drawing),
      physicalLengthFeet: drawingLengthFeet(drawing),
      bendCount: bends,
    });
    return {
      bends,
      physicalLength: pressure.physicalLengthFeet,
      equivalentLength: pressure.equivalentLengthFeet,
      equivalentLengthPerBend: pressure.equivalentLengthPerBendFeet,
      frictionRate: pressure.frictionRateInWgPer100Ft,
      pressureDrop: pressure.pressureDropInWg,
      classification: pressure.classification,
      assumptionNotice: pressure.assumptionNotice,
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
    const directSources = new Map<string, Set<"planning-seed" | "manual" | "room-target">>();
    const terminalRun = new Map<string, string>();
    const equipmentRun = new Map<string, string>();
    const equipmentReturnRun = new Map<string, string>();
    const children = new Map<string, string[]>();
    const returnAdjacency = new Map<string, Set<string>>();
    const returnRootRuns = new Set<string>();
    const returnFittingLinks: Array<[string, string]> = [];
    const runEndpointTouches = (run: Drawing, point: Point, savedEnd?: "start" | "end") => {
      const endpoints = savedEnd
        ? [savedEnd === "start" ? run.points[0] : run.points[run.points.length - 1]]
        : [run.points[0], run.points[run.points.length - 1]];
      return endpoints.some((endpoint) => endpoint && Math.hypot(endpoint.x - point.x, endpoint.y - point.y) < 2);
    };
    for (const fitting of drawings.filter((drawing) => drawing.fitting)) {
      const [upstreamId, downstreamId, branchId] = fitting.fitting!.connectedIds;
      const ports = fittingPortPoints(fitting);
      const upstream = runs.find((run) =>
        run.id === upstreamId &&
        ["supply", "return", "fresh"].includes(run.type)
      );
      if (!upstream || !runEndpointTouches(upstream, ports[0])) continue;
      const validChildren = [
        { id: downstreamId, port: ports[1] },
        { id: branchId, port: ports[2] },
      ].flatMap(({ id, port }) => {
        const run = runs.find((candidate) => candidate.id === id && candidate.type === upstream.type);
        return run && runEndpointTouches(run, port) ? [run.id] : [];
      });
      children.set(upstream.id, [...new Set([...(children.get(upstream.id) || []), ...validChildren])]);
      if (upstream.type === "return") {
        validChildren.forEach((childId) => returnFittingLinks.push([upstream.id, childId]));
      }
    }
    const returnRuns = runs.filter((run) => run.type === "return");
    returnRuns.forEach((run) => returnAdjacency.set(run.id, new Set()));
    returnFittingLinks.forEach(([upstreamId, childId]) => {
      returnAdjacency.get(upstreamId)?.add(childId);
      returnAdjacency.get(childId)?.add(upstreamId);
    });
    returnRuns.forEach((run, index) => {
      const endpoints = [run.points[0], run.points[run.points.length - 1]];
      returnRuns.slice(index + 1).forEach((candidate) => {
        if (
          candidate.page !== run.page ||
          drawingSystem(candidate) !== drawingSystem(run)
        ) return;
        const candidateEndpoints = [candidate.points[0], candidate.points[candidate.points.length - 1]];
        const touches = endpoints.some((point) =>
          candidateEndpoints.some((candidatePoint) =>
            point && candidatePoint && Math.hypot(point.x - candidatePoint.x, point.y - candidatePoint.y) < 2
          )
        );
        if (!touches) return;
        returnAdjacency.get(run.id)?.add(candidate.id);
        returnAdjacency.get(candidate.id)?.add(run.id);
      });
    });
    for (const symbol of drawings.filter((drawing) => drawing.symbol)) {
      const desiredType = symbol.symbol?.kind === "diffuser" ? ["supply"] : symbol.symbol?.kind === "returnGrille" ? ["return"] : [];
      if (isPrimaryAirflowEquipment(symbol)) {
        const plenums = equipmentPlenumPorts(symbol);
        const savedRun = runs.find((run) =>
          run.id === symbol.symbol?.connectedRunId &&
          run.page === symbol.page &&
          run.type === "supply" &&
          drawingSystem(run) === drawingSystem(symbol) &&
          runEndpointTouches(run, plenums.supply, symbol.symbol?.connectedEnd)
        );
        if (savedRun) {
          equipmentRun.set(symbol.id, savedRun.id);
        }
        const physicallyRootedReturns = returnRuns.filter((run) =>
          run.page === symbol.page &&
          drawingSystem(run) === drawingSystem(symbol) &&
          runEndpointTouches(run, plenums.return)
        );
        physicallyRootedReturns.forEach((run) => returnRootRuns.add(run.id));
        const savedReturnRun = physicallyRootedReturns.find((run) =>
          run.id === symbol.symbol?.returnRunId &&
          runEndpointTouches(run, plenums.return, symbol.symbol?.returnEnd)
        ) || physicallyRootedReturns[0];
        if (savedReturnRun) equipmentReturnRun.set(symbol.id, savedReturnRun.id);
        continue;
      }
      if (!desiredType.length) continue;
      const savedRun = runs.find((run) =>
        run.id === symbol.symbol?.connectedRunId &&
        run.page === symbol.page &&
        desiredType.includes(run.type) &&
        drawingSystem(run) === drawingSystem(symbol) &&
        runEndpointTouches(run, symbol.points[0], symbol.symbol?.connectedEnd)
      );
      if (savedRun) {
        terminalRun.set(symbol.id, savedRun.id);
        direct.set(savedRun.id, (direct.get(savedRun.id) || 0) + (symbol.cfm || 0));
        const sources = new Set(directSources.get(savedRun.id) || []);
        sources.add(symbol.cfmSource || "planning-seed");
        directSources.set(savedRun.id, sources);
      }
    }
    const calculated = new Map<string, number>();
    const calculatedSources = new Map<string, Set<"planning-seed" | "manual" | "room-target">>();
    const calculate = (id: string, visiting = new Set<string>()): number => {
      if (calculated.has(id)) return calculated.get(id)!;
      if (visiting.has(id)) return 0;
      const next = new Set(visiting).add(id);
      const total = (direct.get(id) || 0) + (children.get(id) || []).reduce((sum, childId) => sum + calculate(childId, next), 0);
      calculated.set(id, total);
      return total;
    };
    const calculateSources = (
      id: string,
      visiting = new Set<string>(),
    ): Set<"planning-seed" | "manual" | "room-target"> => {
      if (calculatedSources.has(id)) return calculatedSources.get(id)!;
      if (visiting.has(id)) return new Set();
      const next = new Set(visiting).add(id);
      const sources = new Set(directSources.get(id) || []);
      (children.get(id) || []).forEach((childId) => {
        calculateSources(childId, next).forEach((source) => sources.add(source));
      });
      calculatedSources.set(id, sources);
      return sources;
    };
    runs.forEach((run) => {
      calculate(run.id);
      calculateSources(run.id);
    });
    const reachableSupplyRuns = new Set<string>();
    const supplyQueue = [...equipmentRun.values()];
    while (supplyQueue.length) {
      const runId = supplyQueue.shift()!;
      if (reachableSupplyRuns.has(runId)) continue;
      reachableSupplyRuns.add(runId);
      supplyQueue.push(...(children.get(runId) || []));
    }
    const reachableReturnRuns = new Set<string>();
    const returnParent = new Map<string, string | null>();
    const returnTraversal: string[] = [];
    const returnQueue = [...returnRootRuns];
    returnQueue.forEach((runId) => returnParent.set(runId, null));
    while (returnQueue.length) {
      const runId = returnQueue.shift()!;
      if (reachableReturnRuns.has(runId)) continue;
      reachableReturnRuns.add(runId);
      returnTraversal.push(runId);
      for (const adjacentId of returnAdjacency.get(runId) || []) {
        if (returnParent.has(adjacentId)) continue;
        returnParent.set(adjacentId, runId);
        returnQueue.push(adjacentId);
      }
    }
    const returnCalculated = new Map(
      returnTraversal.map((runId) => [runId, direct.get(runId) || 0]),
    );
    const returnCalculatedSources = new Map(
      returnTraversal.map((runId) => [runId, new Set(directSources.get(runId) || [])]),
    );
    for (const runId of [...returnTraversal].reverse()) {
      const parentId = returnParent.get(runId);
      if (!parentId) continue;
      returnCalculated.set(
        parentId,
        (returnCalculated.get(parentId) || 0) + (returnCalculated.get(runId) || 0),
      );
      const parentSources = new Set(returnCalculatedSources.get(parentId) || []);
      (returnCalculatedSources.get(runId) || new Set()).forEach((source) => parentSources.add(source));
      returnCalculatedSources.set(parentId, parentSources);
    }
    returnCalculated.forEach((cfm, runId) => calculated.set(runId, cfm));
    returnCalculatedSources.forEach((sources, runId) => calculatedSources.set(runId, sources));
    const rootedTerminalRun = new Map<string, string>();
    drawings.filter((drawing) => ["diffuser", "returnGrille"].includes(drawing.symbol?.kind || "")).forEach((terminal) => {
      const runId = terminalRun.get(terminal.id);
      if (!runId) return;
      if (terminal.symbol?.kind === "diffuser" && reachableSupplyRuns.has(runId)) rootedTerminalRun.set(terminal.id, runId);
      if (terminal.symbol?.kind === "returnGrille" && reachableReturnRuns.has(runId)) rootedTerminalRun.set(terminal.id, runId);
    });
    return {
      calculated,
      calculatedSources,
      terminalRun,
      rootedTerminalRun,
      equipmentRun,
      equipmentReturnRun,
      children,
      reachableSupplyRuns,
      reachableReturnRuns,
    };
  }

  function airflowNetwork() {
    return airflowNetworkModel;
  }

  function runAirflow(drawing: Drawing) {
    const propagated = airflowNetwork().calculated.get(drawing.id) || 0;
    if (drawing.cfmSource === "manual") {
      return Math.max(propagated, Math.max(0, drawing.cfm ?? 0));
    }
    return propagated || Math.max(0, drawing.cfm ?? 0);
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
    const maximumVelocity = type === "supply"
      ? supplyVelocityLimit
      : type === "return"
        ? returnVelocityLimit
        : freshVelocityLimit;
    return String(recommendFlexibleDuctSize({
      cfm,
      airflowSource: "terminal-linked",
      velocityLimitFpm: maximumVelocity,
      maxDiameterInches: residentialFlexMax,
    }).recommendedDiameterInches);
  }

  function sizingSuggestions() {
    const network = airflowNetwork();
    const reviewedRoomTargets = roomAirflowTargetsAreReviewed();
    return drawings
      .filter((drawing) => ["supply", "return", "fresh"].includes(drawing.type) && !drawing.fitting && drawingSystem(drawing) === activeSystem)
      .flatMap((drawing) => {
        const hasManualOverride = drawing.cfmSource === "manual";
        const pathIsContinuous = drawing.type === "supply"
          ? network.reachableSupplyRuns.has(drawing.id)
          : drawing.type === "return"
            ? network.reachableReturnRuns.has(drawing.id)
            : false;
        const propagated = pathIsContinuous ? network.calculated.get(drawing.id) || 0 : 0;
        const propagatedSources = [
          ...(pathIsContinuous ? network.calculatedSources.get(drawing.id) || new Set<"planning-seed" | "manual" | "room-target">() : []),
        ].sort();
        const manual = Math.max(0, drawing.cfm ?? 0);
        const manualBelowDownstream = hasManualOverride && propagated > manual;
        const cfm = hasManualOverride ? Math.max(manual, propagated) : propagated;
        if (!cfm) return [];
        const limit = drawing.type === "supply"
          ? supplyVelocityLimit
          : drawing.type === "return"
            ? returnVelocityLimit
            : freshVelocityLimit;
        const manualGoverns = hasManualOverride && manual > 0 && manual >= propagated;
        const propagatedReviewed = Boolean(
          propagated > 0 &&
          propagatedSources.length &&
          !propagatedSources.includes("planning-seed") &&
          (!propagatedSources.includes("room-target") || reviewedRoomTargets)
        );
        const airflowReviewed = manualGoverns || propagatedReviewed;
        const airflowSource = manualGoverns ? "manual" as const : "terminal-linked" as const;
        const recommendation = recommendFlexibleDuctSize({
          cfm,
          airflowSource,
          velocityLimitFpm: limit,
          maxDiameterInches: residentialFlexMax,
        });
        const recommended = String(recommendation.recommendedDiameterInches);
        const pressure = runPressure({ ...drawing, cfm });
        return [{
          id: drawing.id,
          type: drawing.type,
          current: drawing.size,
          currentSizeReviewed: drawing.sizeReviewed,
          recommended,
          cfm,
          currentVelocity: velocityFpm(drawing.size, cfm),
          velocity: velocityFpm(recommended, cfm),
          limit,
          classification: recommendation.classification,
          sizingStatus: recommendation.status,
          applyEligible: recommendation.applyEligible && airflowReviewed,
          overCapacity: recommendation.overCapacity,
          reasonCodes: [
            ...recommendation.reasonCodes,
            ...(manualBelowDownstream ? ["MANUAL_CFM_BELOW_DOWNSTREAM"] : []),
            ...(!airflowReviewed ? ["AIRFLOW_PROVENANCE_UNREVIEWED"] : []),
          ],
          alternatives: recommendation.alternatives,
          room: drawing.roomName?.trim() || "Unassigned route",
          airflowSource,
          airflowReviewed,
          airflowEvidence: manualGoverns
            ? [`Manual run CFM governs at ${manual} CFM`]
            : propagatedSources.map((source) =>
              source === "room-target"
                ? "Fingerprint-matched reviewed room-target CFM"
                : source === "manual"
                  ? "Manually entered terminal CFM"
                  : "Planning-seed terminal CFM · not eligible"
            ),
          roomTargetReviewFingerprint: propagatedSources.includes("room-target")
            ? roomAirflowTargetReviewFingerprints[activeSystem] || ""
            : "",
          equipmentRooted: pathIsContinuous,
          physicalLength: pressure.physicalLength,
          equivalentLength: pressure.equivalentLength,
          equivalentLengthPerBend: pressure.equivalentLengthPerBend,
          frictionRate: pressure.frictionRate,
          pressureDrop: pressure.pressureDrop,
          pressureAssumption: pressure.assumptionNotice,
        }];
      })
      .filter((suggestion) => suggestion.overCapacity || suggestion.current !== suggestion.recommended);
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
        scaleX: defaultSymbolScale("reducer"),
        scaleY: defaultSymbolScale("reducer"),
        labelScale: defaultSymbolLabelScale("reducer"),
        variant: "reducer",
      },
    };
    setHistory([...drawings, symbol]);
    selectOnly(symbol.id);
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
    applySizingSuggestionIds(selectedSizingIds);
  }

  function applySizingSuggestionIds(ids: string[]) {
    const eligibleRunIds = new Set(sizingSuggestions()
      .filter((suggestion) =>
        ids.includes(suggestion.id) &&
        suggestion.airflowReviewed &&
        suggestion.equipmentRooted &&
        suggestion.applyEligible &&
        !suggestion.overCapacity
      )
      .map((suggestion) => suggestion.id));
    const repairActionIds = assistantRepairPlan.actions
      .filter((action) =>
        action.kind === "run-size" &&
        action.readiness === "ready" &&
        eligibleRunIds.has(action.drawingId)
      )
      .map((action) => action.id);
    if (!repairActionIds.length) {
      setBranchMessage("No selected size has current reviewed airflow provenance and an equipment-rooted path. Zero changes were applied.");
      setSelectedSizingIds([]);
      return;
    }
    setAssistantAutonomyMode("guided");
    setAssistantPreparedEvidenceFingerprint(assistantRepairPlan.evidenceFingerprint);
    setAssistantPreparedRepairPlanId(assistantRepairPlan.id);
    setAssistantSelectedActionIds(repairActionIds);
    setSelectedSizingIds([]);
    setShowSizingReview(false);
    setShowSystemBalanceStudio(false);
    setShowMarkupAssistant(true);
    setBranchMessage(
      `${repairActionIds.length} velocity-screened size candidate${repairActionIds.length === 1 ? "" : "s"} opened in Guided Repair · reviewer, explicit planning override, and final batch confirmation are still required`,
    );
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
      const reviewedEquipmentCfm = drawing.cfmSource === "manual" && (drawing.cfm || 0) > 0
        ? drawing.cfm || 0
        : 0;
      return total + (reviewedEquipmentCfm || tons * 400);
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
      .filter((drawing) => network.rootedTerminalRun.has(drawing.id))
      .reduce((total, drawing) => total + (drawing.cfm || 0), 0);
    const connectedReturnCfm = returnTerminals
      .filter((drawing) => network.rootedTerminalRun.has(drawing.id))
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
      connectedSupplyTerminals: supplyTerminals.filter((drawing) => network.rootedTerminalRun.has(drawing.id)).length,
      connectedReturnTerminals: returnTerminals.filter((drawing) => network.rootedTerminalRun.has(drawing.id)).length,
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
        runIds.has(network.rootedTerminalRun.get(drawing.id) || "")
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

  function roomAirflowTargetsFingerprint(
    systemId: string,
    targets = roomAirflowTargets[systemId] || {},
  ) {
    const roomTopology = systemId === activeSystem
      ? roomSchedule()
        .map((room) => ({
          room: room.name.toLowerCase(),
          diffusers: room.diffusers,
          returns: room.returns,
        }))
        .sort((left, right) => left.room.localeCompare(right.room))
      : [];
    return stableTextHash(JSON.stringify(
      {
        planningTargetCfm: systemId === activeSystem ? designAirflow().targetCfm : 0,
        roomTopology,
        targets: Object.entries(targets)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([room, target]) => [room, {
            supplyCfm: target.supplyCfm,
            returnCfm: target.returnCfm,
            priority: target.priority,
          }]),
      },
    ));
  }

  function roomAirflowTargetsAreReviewed(systemId = activeSystem) {
    const targets = roomAirflowTargets[systemId];
    const everyScheduledRoomHasTargets = systemId === activeSystem && roomSchedule().every((room) =>
      Boolean(targets?.[room.name.toLowerCase()])
    );
    return Boolean(
      targets &&
      Object.keys(targets).length &&
      everyScheduledRoomHasTargets &&
      roomAirflowTargetReviewFingerprints[systemId] === roomAirflowTargetsFingerprint(systemId, targets)
    );
  }

  function openSystemBalanceWorkspace(view: "system" | "rooms" | "runs" = "system") {
    setSelectedCfmProposalIds([]);
    setBalanceView(view);
    setRightTab("rooms");
  }

  function recalculateRoomAirflowTargets() {
    const suggested = suggestedRoomAirflowTargets(roomAirflowTargets[activeSystem] || {});
    setRoomAirflowTargets((current) => ({ ...current, [activeSystem]: suggested }));
    setSelectedCfmProposalIds([]);
    setBranchMessage(`${systemLabel(activeSystem)} draft room targets recalculated · review and save them before applying CFM`);
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

  function saveReviewedRoomAirflowTargets() {
    const targets = activeRoomAirflowTargets();
    if (!Object.keys(targets).length) {
      setBranchMessage("Assign room names before saving reviewed room targets");
      return;
    }
    const fingerprint = roomAirflowTargetsFingerprint(activeSystem, targets);
    setRoomAirflowTargets((current) => ({ ...current, [activeSystem]: targets }));
    setRoomAirflowTargetReviewFingerprints((current) => ({ ...current, [activeSystem]: fingerprint }));
    setSelectedCfmProposalIds([]);
    setBranchMessage(`${systemLabel(activeSystem)} room coordination targets saved as reviewed · drawing CFM was not changed`);
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
          currentSource: (drawing.cfmSource || "unset") as TerminalCfmProposal["currentSource"],
          proposed: split.get(drawing.id) || 0,
          target: total,
          terminalCount: terminals.length,
          connected: network.rootedTerminalRun.has(drawing.id),
        })).filter((proposal) =>
          proposal.current !== proposal.proposed ||
          proposal.currentSource !== "room-target"
        );
      };
      return [
        ...build(supplyTerminals, "supply", target.supplyCfm),
        ...build(returnTerminals, "return", target.returnCfm),
      ];
    });
  }

  function applySelectedCfmProposals() {
    applyCfmProposalIds(selectedCfmProposalIds);
  }

  function applyCfmProposalIds(ids: string[]) {
    if (!roomAirflowTargetsAreReviewed()) {
      setSelectedCfmProposalIds([]);
      setBranchMessage("Review and save the room coordination targets before applying terminal CFM");
      return;
    }
    const proposals = terminalCfmProposals().filter((proposal) => ids.includes(proposal.id) && proposal.connected);
    if (!proposals.length) {
      setBranchMessage("Select at least one connected, reviewed terminal CFM change before applying");
      return;
    }
    const proposed = new Map(proposals.map((proposal) => [proposal.drawingId, proposal.proposed]));
    setHistory(drawings.map((drawing) => proposed.has(drawing.id)
      ? { ...drawing, cfm: proposed.get(drawing.id), cfmSource: "room-target" }
      : drawing));
    setSelectedCfmProposalIds([]);
    setBranchMessage(`${proposals.length} reviewed terminal CFM change${proposals.length === 1 ? "" : "s"} applied in one undoable step · duct sizes were not changed`);
  }

  function buildSystemBalanceModel(): SystemBalanceModel {
    const setup = airflowSetupSummary();
    const network = airflowNetwork();
    const targets = activeRoomAirflowTargets();
    const activeScaleStatus = systemScaleStatus(activeSystem);
    const equipmentSources = setup.equipment.map((drawing) =>
      drawing.cfmSource === "manual" && (drawing.cfm || 0) > 0
        ? "manual"
        : "planning-seed"
    );
    const airflowTargetSource: SystemBalanceModel["airflowTargetSource"] = !setup.targetCfm
      ? "missing"
      : equipmentSources.every((source) => source === "manual")
        ? "user-entered"
        : equipmentSources.some((source) => source === "manual")
          ? "mixed"
          : "planning-seed";
    const terminals = [...setup.supplyTerminals, ...setup.returnTerminals];
    const planningSeedTerminalCount = terminals.filter((drawing) =>
      !drawing.cfmSource || drawing.cfmSource === "planning-seed"
    ).length;
    const missingTerminalCfm = terminals.filter((drawing) => !drawing.cfm).length;
    const savedRoomTargets = roomAirflowTargets[activeSystem];
    const networks = networkBalanceRows().map((row) => ({
      unitId: row.unit.id,
      unitLabel: row.unit.symbol?.label || `${row.unit.size} ${row.unit.symbol?.variant || "indoor unit"}`,
      rootRunId: row.rootRunId,
      designCfm: row.designCfm,
      assignedCfm: row.assignedCfm,
      remainingCfm: row.remainingCfm,
      returnCfm: row.returnCfm,
      percent: row.percent,
      runCount: row.runCount,
      fittingCount: row.fittingCount,
      terminalCount: row.terminalCount,
      problemCount: row.problemCount,
      firstProblemDrawingId: row.firstProblemFittingId,
      balanced: row.balanced,
    }));
    const rooms = roomSchedule().map((room) => {
      const target = targets[room.name.toLowerCase()] || { supplyCfm: 0, returnCfm: 0 };
      const deviceDrawings = room.drawingIds
        .map((id) => drawings.find((drawing) => drawing.id === id))
        .filter((drawing): drawing is Drawing => Boolean(
          drawing?.symbol && ["diffuser", "returnGrille"].includes(drawing.symbol.kind),
        ));
      return {
        name: room.name,
        type: room.type || "general",
        supplyTarget: target.supplyCfm,
        supplyScheduled: room.supplyCfm,
        returnTarget: target.returnCfm,
        returnScheduled: room.returnCfm,
        diffusers: room.diffusers,
        returns: room.returns,
        connectedDevices: deviceDrawings.filter((drawing) => network.rootedTerminalRun.has(drawing.id)).length,
        deviceCount: room.diffusers + room.returns,
        missingCfm: room.missingCfm,
        needsReturn: room.needsReturn,
        drawingIds: room.drawingIds,
      };
    });
    const runs = sizingSuggestions().map((run) => ({
      id: run.id,
      type: run.type as "supply" | "return" | "fresh",
      room: run.room,
      currentSize: run.current,
      recommendedSize: run.recommended,
      cfm: run.cfm,
      currentVelocity: run.currentVelocity,
      recommendedVelocity: run.velocity,
      velocityLimit: run.limit,
      classification: run.classification,
      sizingStatus: run.sizingStatus,
      applyEligible: run.applyEligible,
      reasonCodes: run.reasonCodes,
      alternatives: run.alternatives,
      physicalLength: run.physicalLength,
      equivalentLength: run.equivalentLength,
      equivalentLengthPerBend: run.equivalentLengthPerBend,
      frictionRate: run.frictionRate,
      pressureDrop: run.pressureDrop,
      pressureAssumption: run.pressureAssumption,
      airflowSource: run.airflowSource,
      airflowReviewed: run.airflowReviewed,
      airflowEvidence: run.airflowEvidence,
      overCapacity: run.overCapacity,
    }));
    return {
      systemId: activeSystem,
      systemName: systemLabel(activeSystem),
      calculationVersion: BALANCE_CALCULATION_VERSION,
      ductSizingVersion: DUCT_SIZING_CALCULATION_VERSION,
      evidenceFingerprint: stableTextHash(`${systemDrawingSignature(activeSystem)}|${BALANCE_CALCULATION_VERSION}|${DUCT_SIZING_CALCULATION_VERSION}`),
      designCfm: setup.targetCfm,
      supplyCfm: setup.supplyCfm,
      returnCfm: setup.returnCfm,
      connectedSupplyCfm: setup.connectedSupplyCfm,
      connectedReturnCfm: setup.connectedReturnCfm,
      connectedSupplyTerminals: setup.connectedSupplyTerminals,
      connectedReturnTerminals: setup.connectedReturnTerminals,
      supplyTerminalCount: setup.supplyTerminals.length,
      returnTerminalCount: setup.returnTerminals.length,
      totalRunCount: drawings.filter((drawing) =>
        drawingSystem(drawing) === activeSystem &&
        ["supply", "return", "fresh"].includes(drawing.type) &&
        !drawing.fitting
      ).length,
      scaleVerified: activeScaleStatus.verified,
      airflowTargetSource,
      planningSeedTerminalCount,
      missingTerminalCfm,
      roomTargetSource: savedRoomTargets && roomAirflowTargetsAreReviewed()
        ? "saved-targets"
        : "draft-allocation",
      rules: {
        supplyVelocityLimit,
        returnVelocityLimit,
        freshVelocityLimit,
        residentialFlexMax,
      },
      runs,
      rooms,
      networks,
      cfmProposals: terminalCfmProposals(targets).map((proposal) => ({
        id: proposal.id,
        drawingId: proposal.drawingId,
        kind: proposal.kind,
        room: proposal.room,
        label: proposal.label,
        current: proposal.current,
        proposed: proposal.proposed,
        connected: proposal.connected,
      })),
      reviews: balanceReviewRecords.filter((review) => review.systemId === activeSystem),
    };
  }

  function recordSystemBalanceReview(reviewer: string, note: string) {
    const model = buildSystemBalanceModel();
    const summary = summarizeSystemBalance(model);
    const review: BalanceReviewRecord = {
      id: crypto.randomUUID(),
      systemId: activeSystem,
      reviewer,
      note,
      createdAt: new Date().toISOString(),
      evidenceFingerprint: model.evidenceFingerprint,
      score: summary.score,
      designCfm: model.designCfm,
      supplyCfm: model.supplyCfm,
      returnCfm: model.returnCfm,
      openSizeRecommendations: model.runs.length,
      openCfmRecommendations: model.cfmProposals.length,
      connectionProblems: summary.connectionProblems + summary.unresolvedNetworks + summary.disconnectedDevices,
    };
    setBalanceReviewRecords((current) => [...current, review]);
    setBranchMessage(`${systemLabel(activeSystem)} balance state reviewed by ${reviewer} · drawing geometry was not changed`);
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

  function exportSystemBalanceRunCsv() {
    const model = buildSystemBalanceModel();
    const activeScaleStatus = systemScaleStatus(activeSystem);
    if (!model.runs.length) {
      setBranchMessage("No velocity-screened size candidates or over-capacity runs are waiting");
      return;
    }
    const quote = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const csv = [
      ["HVAC SYSTEM BALANCE REVIEW — PLANNING ONLY"],
      ["System", model.systemName],
      ["Calculation version", model.calculationVersion],
      ["Evidence fingerprint", model.evidenceFingerprint],
      ["Airflow target source", model.airflowTargetSource],
      ["Room target source", model.roomTargetSource],
      ["Drawing scale", model.scaleVerified ? activeScaleStatus.detail : `UNVERIFIED — ${activeScaleStatus.detail}`],
      [],
      ["Run ID", "Type", "Room / Route", "Airflow Source", "Planning CFM", "Current Size", "Velocity-Screened Candidate", "Current FPM", "Candidate FPM", "Limit FPM", "Current-Segment Rough Loss", "Status"],
      ...model.runs.map((run) => [
        run.id,
        run.type,
        run.room,
        run.airflowSource,
        run.cfm,
        `${run.currentSize}"`,
        `${run.recommendedSize}"`,
        run.currentVelocity,
        run.recommendedVelocity,
        run.velocityLimit,
        model.scaleVerified ? `~${run.pressureDrop.toFixed(2)} in. w.g.` : "Scale unverified",
        run.overCapacity ? "OVER CAPACITY — PARALLEL PATH / REDESIGN" : "REVIEW CANDIDATE",
      ]),
      [],
      ["Disclaimer", "Velocity-screened planning candidates do not verify pressure, sound, blower performance, room loads, code, or installation conditions."],
    ].map((row) => row.map(quote).join(",")).join("\n");
    const link = document.createElement("a");
    const objectUrl = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.href = objectUrl;
    link.download = `${systemLabel(activeSystem).replaceAll(" ", "-").toLowerCase()}-balance-size-review.csv`;
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
    const hasSheetScales = Boolean(project.sheetScales && Object.keys(project.sheetScales).length);
    const releaseState = {
      drawings: [...(project.drawings || [])].sort((left, right) => left.id.localeCompare(right.id)),
      pdfFingerprint: project.pdfFingerprint || "",
      sheetScales: project.sheetScales || {},
      ...(!hasSheetScales ? {
        scaleFeetPerUnit: project.scaleFeetPerUnit || 0,
        scaleLabel: project.scaleLabel || "",
        scaleVerified: Boolean(project.scaleVerified),
      } : {}),
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
      ...(project.roomAirflowTargetReviewFingerprints && Object.keys(project.roomAirflowTargetReviewFingerprints).length
        ? { roomAirflowTargetReviewFingerprints: project.roomAirflowTargetReviewFingerprints }
        : {}),
      ...(project.balanceReviewRecords?.length
        ? { balanceReviewRecords: project.balanceReviewRecords }
        : {}),
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
    const issues: Array<Omit<ValidationIssue, "id" | "ruleId" | "evidenceFingerprint">> = [];
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
      if (scaleStateForPage(drawing.page).verified && pressure.pressureDrop > .15) issues.push({
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
          instanceKey: `port-${port + 1}`,
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
    return issues.map((issue) => {
      const identity = buildFindingIdentity({
        systemId: activeSystem,
        title: issue.title,
        severity: issue.severity,
        detail: issue.detail,
        drawingId: issue.drawingId,
        instanceKey: issue.instanceKey,
      });
      return {
        ...issue,
        ...identity,
        legacyId: `review-${stableTextHash([activeSystem, issue.title, issue.drawingId || "system", issue.detail].join("|"))}`,
      };
    });
  }

  function issueCategory(title: string): PlanFindingCategory {
    const value = title.toLowerCase();
    if (["disconnect", "connection", "fitting", "pulled away", "systems touch"].some((term) => value.includes(term))) return "Connections";
    if (["return", "bedroom", "door-closed"].some((term) => value.includes(term))) return "Return paths";
    if (["velocity", "friction", "pressure loss", "undersized", "progression"].some((term) => value.includes(term))) return "Duct sizing";
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

  function reviewDecisionForIssue(issue: ValidationIssue, decisions = activeReviewDecisions()) {
    return decisions[issue.id] || (issue.legacyId ? decisions[issue.legacyId] : undefined);
  }

  function reviewIssueReference(issue: ValidationIssue) {
    return `REV-${issue.id.replace("review-", "").slice(-5).toUpperCase()}`;
  }

  function reviewIssueMarkerLabel(issue: ValidationIssue) {
    return `${issue.severity === "critical" ? "C" : issue.severity === "warning" ? "W" : "I"}${issue.id.replace("review-", "").slice(-2).toUpperCase()}`;
  }

  function fixPlanSourceFingerprint() {
    return pdfFingerprint || stableTextHash(`${fileName}|local-plan-source`);
  }

  function reviewedIssueRows(issues = validationIssues()) {
    const decisions = activeReviewDecisions();
    const severityOrder: Record<ValidationSeverity, number> = { critical: 0, warning: 1, info: 2 };
    return issues
      .map((issue) => {
        const decision = reviewDecisionForIssue(issue, decisions);
        const decisionStale = Boolean(decision && isFixPlanAnswerStale({
          issueId: decision.issueId,
          evidenceFingerprint: decision.evidenceFingerprint || "",
          sourceFingerprint: decision.sourceFingerprint || "",
        }, {
          issueId: issue.id,
          evidenceFingerprint: issue.evidenceFingerprint,
          sourceFingerprint: fixPlanSourceFingerprint(),
        }));
        const linkedRfi = decision?.status === "rfi" ? rfiItems.find((item) => item.id === decision.linkedRecordId) : undefined;
        const linkedPunch = decision?.status === "punch" ? punchItems.find((item) => item.id === decision.linkedRecordId) : undefined;
        const resolvedByDecision = fixPlanAnswerCompletesReview({
          severity: issue.severity,
          status: decision?.status,
          stale: decisionStale,
          rfiStatus: linkedRfi?.status,
          punchStatus: linkedPunch?.status,
        });
        return { issue, decision, decisionStale, resolvedByDecision };
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

  function focusPlanPoint(
    point: Point,
    options: { avoidAssistant?: boolean } = {},
  ) {
    const viewport = canvasViewportRef.current;
    if (!viewport) return;
    const assistant = options.avoidAssistant
      ? document.querySelector<HTMLElement>('[data-plan-occluder="plan-helper"]')
      : null;
    const target = planFocusTarget(
      viewport.getBoundingClientRect(),
      assistant?.getBoundingClientRect(),
    );
    if (assistant && target.mode === "close-occluder") {
      setShowMarkupAssistant(false);
      setBranchMessage("Fix Plan closed so the selected location can use the full drawing area");
    }
    updateCamera({
      x: target.x - point.x * zoomRef.current,
      y: target.y - point.y * zoomRef.current,
    });
  }

  function focusDrawingOnPlan(
    drawingId: string,
    options: { avoidAssistant?: boolean } = {},
  ) {
    const drawing = drawings.find((candidate) => candidate.id === drawingId);
    if (!drawing) return;
    const point = drawing.points[Math.floor(drawing.points.length / 2)] || drawing.points[0];
    if (!point) return;
    setActiveSystem(drawingSystem(drawing));
    setSelectedId(drawing.id);
    setSelectedIds([drawing.id]);
    setActiveTool("select");
    if (drawing.page !== pageNumber || renderedPageNumber !== drawing.page) {
      pendingFocusRef.current = {
        page: drawing.page,
        point,
        avoidAssistant: options.avoidAssistant,
      };
      setPageNumber(drawing.page);
      return;
    }
    requestAnimationFrame(() => focusPlanPoint(point, options));
  }

  function focusReviewIssue(issue: ValidationIssue) {
    const decision = reviewDecisionForIssue(issue);
    setReviewView("issues");
    setActiveReviewIssueId(issue.id);
    setReviewerName(decision?.reviewer || "");
    setReviewDecisionNote(decision?.note || "");
    const recommendation = markupRecommendations.find((candidate) =>
      candidate.findingId === issue.id
    );
    openMarkupAssistant("fix-plan", recommendation);
    if (issue.drawingId) {
      window.requestAnimationFrame(() =>
        focusDrawingOnPlan(issue.drawingId!, { avoidAssistant: true })
      );
    }
  }

  function reviewIssueMarkers(rows = reviewedIssueRows()) {
    if (!showReviewMarkers || (rightTab !== "checks" && !showMarkupAssistant)) return [];
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

  function resolveReviewIssue(
    issue: ValidationIssue,
    status: ReviewDecisionStatus,
    input?: {
      reviewer: string;
      note: string;
      handledReason?: FixPlanHandledReason;
    },
  ) {
    const decisionReviewer = input?.reviewer.trim() || reviewerName.trim();
    const decisionNote = input?.note.trim() || reviewDecisionNote.trim();
    if (!decisionReviewer || !decisionNote) {
      setBranchMessage("Add the reviewer name and a decision note before recording this review");
      return false;
    }
    if (status === "handled-elsewhere" && !input?.handledReason) {
      setBranchMessage("Choose where this issue is being handled before saving the answer");
      return false;
    }
    const now = new Date().toISOString();
    const existingDecision = reviewDecisionForIssue(issue);
    let linkedRecordId: string | undefined;
    if (status === "rfi") {
      const linkedExistingRfi = existingDecision?.status === "rfi" ? rfiItems.find((item) => item.id === existingDecision.linkedRecordId) : undefined;
      const existingRfi = linkedExistingRfi ||
        rfiItems.find((item) => item.systemId === activeSystem && item.drawingId === issue.drawingId && item.subject === issue.title && !["approved", "closed"].includes(item.status));
      if (existingRfi) {
        linkedRecordId = existingRfi.id;
        setRfiItems((current) => current.map((item) => item.id === existingRfi.id ? {
          ...item,
          proposedSolution: decisionNote,
          assignedTo: decisionReviewer,
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
          proposedSolution: decisionNote,
          assignedTo: decisionReviewer,
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
          assignedTo: decisionReviewer,
          note: decisionNote,
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
          assignedTo: decisionReviewer,
          note: decisionNote,
          status: "open",
          createdAt: now,
        }]);
      }
    }
    const decision: ReviewDecision = {
      issueId: issue.id,
      evidenceFingerprint: issue.evidenceFingerprint,
      sourceFingerprint: fixPlanSourceFingerprint(),
      answerVersion: FIX_PLAN_ANSWER_VERSION,
      systemId: activeSystem,
      page: issue.drawingId
        ? drawings.find((drawing) => drawing.id === issue.drawingId)?.page
        : pageNumber,
      status,
      reviewer: decisionReviewer,
      note: decisionNote,
      updatedAt: now,
      linkedRecordId,
      handledReason: status === "handled-elsewhere" ? input?.handledReason : undefined,
    };
    setReviewDecisionsBySystem((current) => {
      const nextSystem = { ...(current[activeSystem] || {}), [issue.id]: decision };
      if (issue.legacyId && issue.legacyId !== issue.id) delete nextSystem[issue.legacyId];
      return { ...current, [activeSystem]: nextSystem };
    });
    setBranchMessage(
      issue.severity === "critical"
        ? `${issue.title} was documented, but remains a release blocker until the drawing condition is fixed`
        : status === "handled-elsewhere"
          ? `${issue.title} was documented elsewhere and remains open in Fix Plan`
          : `${issue.title} review decision recorded`,
    );
    return true;
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
      ["System", "Reference", "Rule ID", "Evidence ID", "Evidence State", "Severity", "Category", "Issue", "Detail", "Disposition", "Reviewer", "Decision Note", "Updated", "Plan Link"],
      ...rows.map((row) => [
        systemLabel(activeSystem),
        reviewIssueReference(row.issue),
        row.issue.ruleId,
        row.issue.evidenceFingerprint,
        row.decisionStale ? "CHANGED — REVIEW AGAIN" : "CURRENT",
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

  function systemDrawingSignatureFor(sourceDrawings: Drawing[], systemId = activeSystem) {
    const scopedDrawings = sourceDrawings
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
        ...(drawing.cfmSource ? { cfmSource: drawing.cfmSource } : {}),
        roomName: drawing.roomName || "",
        roomType: drawing.roomType || "",
        elevation: drawing.elevation || "",
        labelOffset: drawing.labelOffset,
        labelScale: normalizedDuctLabelScale(drawing.labelScale),
        runNumber: drawing.runNumber || "",
        sizeReviewed: drawing.sizeReviewed ?? null,
        fitting: drawing.fitting,
        symbol: drawing.symbol,
      }));
    return stableTextHash(JSON.stringify({
      drawings: scopedDrawings,
      roomTargets: Object.entries(roomAirflowTargets[systemId] || {}).sort(([a], [b]) => a.localeCompare(b)),
      ...(roomAirflowTargetReviewFingerprints[systemId]
        ? { roomTargetReviewFingerprint: roomAirflowTargetReviewFingerprints[systemId] }
        : {}),
      pdfFingerprint,
      sheetScales: Object.fromEntries(
        [...new Set(scopedDrawings.map((drawing) => drawing.page))]
          .sort((left, right) => left - right)
          .map((page) => [String(page), scaleStateForPage(page)])
      ),
      visibleLabels: { showCfmLabels, showLengthLabels, showFittingLabels },
      velocityRules: { supplyVelocityLimit, returnVelocityLimit, freshVelocityLimit, residentialFlexMax },
    }));
  }

  function systemDrawingSignature(systemId = activeSystem) {
    return systemDrawingSignatureFor(drawings, systemId);
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
        evidenceFingerprint: decision.evidenceFingerprint || "",
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

  function buildActiveConnectionRepairPlan(
    choices: Record<string, string> = connectionCandidateChoices,
  ) {
    const runs: ConnectionRunSnapshot[] = drawings
      .filter((drawing) =>
        drawingSystem(drawing) === activeSystem &&
        (drawing.type === "supply" || drawing.type === "return") &&
        !drawing.fitting &&
        drawing.points.length >= 2
      )
      .map((drawing) => ({
        id: drawing.id,
        page: drawing.page,
        systemId: drawingSystem(drawing),
        type: drawing.type as "supply" | "return",
        size: drawing.size,
        points: drawing.points,
      }));
    const targets: ConnectionRepairTarget[] = [];

    for (const drawing of drawings.filter((candidate) => drawingSystem(candidate) === activeSystem)) {
      if (drawing.symbol?.kind === "diffuser" || drawing.symbol?.kind === "returnGrille") {
        const ductType = drawing.symbol.kind === "returnGrille" ? "return" : "supply";
        const objectName = drawing.symbol.kind === "returnGrille" ? "Return grille" : "Supply can";
        targets.push({
          id: `device:${drawing.id}:${ductType}`,
          kind: "device",
          drawingId: drawing.id,
          label: drawing.roomName || drawing.symbol.label || objectName,
          detail: objectName,
          page: drawing.page,
          systemId: drawingSystem(drawing),
          ductType,
          slot: "terminal",
          targetPoint: drawing.points[0],
          savedRunId: drawing.symbol.connectedRunId,
          savedEnd: drawing.symbol.connectedEnd,
        });
        continue;
      }
      if (isPrimaryAirflowEquipment(drawing)) {
        const ports = equipmentPlenumPorts(drawing);
        const equipmentLabel = drawing.symbol?.label || equipmentTypeName(drawing.symbol?.variant) || "HVAC unit";
        targets.push({
          id: `device:${drawing.id}:supply`,
          kind: "device",
          drawingId: drawing.id,
          label: `${equipmentLabel} supply`,
          detail: "Equipment supply plenum",
          page: drawing.page,
          systemId: drawingSystem(drawing),
          ductType: "supply",
          slot: "equipment-supply",
          targetPoint: ports.supply,
          savedRunId: drawing.symbol?.connectedRunId,
          savedEnd: drawing.symbol?.connectedEnd,
        }, {
          id: `device:${drawing.id}:return`,
          kind: "device",
          drawingId: drawing.id,
          label: `${equipmentLabel} return`,
          detail: "Equipment return plenum",
          page: drawing.page,
          systemId: drawingSystem(drawing),
          ductType: "return",
          slot: "equipment-return",
          targetPoint: ports.return,
          savedRunId: drawing.symbol?.returnRunId,
          savedEnd: drawing.symbol?.returnEnd,
        });
        continue;
      }
      if (drawing.fitting) {
        const ports = fittingPortPoints(drawing);
        const axis = drawing.fitting.angle;
        const branchAxis = drawing.fitting.branchAngle
          ?? axis + drawing.fitting.side * (drawing.fitting.style === "tee90" ? Math.PI / 2 : Math.PI / 4);
        const portDirections = [axis + Math.PI, axis, branchAxis];
        const portSizes = [
          drawing.fitting.upstreamSize,
          drawing.fitting.downstreamSize,
          drawing.fitting.branchSize,
        ];
        ([0, 1, 2] as const).forEach((port) => {
          const runId = drawing.fitting!.connectedIds[port];
          targets.push({
            id: `fitting:${drawing.id}:${port}`,
            kind: "fitting",
            drawingId: drawing.id,
            label: `${drawing.roomName || "T/Y fitting"} · Port ${port + 1}`,
            detail: runId ? "Saved T/Y connection" : "Open T/Y port",
            page: drawing.page,
            systemId: drawingSystem(drawing),
            ductType: "supply",
            port,
            targetPoint: ports[port],
            savedRunId: runId || undefined,
            expectedDirection: {
              x: Math.cos(portDirections[port]),
              y: Math.sin(portDirections[port]),
            },
            expectedSize: portSizes[port],
          });
        });
      }
    }

    const repairPages = [...new Set([...runs.map((run) => run.page), ...targets.map((target) => target.page)])]
      .sort((left, right) => left - right);
    const repairSheetScales = Object.fromEntries(
      repairPages.map((page) => {
        const pageScale = scaleStateForPage(page);
        return [String(page), {
          verified: pageScale.verified,
          feetPerUnit: pageScale.feetPerUnit,
        }];
      }),
    );
    const singleSheetScale = repairPages.length === 1
      ? scaleStateForPage(repairPages[0])
      : { verified: false, feetPerUnit: defaultScaleFeetPerUnit };

    return buildConnectionRepairPlan({
      systemId: activeSystem,
      runs,
      targets,
      choices,
      scale: {
        verified: singleSheetScale.verified,
        feetPerUnit: singleSheetScale.feetPerUnit,
        byPage: repairSheetScales,
      },
    });
  }

  function systemBuilderSummary(
    audit = validationDashboard(),
    packageSummary = fieldPackageSummary(),
    connectionPlan = buildActiveConnectionRepairPlan(),
  ) {
    const scoped = drawings.filter((drawing) => drawingSystem(drawing) === activeSystem);
    const runs = scoped.filter((drawing) => ["supply", "return", "fresh"].includes(drawing.type) && !drawing.fitting);
    const fittings = scoped.filter((drawing) => drawing.fitting);
    const devices = scoped.filter((drawing) =>
      ["diffuser", "returnGrille"].includes(drawing.symbol?.kind || "") ||
      isPrimaryAirflowEquipment(drawing)
    );
    const deviceConnections = connectionPlan.items.filter((item) => item.kind === "device");
    const fittingConnections = connectionPlan.items.filter((item) => item.kind === "fitting");
    const connectedDevices = deviceConnections.filter((item) => item.status === "healthy");
    const totalPorts = fittingConnections.length;
    const healthyPorts = fittingConnections.filter((item) => item.status === "healthy").length;
    const openFittingPorts = fittings.reduce((total, fitting) =>
      total + ([0, 1, 2] as const).filter((port) => !fitting.fitting!.connectedIds[port]).length, 0);
    const sizing = sizingSuggestions();
    const connectionPercent = deviceConnections.length || totalPorts
      ? Math.round((connectedDevices.length + healthyPorts) / Math.max(1, deviceConnections.length + totalPorts) * 100)
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
      unconnectedDevices: deviceConnections.length - connectedDevices.length,
      totalPorts,
      healthyPorts,
      brokenPorts: totalPorts - healthyPorts,
      openFittingPorts,
      connectionPlan,
      sizing,
      audit,
      packageSummary,
      connectionPercent,
      sizingPercent,
      packagePercent,
      progress,
    };
  }

  function refreshConnectionRepairReview() {
    const plan = buildActiveConnectionRepairPlan({});
    const firstIssue = plan.items.find((item) => item.status !== "healthy");
    setConnectionCandidateChoices({});
    setSelectedConnectionRepairIds([]);
    setConnectionReviewFingerprint(plan.fingerprint);
    setFocusedConnectionRepairId(firstIssue?.id || null);
  }

  function openConnectionRepairReview() {
    refreshConnectionRepairReview();
    setConnectionReviewOpen(true);
  }

  function focusConnectionRepair(item: ConnectionRepairItem) {
    setFocusedConnectionRepairId(item.id);
    focusDrawingOnPlan(item.drawingId, { avoidAssistant: true });
  }

  function chooseConnectionCandidate(item: ConnectionRepairItem, candidateId: string) {
    setConnectionCandidateChoices((current) => ({ ...current, [item.id]: candidateId }));
    setSelectedConnectionRepairIds((current) => current.filter((id) => id !== item.id));
    setFocusedConnectionRepairId(item.id);
    focusDrawingOnPlan(item.drawingId, { avoidAssistant: true });
  }

  function toggleConnectionRepair(item: ConnectionRepairItem) {
    if (item.status !== "ready") return;
    setSelectedConnectionRepairIds((current) =>
      current.includes(item.id)
        ? current.filter((id) => id !== item.id)
        : [...current, item.id]
    );
    setFocusedConnectionRepairId(item.id);
  }

  function selectAllReadyConnectionRepairs() {
    setSelectedConnectionRepairIds(
      activeConnectionRepairPlan.items
        .filter((item) => item.status === "ready")
        .map((item) => item.id)
    );
  }

  function connectionRepairDistanceValue(distance: number, page: number) {
    const pageScale = scaleStateForPage(page);
    if (!pageScale.verified) return `${distance.toFixed(0)} plan units`;
    const feet = distance * pageScale.feetPerUnit;
    return feet < 1 ? `${Math.max(1, Math.round(feet * 12))} in gap` : `${feet.toFixed(1)} ft gap`;
  }

  function connectionRepairDistance(item: ConnectionRepairItem) {
    const candidate = item.candidate || item.candidates[0];
    return candidate ? connectionRepairDistanceValue(candidate.distance, item.page) : "";
  }

  function connectionRepairPreviewChanges(item: ConnectionRepairItem): RepairChange[] {
    const candidate = item.candidate || item.candidates[0];
    if (!candidate) return [];
    const changes: RepairChange[] = [{
      objectId: candidate.runId,
      field: `${candidate.end} endpoint`,
      before: `${candidate.point.x.toFixed(1)}, ${candidate.point.y.toFixed(1)}`,
      after: `${item.targetPoint.x.toFixed(1)}, ${item.targetPoint.y.toFixed(1)}`,
    }];
    const target = drawings.find((drawing) => drawing.id === item.drawingId);
    if (item.kind === "fitting" && target?.fitting && item.port != null) {
      const currentRunId = target.fitting.connectedIds[item.port] || "";
      if (currentRunId !== candidate.runId) {
        changes.push({
          objectId: target.id,
          field: `T/Y port ${item.port + 1} run reference`,
          before: currentRunId || "Not connected",
          after: candidate.runId,
        });
      }
      const sizeFields = ["upstreamSize", "downstreamSize", "branchSize"] as const;
      const sizeField = sizeFields[item.port];
      if (target.fitting[sizeField] !== candidate.runSize) {
        changes.push({
          objectId: target.id,
          field: `T/Y port ${item.port + 1} size`,
          before: `${target.fitting[sizeField]}"`,
          after: `${candidate.runSize}"`,
        });
      }
    }
    if (item.kind === "device" && target?.symbol) {
      const isReturn = item.slot === "equipment-return";
      const currentRunId = isReturn
        ? target.symbol.returnRunId
        : target.symbol.connectedRunId;
      const currentEnd = isReturn
        ? target.symbol.returnEnd
        : target.symbol.connectedEnd;
      if (currentRunId !== candidate.runId) {
        changes.push({
          objectId: target.id,
          field: `${item.slot || "terminal"} run reference`,
          before: currentRunId || "Not connected",
          after: candidate.runId,
        });
      }
      if (currentEnd !== candidate.end) {
        changes.push({
          objectId: target.id,
          field: `${item.slot || "terminal"} connected endpoint`,
          before: currentEnd || "Not connected",
          after: candidate.end,
        });
      }
    }
    return changes;
  }

  function applyConnectionRepairSelection(
    repairIds: string[],
    expectedFingerprint: string,
    review?: {
      reviewer: string;
      note: string;
    },
  ) {
    const currentPlan = buildActiveConnectionRepairPlan(connectionCandidateChoices);
    const batch = prepareConnectionRepairBatch(
      currentPlan,
      repairIds,
      expectedFingerprint,
    );
    if (!batch.ok) {
      setBranchMessage(batch.reason);
      return false;
    }
    const next = drawings.map((drawing) => ({
      ...drawing,
      points: drawing.points.map((point) => ({ ...point })),
      symbol: drawing.symbol ? { ...drawing.symbol } : undefined,
      fitting: drawing.fitting ? { ...drawing.fitting, connectedIds: [...drawing.fitting.connectedIds] } : undefined,
    }));
    for (const operation of batch.operations) {
      const reviewedItem = currentPlan.items.find((item) => item.id === operation.itemId);
      const run = next.find((drawing) =>
        drawing.id === operation.runId &&
        drawing.page === reviewedItem?.page &&
        drawingSystem(drawing) === activeSystem &&
        drawing.type === reviewedItem?.ductType &&
        !drawing.fitting &&
        drawing.points.length >= 2
      );
      if (!run) {
        setBranchMessage("A reviewed run changed. Refresh Step 1 before applying.");
        return false;
      }
      const endpointIndex = operation.end === "start" ? 0 : run.points.length - 1;
      const endpoint = run.points[endpointIndex];
      if (Math.hypot(endpoint.x - operation.from.x, endpoint.y - operation.from.y) > .01) {
        setBranchMessage("A reviewed endpoint moved. Refresh Step 1 before applying.");
        return false;
      }
      run.points[endpointIndex] = { ...operation.to };
      if (operation.kind === "fitting") {
        const fitting = next.find((drawing) =>
          drawing.id === operation.drawingId &&
          drawing.page === reviewedItem?.page &&
          drawingSystem(drawing) === activeSystem &&
          drawing.fitting
        );
        if (!fitting?.fitting || operation.port == null) {
          setBranchMessage("A reviewed T/Y fitting changed. Refresh Step 1 before applying.");
          return false;
        }
        fitting.fitting.connectedIds[operation.port] = run.id;
        if (operation.port === 0) fitting.fitting.upstreamSize = run.size;
        if (operation.port === 1) fitting.fitting.downstreamSize = run.size;
        if (operation.port === 2) fitting.fitting.branchSize = run.size;
        continue;
      }
      if (operation.kind !== "device") continue;
      const device = next.find((drawing) => drawing.id === operation.drawingId && drawing.symbol);
      if (!device?.symbol) {
        setBranchMessage("A reviewed device changed. Refresh Step 1 before applying.");
        return false;
      }
      device.symbol = operation.slot === "equipment-return"
        ? { ...device.symbol, returnRunId: run.id, returnEnd: operation.end }
        : { ...device.symbol, connectedRunId: run.id, connectedEnd: operation.end };
    }
    const beforeDrawingFingerprint = systemDrawingSignatureFor(drawings, activeSystem);
    const afterDrawingFingerprint = systemDrawingSignatureFor(next, activeSystem);
    const connectionRecord = review ? (() => {
      const repairRuns = (sourceDrawings: Drawing[]) => sourceDrawings.flatMap((drawing) => {
        if (
          drawingSystem(drawing) !== activeSystem ||
          drawing.fitting ||
          drawing.symbol ||
          !["supply", "return", "fresh"].includes(drawing.type)
        ) return [];
        return [{
          id: drawing.id,
          type: drawing.type as "supply" | "return" | "fresh",
          size: drawing.size,
          measuredLengthFeet: drawingLengthFeet(drawing),
        }];
      });
      const createdAt = new Date().toISOString();
      const actionIds = batch.operations.map((operation) => `connection-fix-${operation.itemId}`);
      return {
        id: `repair-batch-${stableTextHash(`${expectedFingerprint}|${createdAt}|${actionIds.join("|")}`)}`,
        repairPlanId: `connection-repair-${stableTextHash(expectedFingerprint)}`,
        systemId: activeSystem,
        repairVersion: ASSISTANT_REPAIR_VERSION,
        evidenceFingerprint: expectedFingerprint,
        beforeDrawingFingerprint,
        afterDrawingFingerprint,
        autonomyMode: "guided" as const,
        actionIds,
        actions: batch.operations.map((operation) => {
          const item = currentPlan.items.find((candidate) => candidate.id === operation.itemId);
          return {
            id: `connection-fix-${operation.itemId}`,
            kind: "manual-follow-up" as const,
            title: item?.label || "Connect existing run endpoint",
            detail: item?.detail || "Reviewed connection repair",
            problem: item?.reason || "The saved connection and run endpoint do not agree.",
            proposedFix: `Move only the reviewed ${operation.end} endpoint onto the saved connection.`,
            expectedResult: "The saved connection and existing run endpoint agree without creating a route or branch stub.",
            objectIds: [operation.drawingId, operation.runId],
            evidenceFingerprint: `${expectedFingerprint}:${operation.itemId}:${operation.runId}:${operation.end}`,
            priority: "do-first" as const,
            stage: "connections" as const,
            changeScope: "One existing run endpoint and its saved connection reference.",
            geometryChanges: true,
            changes: item ? connectionRepairPreviewChanges(item) : [{
              objectId: operation.runId,
              field: `${operation.end} endpoint`,
              before: `${operation.from.x.toFixed(1)}, ${operation.from.y.toFixed(1)}`,
              after: `${operation.to.x.toFixed(1)}, ${operation.to.y.toFixed(1)}`,
            }],
          };
        }),
        takeoffImpact: buildTakeoffImpact({
          runs: repairRuns(drawings),
          afterRuns: repairRuns(next),
          sizeChanges: [],
          wastePercent: materialWastePercent,
          affectedFittingIds: batch.operations
            .filter((operation) => operation.kind === "fitting")
            .map((operation) => operation.drawingId),
        }),
        reviewer: review.reviewer,
        note: review.note,
        planningOverrideAcknowledged: false,
        createdAt,
        cloudSync: workingCloudProjectId ? "pending" as const : "local" as const,
      } satisfies RepairBatchRecord;
    })() : undefined;
    setHistory(next);
    if (connectionRecord) {
      setAssistantRepairRecords((current) => [...current, connectionRecord]);
      if (workingCloudProjectId) {
        void saveCloudRepairBatch({
          projectId: workingCloudProjectId,
          revisionId: workingCloudRevisionId,
          record: connectionRecord,
        }).then((cloudBatch) => {
          setAssistantRepairRecords((current) => current.map((candidate) =>
            candidate.id === connectionRecord.id
              ? { ...candidate, cloudBatchId: cloudBatch.id, cloudSync: "synced" }
              : candidate
          ));
        }).catch(() => {
          setBranchMessage("The connection fix is saved locally with one Undo. Its cloud receipt is still pending.");
        });
      }
    }
    setConnectionReviewOpen(false);
    setSelectedConnectionRepairIds([]);
    setConnectionCandidateChoices({});
    setConnectionReviewFingerprint("");
    setFocusedConnectionRepairId(null);
    const remainingConnections = Math.max(0, activeConnectionRepairIssues.length - batch.operations.length);
    setBranchMessage(`${batch.operations.length} connection${batch.operations.length === 1 ? "" : "s"} repaired · ${remainingConnections} still need review · no objects moved and no runs were created · one Undo restores the batch`);
    trackProductEvent("connection_repair_applied", {
      system_id: activeSystem,
      repair_count: batch.operations.length,
    });
    return true;
  }

  function applySelectedConnectionRepairs() {
    return applyConnectionRepairSelection(
      selectedConnectionRepairIds,
      connectionReviewFingerprint,
    );
  }

  function openSystemSizingWorkflow() {
    openSystemBalanceStudio();
  }

  function openSystemAuditWorkflow() {
    setValidationFilter("all");
    const nextIssue = activeReviewedIssueRows.find((row) =>
      !row.resolvedByDecision
    )?.issue;
    if (nextIssue) {
      focusReviewIssue(nextIssue);
      return;
    }
    openMarkupAssistant("fix-plan");
  }

  function filteredValidationIssues() {
    return validationFilter === "all"
      ? activeValidationIssues
      : activeValidationIssues.filter((issue) => issue.severity === validationFilter);
  }

  function selectNextValidationIssue() {
    const selectable = activeReviewedIssueRows.filter((row) => !row.resolvedByDecision).map((row) => row.issue);
    if (!selectable.length) return;
    const index = validationCursor % selectable.length;
    focusReviewIssue(selectable[index]);
    setValidationCursor((index + 1) % selectable.length);
  }

  function buildTakeoff(systemId = activeSystem) {
    const ductTotals = new Map<string, { type: string; size: string; length: number }>();
    for (const drawing of drawings) {
      if (drawingSystem(drawing) !== systemId || !["supply", "return", "fresh"].includes(drawing.type) || drawing.fitting || drawing.symbol) continue;
      const key = `${drawing.type}-${drawing.size}`;
      const current = ductTotals.get(key) || { type: drawing.type, size: drawing.size, length: 0 };
      current.length += drawingLengthFeet(drawing);
      ductTotals.set(key, current);
    }
    const rows: TakeoffRow[] = [];
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
    const activeSymbols = drawings.filter((drawing) => drawingSystem(drawing) === systemId && drawing.symbol);
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
    drawings.filter((drawing) => drawingSystem(drawing) === systemId && drawing.fitting).forEach((drawing) => {
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

  function materialSummary(systemId = activeSystem) {
    const rows = buildTakeoff(systemId);
    const flexBoxes = rows.filter((row) => row.item.includes("flex duct")).reduce((total, row) => total + (Number(row.note.match(/^(\d+)/)?.[1]) || 0), 0);
    const deviceCount = rows.filter((row) => row.category === "Air devices" && !row.item.includes("can") && !row.item.includes("box")).reduce((total, row) => total + (Number(row.quantity.match(/^(\d+)/)?.[1]) || 0), 0);
    const fittingCount = rows.filter((row) => row.category === "Fittings").reduce((total, row) => total + (Number(row.quantity.match(/^(\d+)/)?.[1]) || 0), 0);
    const holds = systemId === activeSystem
      ? activeValidationIssues.filter((issue) => issue.severity !== "info" && ["Coordination", "Connections"].includes(issueCategory(issue.title)))
      : [];
    return { flexBoxes, deviceCount, fittingCount, holds };
  }

  function activeTakeoffSignature(systemId = activeSystem) {
    return stableTextHash(JSON.stringify({
      systemId,
      drawingSignature: systemReleaseSignature(systemId),
      rows: buildTakeoff(systemId),
      materialWastePercent,
      sheetScales: systemSheetScaleSnapshot(systemId),
    }));
  }

  function activeTakeoffPackages() {
    return takeoffPackageRecords
      .filter((record) => record.systemId === activeSystem)
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  function projectProductionSummary() {
    const activeSystems = systems.filter((system) => drawings.some((drawing) => drawingSystem(drawing) === system.id));
    return activeSystems.reduce((summary, system) => {
      const material = materialSummary(system.id);
      summary.systems += 1;
      summary.lineItems += buildTakeoff(system.id).length;
      summary.flexRolls += material.flexBoxes;
      summary.devices += material.deviceCount;
      summary.fittings += material.fittingCount;
      return summary;
    }, { systems: 0, lineItems: 0, flexRolls: 0, devices: 0, fittings: 0 });
  }

  async function createTakeoffPackage(saveToDrive = false) {
    const rows = buildTakeoff();
    if (!rows.length) {
      setBranchMessage("Draw ductwork or place HVAC equipment before creating a takeoff package");
      return;
    }
    if (!takeoffPackageName.trim() || !takeoffRevision.trim() || !takeoffPreparedBy.trim()) {
      setBranchMessage("Add the package name, revision, and prepared-by name first");
      return;
    }
    const material = materialSummary();
    const activeScaleStatus = systemScaleStatus(activeSystem);
    const record: TakeoffPackageRecord = {
      id: crypto.randomUUID(),
      systemId: activeSystem,
      name: takeoffPackageName.trim(),
      revision: takeoffRevision.trim(),
      preparedBy: takeoffPreparedBy.trim(),
      createdAt: new Date().toISOString(),
      drawingSignature: activeTakeoffSignature(),
      lineItemCount: rows.length,
      flexRollCount: material.flexBoxes,
      deviceCount: material.deviceCount,
      fittingCount: material.fittingCount,
      holdCount: material.holds.length,
    };
    setTakeoffSaving(true);
    try {
      let completed = record;
      if (saveToDrive) {
        const driveFile = await saveProjectPackageToDrive({
          projectName: `${fileName.replace(/\.pdf$/i, "")} — ${record.name} ${record.revision}`,
          packageType: "HVAC Plan Studio Plan Intelligence & Takeoff",
          version: 122,
          system: systemLabel(activeSystem),
          sourcePlan: fileName,
          scale: { label: activeScaleStatus.detail, verified: activeScaleStatus.verified },
          preparedBy: record.preparedBy,
          createdAt: record.createdAt,
          summary: material,
          rows,
          manualControlNotice: "This package reports the reviewed drawing state. Post-draw numbers and sizes do not move route geometry; connection or repair changes still require approval.",
        });
        completed = { ...record, driveFileId: driveFile.id, driveUrl: driveFile.webViewLink };
      }
      if (workingCloudProjectId && workingCloudRevisionId) {
        await saveCloudTakeoffPackage({
          projectId: workingCloudProjectId,
          revisionId: workingCloudRevisionId,
          systemId: activeSystem,
          name: completed.name,
          packageRevision: completed.revision,
          drawingSignature: completed.drawingSignature,
          packagePayload: { ...completed, rows },
          driveFileId: completed.driveFileId || null,
          driveUrl: completed.driveUrl || null,
        });
      }
      setTakeoffPackageRecords((current) => [completed, ...current]);
      setTakeoffView("packages");
      setBranchMessage(`${completed.name} ${completed.revision} saved${saveToDrive ? " to Google Drive" : ""}`);
      void trackProductEvent("takeoff_package_saved", {
        format: saveToDrive ? "drive_package" : "cloud_package",
        item_count: rows.length,
      });
    } catch (packageError) {
      setError(packageError instanceof Error ? packageError.message : "The takeoff package could not be saved.");
    } finally {
      setTakeoffSaving(false);
    }
  }

  function exportPurchaseSheetCsv() {
    const rows = buildTakeoff();
    if (!rows.length) return;
    const quote = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const activeScaleStatus = systemScaleStatus(activeSystem);
    const packageStatus = activeFieldPackage.released && !activeFieldPackage.stale && activeScaleStatus.verified
      ? activeFieldPackage.status
      : "DRAFT — NOT FOR INSTALLATION";
    const csv = [
      ["Package status", packageStatus, "", "", "", ""],
      ["Drawing scale", activeScaleStatus.verified ? activeScaleStatus.detail : `UNVERIFIED — ${activeScaleStatus.detail}`, "", "", "", ""],
      ["Drawing signature", systemDrawingSignature(), "", "", "", ""],
      [],
      ["System", "Category", "Item", "Size", "Order Quantity", "Purchasing / Fabrication Note"],
      ...rows.map((row) => [systemLabel(activeSystem), row.category, row.item, row.size, row.quantity, row.note]),
    ].map((row) => row.map(quote).join(",")).join("\n");
    const link = document.createElement("a");
    const objectUrl = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.href = objectUrl;
    link.download = `${systemLabel(activeSystem).replaceAll(" ", "-").toLowerCase()}-purchase-sheet.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    void trackProductEvent("takeoff_exported", {
      format: "csv",
      item_count: rows.length,
      origin: "manual_takeoff",
    });
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
    const coveredEndpoints = new Set<string>();
    const endpointUseCount = new Map<string, number>();
    const fittings = drawings.filter((drawing) => drawingSystem(drawing) === systemId && drawing.fitting);
    const endpointKey = (runId: string, end: "start" | "end") => `${runId}:${end}`;
    const coverEndpoint = (runId: string, end: "start" | "end") => {
      const key = endpointKey(runId, end);
      const uses = (endpointUseCount.get(key) || 0) + 1;
      endpointUseCount.set(key, uses);
      coveredEndpoints.add(key);
      if (uses > 1) fittingProblems.add(runId);
    };

    fittings.forEach((fitting) => {
      const ports = fittingPortPoints(fitting);
      const valid: Array<{ runId: string; end: "start" | "end" }> = [];
      fitting.fitting!.connectedIds.forEach((runId, port) => {
        const run = runById.get(runId);
        if (!run || run.page !== fitting.page || run.type !== "supply") return;
        const startDistance = Math.hypot(run.points[0].x - ports[port].x, run.points[0].y - ports[port].y);
        const endPoint = run.points[run.points.length - 1];
        const endDistance = Math.hypot(endPoint.x - ports[port].x, endPoint.y - ports[port].y);
        if (Math.min(startDistance, endDistance) >= 2) return;
        valid.push({ runId: run.id, end: startDistance <= endDistance ? "start" : "end" });
      });
      if (valid.length !== 3) valid.forEach(({ runId }) => fittingProblems.add(runId));
      valid.forEach(({ runId, end }) => {
        coverEndpoint(runId, end);
        valid.forEach(({ runId: otherId }) => {
          if (otherId !== runId) adjacency.get(runId)?.add(otherId);
        });
      });
    });

    function runTouchesPoint(
      runId: string | undefined,
      expectedType: "supply" | "return",
      point: Point,
      savedEnd: "start" | "end" | undefined,
    ) {
      const run = runId ? runById.get(runId) : undefined;
      if (!run || run.type !== expectedType || !savedEnd) return undefined;
      const endpoint = savedEnd === "start" ? run.points[0] : run.points[run.points.length - 1];
      const physicallyAttached = Math.hypot(endpoint.x - point.x, endpoint.y - point.y) < 2;
      return physicallyAttached ? { run, end: savedEnd } : undefined;
    }
    drawings.filter((drawing) => drawingSystem(drawing) === systemId && drawing.symbol).forEach((symbol) => {
      if (isPrimaryAirflowEquipment(symbol)) {
        const plenums = equipmentPlenumPorts(symbol);
        const supplyLink = runTouchesPoint(symbol.symbol?.connectedRunId, "supply", plenums.supply, symbol.symbol?.connectedEnd);
        const returnLink = runTouchesPoint(symbol.symbol?.returnRunId, "return", plenums.return, symbol.symbol?.returnEnd);
        if (supplyLink && supplyLink.run.page === symbol.page) coverEndpoint(supplyLink.run.id, supplyLink.end);
        if (returnLink && returnLink.run.page === symbol.page) coverEndpoint(returnLink.run.id, returnLink.end);
        return;
      }
      if (symbol.symbol?.kind === "diffuser") {
        const link = runTouchesPoint(symbol.symbol.connectedRunId, "supply", symbol.points[0], symbol.symbol.connectedEnd);
        if (link && link.run.page === symbol.page) coverEndpoint(link.run.id, link.end);
      }
      if (symbol.symbol?.kind === "returnGrille") {
        const link = runTouchesPoint(symbol.symbol.connectedRunId, "return", symbol.points[0], symbol.symbol.connectedEnd);
        if (link && link.run.page === symbol.page) coverEndpoint(link.run.id, link.end);
      }
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
      const freshControls = drawings.filter((drawing) =>
        drawingSystem(drawing) === systemId &&
        drawing.symbol?.kind === "motorDamper" &&
        componentRuns.some((run) => run.page === drawing.page && pointToDrawingDistance(drawing.points[0], run) <= 12)
      ).length;
      componentRuns.forEach((run) => {
        const hasFittingProblem = fittingProblems.has(run.id);
        const startCovered = coveredEndpoints.has(endpointKey(run.id, "start"));
        const endCovered = coveredEndpoints.has(endpointKey(run.id, "end"));
        const openEnds = [
          !startCovered ? "start" : "",
          !endCovered ? "end" : "",
        ].filter(Boolean).join(" and ");
        const connected = run.type === "fresh"
          ? freshControls > 0
          : !hasFittingProblem && startCovered && endCovered;
        const detail = hasFittingProblem
          ? "Open or detached T/Y port"
          : run.type === "supply" && openEnds
            ? `Open ${openEnds} endpoint — connect to equipment supply plenum, T/Y port, or supply terminal`
            : run.type === "return" && openEnds
              ? `Open ${openEnds} endpoint — connect to equipment return plenum, T/Y port, or return grille`
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
    const activeScaleStatus = systemScaleStatus(activeSystem);
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
      { id: "scale", label: "Drawing scale verified", clear: activeScaleStatus.verified, detail: activeScaleStatus.detail },
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
        ruleId: row.issue.ruleId,
        evidenceFingerprint: row.issue.evidenceFingerprint,
        severity: row.issue.severity,
        title: row.issue.title,
        detail: row.issue.detail,
        disposition: row.decision?.status || "open",
        reviewer: row.decision?.reviewer || "",
        note: row.decision?.note || "",
      })),
      rulesSnapshot: {
        scaleLabel,
        scaleFeetPerUnit,
        sheetScales: systemSheetScaleSnapshot(activeSystem),
        supplyVelocityLimit,
        returnVelocityLimit,
        freshVelocityLimit,
        residentialFlexMax,
      },
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
          releaseSignature: summary.releaseSignature,
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
    const activeScaleStatus = systemScaleStatus(activeSystem);
    const packageStatus = activeFieldPackage.released && !activeFieldPackage.stale && activeScaleStatus.verified
      ? activeFieldPackage.status
      : "DRAFT — NOT FOR INSTALLATION";
    const csv = [
      ["Package status", packageStatus, "", "", "", "", "", ""],
      ["Drawing scale", activeScaleStatus.verified ? activeScaleStatus.detail : `UNVERIFIED — ${activeScaleStatus.detail}`, "", "", "", "", "", ""],
      ["Drawing signature", systemDrawingSignature(), "", "", "", "", "", ""],
      [],
      ["System", "Duct Type", "Size", "Length LF", "Planning CFM", "Room / Area", "Elevation", "Connection Review"],
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
    const scaleStatus = systemScaleStatus(systemId);
    const activePackage = systemId === activeSystem ? activeFieldPackage : null;
    const releaseGatesClear = activePackage
      ? activePackage.gatesClear
      : designReady &&
        runs.length > 0 &&
        missingElevations === 0 &&
        missingRooms === 0 &&
        scaleStatus.verified &&
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

  function openReleaseGate(gateId: string) {
    if (gateId === "cloud") {
      setShowCloudProjects(true);
      return;
    }
    if (["critical", "warning", "connections", "rooms"].includes(gateId)) {
      const matchingIssue = activeReviewedIssueRows.find((row) => {
        if (row.resolvedByDecision) return false;
        if (gateId === "critical") return row.issue.severity === "critical";
        if (gateId === "warning") return row.issue.severity === "warning";
        if (gateId === "connections") return issueCategory(row.issue.title) === "Connections";
        return /bedroom|room|return path/i.test(row.issue.title);
      })?.issue;
      if (matchingIssue) focusReviewIssue(matchingIssue);
      else openMarkupAssistant("fix-plan");
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

  function applyResolvedScale(
    candidate: Pick<PlanScaleCandidate, "label" | "ratio">,
    page = pageNumber,
  ) {
    const resolved = resolveDetectedDrawingScale(candidate);
    if (!resolved) return false;
    rememberActiveSheetScale(page, {
      feetPerUnit: resolved.feetPerUnit,
      label: resolved.label,
      verified: true,
    });
    setCalibrating(false);
    setScaleHelperReturnPending(false);
    setMeasureDraft([]);
    return true;
  }

  function applyScalePreset(label: string) {
    applyResolvedScale({
      label,
      ratio: scaleRatioFromLabel(label),
    }, pageNumber);
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

    const upstream: Drawing = { ...target.drawing, points: upstreamPoints };
    const downstream: Drawing = {
      ...target.drawing,
      id: downstreamId,
      points: downstreamPoints,
      size: downstreamSize,
      cfm: target.drawing.cfm,
      cfmSource: target.drawing.cfmSource,
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
    const resized = drawings.map((drawing) => {
      if (drawing.id === fitting.id) return {
        ...drawing,
        size: `${updatedMeta.upstreamSize}×${updatedMeta.downstreamSize}×${updatedMeta.branchSize}`,
        fitting: updatedMeta,
      };
      if (drawing.id === connectedId) {
        return { ...drawing, size };
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
      cfmSource: "planning-seed",
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
        scaleX: defaultSymbolScale(kind),
        scaleY: defaultSymbolScale(kind),
        labelScale: defaultSymbolLabelScale(kind),
        variant: preset?.variant,
        neckSize: ["diffuser", "returnGrille"].includes(kind) ? (kind === "returnGrille" ? "12" : "8") : undefined,
      },
    };
    setHistory([...drawings, symbol]);
    selectOnly(symbol.id);
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
          lineWeight: activeTool === "supply" || activeTool === "return"
            ? runLineWeights[activeTool]
            : 0.2,
          page: pageNumber,
          cfm: 0,
          cfmSource: "planning-seed",
          systemId: activeSystem,
          elevation: "",
          sizeReviewed: activeTool === "fresh" ? true : false,
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
    if (runs.some(drawingLocked)) {
      setBranchMessage("Unlock both duct layers before joining these runs");
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
    if (event.pointerType === "touch" || event.button !== 0 || panRef.current || touchGestureRef.current) return;
    if (activeEditPointerIdRef.current !== null && activeEditPointerIdRef.current !== event.pointerId) return;
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
        const returnToHelper = scaleHelperReturnPending;
        rememberActiveSheetScale(pageNumber, {
          feetPerUnit: feet / distance,
          label: `Calibrated · ${feet} ft reference`,
          verified: true,
        });
        setCalibrating(false);
        setScaleHelperReturnPending(false);
        setMeasureDraft([]);
        setActiveTool("select");
        setBranchMessage(`Scale calibrated from ${feet} ft · measurements are ready`);
        if (returnToHelper) window.requestAnimationFrame(() => openMarkupAssistant("setup"));
      }
      return;
    }
    if (activeTool === "select") {
      event.currentTarget.setPointerCapture(event.pointerId);
      setSelectionBox({
        start: rawPoint,
        end: rawPoint,
        additive: event.shiftKey,
        pointerId: event.pointerId,
      });
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

  function undoableAssistantRepairRecord(previous = undoStack.at(-1)) {
    if (!previous) return undefined;
    const currentFingerprint = systemDrawingSignatureFor(drawings, activeSystem);
    const previousFingerprint = systemDrawingSignatureFor(previous, activeSystem);
    return [...assistantRepairRecords].reverse().find((record) =>
      record.systemId === activeSystem &&
      !record.reversedAt &&
      record.afterDrawingFingerprint === currentFingerprint &&
      record.beforeDrawingFingerprint === previousFingerprint
    );
  }

  function undo() {
    if (draft.length) {
      setDraft((points) => points.slice(0, -1));
      return;
    }
    const previous = undoStack.at(-1);
    if (!previous) return;
    const reversibleRecord = undoableAssistantRepairRecord(previous);
    if (reversibleRecord) {
      setAssistantRepairRecords((records) => records.map((record) =>
        record.id === reversibleRecord.id
          ? { ...record, reversedAt: new Date().toISOString() }
          : record
      ));
    }
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
    const currentFingerprint = systemDrawingSignatureFor(drawings, activeSystem);
    const nextFingerprint = systemDrawingSignatureFor(next, activeSystem);
    const redoneRecord = [...assistantRepairRecords].reverse().find((record) =>
      record.systemId === activeSystem &&
      Boolean(record.reversedAt) &&
      record.beforeDrawingFingerprint === currentFingerprint &&
      record.afterDrawingFingerprint === nextFingerprint
    );
    if (redoneRecord) {
      setAssistantRepairRecords((records) => records.map((record) =>
        record.id === redoneRecord.id
          ? { ...record, reversedAt: undefined }
          : record
      ));
    }
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
      cfm: upstream.cfm || downstream.cfm || 0,
      cfmSource: upstream.cfmSource || downstream.cfmSource,
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
    if (!selected) return;
    if (drawingLocked(selected)) {
      setBranchMessage("Unlock this HVAC layer before copying the object");
      return;
    }
    if (!selected.symbol && !selected.measurement) {
      setBranchMessage("Copy is limited to icons and measurements so duct connections cannot be duplicated accidentally");
      return;
    }
    clipboardRef.current = structuredClone(selected);
  }

  function pasteDrawing() {
    const copied = clipboardRef.current;
    if (!copied) return;
    if (drawingLocked(copied)) {
      setBranchMessage("Unlock the destination HVAC layer before pasting the object");
      return;
    }
    if (!copied.symbol && !copied.measurement) {
      setBranchMessage("Paste is limited to icons and measurements so duct connections stay intact");
      return;
    }
    const pasted: Drawing = {
      ...structuredClone(copied),
      id: crypto.randomUUID(),
      page: pageNumber,
      points: copied.points.map((point) => ({ x: point.x + 18, y: point.y + 18 })),
      symbol: copied.symbol ? { ...structuredClone(copied.symbol), connectedRunId: undefined, connectedEnd: undefined, returnRunId: undefined, returnEnd: undefined } : undefined,
    };
    setHistory([...drawings, pasted]);
    selectOnly(pasted.id);
    clipboardRef.current = structuredClone(pasted);
  }

  function duplicateSelected() {
    if (selectedIds.length > 1) {
      setBranchMessage("Duplicate one icon or measurement at a time; connected duct networks are protected");
      return;
    }
    const selected = drawings.find((drawing) => drawing.id === selectedId);
    if (!selected) return;
    if (drawingLocked(selected)) {
      setBranchMessage("Unlock this HVAC layer before duplicating the object");
      return;
    }
    if (!selected.symbol && !selected.measurement) {
      setBranchMessage("Duplicate is limited to icons and measurements so duct connections stay intact");
      return;
    }
    const duplicate: Drawing = {
      ...structuredClone(selected),
      id: crypto.randomUUID(),
      page: pageNumber,
      points: selected.points.map((point) => ({ x: point.x + 18, y: point.y + 18 })),
      symbol: selected.symbol ? { ...structuredClone(selected.symbol), connectedRunId: undefined, connectedEnd: undefined, returnRunId: undefined, returnEnd: undefined } : undefined,
    };
    clipboardRef.current = structuredClone(duplicate);
    setHistory([...drawings, duplicate]);
    selectOnly(duplicate.id);
  }

  function mirrorSelectedHorizontal() {
    if (!selectedIds.length) return;
    const directlySelected = drawings.filter((drawing) => selectedIds.includes(drawing.id));
    if (
      directlySelected.length !== selectedIds.length ||
      directlySelected.some((drawing) => !drawing.symbol && !drawing.measurement)
    ) {
      setBranchMessage("Mirror is limited to icons and measurements so duct routing stays intact");
      return;
    }
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
    if (drawingLocked(selected)) {
      setBranchMessage("Unlock this HVAC layer before changing its size");
      return;
    }
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
        if (drawing.id === upstreamId) return { ...drawing, size };
        if (drawing.id === downstreamId) return { ...drawing, size: downstreamSize };
        if (drawing.id === branchId) return { ...drawing, size: branchSize };
        return drawing;
      });
      setHistory(synchronizeFittingSizes(resized, drawings));
    } else {
      const resized = drawings.map((drawing) => drawing.id === selectedId ? {
        ...drawing,
        size,
        sizeReviewed: ["supply", "return"].includes(drawing.type) ? false : drawing.sizeReviewed,
      } : drawing);
      setHistory(synchronizeFittingSizes(resized, drawings, { snapEndpoints: false }));
    }
    setDuctSize(size);
  }

  function orderedRunsForDetail(type?: "supply" | "return") {
    const terminalRunIds = new Set(
      drawings.map(terminalLinkedRunId).filter((id): id is string => Boolean(id))
    );
    return drawings
      .filter((drawing) =>
        drawingSystem(drawing) === activeSystem &&
        !drawing.fitting &&
        !drawing.symbol &&
        terminalRunIds.has(drawing.id) &&
        (type ? drawing.type === type : ["supply", "return"].includes(drawing.type))
      )
      .slice()
      .sort((left, right) =>
        left.page - right.page ||
        (left.points[0]?.y || 0) - (right.points[0]?.y || 0) ||
        (left.points[0]?.x || 0) - (right.points[0]?.x || 0) ||
        left.id.localeCompare(right.id)
      );
  }

  function assignRunNumbers(type: "supply" | "return") {
    const ordered = orderedRunsForDetail(type);
    const prefix = type === "supply" ? "F" : "R";
    const used = new Set(
      ordered
        .map((drawing) => drawing.runNumber?.trim().toUpperCase())
        .filter((value): value is string => Boolean(value))
    );
    let nextNumber = 1;
    let changed = 0;
    const assigned = new Map<string, string>();
    ordered.forEach((drawing) => {
      if (drawing.runNumber?.trim()) return;
      while (used.has(`${prefix}${nextNumber}`)) nextNumber += 1;
      const number = `${prefix}${nextNumber}`;
      used.add(number);
      assigned.set(drawing.id, number);
      changed += 1;
      nextNumber += 1;
    });
    if (!changed) {
      setBranchMessage(`${type === "supply" ? "Flex" : "Return"} run numbers are already filled in`);
      return;
    }
    setHistory(drawings.map((drawing) =>
      assigned.has(drawing.id) ? { ...drawing, runNumber: assigned.get(drawing.id) } : drawing
    ));
    setBranchMessage(`${changed} ${type === "supply" ? "flex" : "return"} run number${changed === 1 ? "" : "s"} added in one Undo`);
  }

  function updateSelectedRunNumber(value: string) {
    if (!selectedRun) return;
    const runNumber = value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 12);
    if ((selectedRun.runNumber || "") === runNumber) return;
    setHistory(drawings.map((drawing) =>
      drawing.id === selectedRun.id ? { ...drawing, runNumber: runNumber || undefined } : drawing
    ));
    setBranchMessage(`${runNumber || "Run number"} saved on the selected ${selectedRun.type} route`);
  }

  function confirmSelectedRunSize() {
    if (!selectedRun || selectedRun.sizeReviewed === true) return;
    setHistory(drawings.map((drawing) =>
      drawing.id === selectedRun.id ? { ...drawing, sizeReviewed: true } : drawing
    ));
    setBranchMessage(`${selectedRun.runNumber ? `${selectedRun.runNumber} · ` : ""}${selectedRun.size}″ size confirmed`);
  }

  function focusNextRunDetail(type?: "supply" | "return") {
    const pending = orderedRunsForDetail(type).filter((drawing) =>
      !drawing.runNumber?.trim() || drawing.sizeReviewed !== true
    );
    if (!pending.length) {
      setBranchMessage(`${type === "return" ? "Return" : type === "supply" ? "Flex" : "Run"} details are complete`);
      return;
    }
    const currentIndex = pending.findIndex((drawing) => drawing.id === selectedId);
    const next = pending[(currentIndex + 1 + pending.length) % pending.length];
    focusDrawingOnPlan(next.id);
    setLeftPanelOpen(true);
    setRightPanelOpen(false);
    setLeftPanelView("properties");
    setBranchMessage(`Review ${next.runNumber || "the next run"} · confirm its number and size`);
  }

  function startSupplyDrawingPass() {
    finishDrawing();
    setActiveTool("supply");
    setSelectedId(null);
    setLeftPanelView("draw");
    openToolsPanel();
    setBranchMessage("Draw the blue system routes first · sizes can be confirmed afterward");
  }

  function startFlexDetailPass() {
    focusNextRunDetail("supply");
  }

  function startReturnDrawingPass() {
    const returnDevices = drawings.filter((drawing) =>
      drawingSystem(drawing) === activeSystem && drawing.symbol?.kind === "returnGrille"
    );
    const returnRuns = orderedRunsForDetail("return");
    finishDrawing();
    if (!returnDevices.length) {
      setSymbolCategory("Return air");
      setActivePresetId("return-standard");
      setActiveTool("returnGrille");
      setLeftPanelView("symbols");
      setBranchMessage("Place the return grille or can, then draw its red route");
    } else if (!returnRuns.length) {
      setActiveTool("return");
      setLeftPanelView("draw");
      setBranchMessage("Draw the red return route from the grille or can to the unit");
    } else {
      focusNextRunDetail("return");
      return;
    }
    setSelectedId(null);
    openToolsPanel();
  }

  function startConnectionRepairPass() {
    if (activeConnectionRepairIssues.length) {
      openMarkupAssistant("fix-plan");
      return;
    }
    setActiveTool("select");
    openToolsPanel();
  }

  function updateRunLineWeight(value: number) {
    const lineWeight = normalizedRunLineWeight(value);
    const selected = drawings.find((drawing) =>
      drawing.id === selectedId &&
      !drawing.fitting &&
      !drawing.symbol &&
      ["supply", "return"].includes(drawing.type)
    );
    const runType = selected?.type === "return"
      ? "return"
      : selected?.type === "supply"
        ? "supply"
        : activeTool === "return" ? "return" : "supply";
    setRunLineWeights((current) => ({ ...current, [runType]: lineWeight }));
    if (!selected) return;
    setHistory(drawings.map((drawing) =>
      drawing.id === selected.id ? { ...drawing, lineWeight } : drawing
    ));
    setBranchMessage(`${selected.type === "return" ? "Return" : "Supply"} run line weight set to ${lineWeight.toFixed(2)} mm · connected T/Y leg matched automatically`);
  }

  function adjustSelectedRunLabelScale(direction: -1 | 1) {
    const selected = drawings.find((drawing) =>
      drawing.id === selectedId &&
      !drawing.fitting &&
      !drawing.symbol &&
      ["supply", "return", "fresh"].includes(drawing.type)
    );
    if (!selected) return;
    if (drawingLocked(selected)) {
      setBranchMessage("Unlock this duct layer before changing its label");
      return;
    }
    const labelScale = stepDuctLabelScale(selected.labelScale, direction);
    if (labelScale === normalizedDuctLabelScale(selected.labelScale)) {
      setBranchMessage(direction < 0
        ? "This duct label is already at its smallest readable size"
        : "This duct label is already at its largest size");
      return;
    }
    setHistory(drawings.map((drawing) =>
      drawing.id === selected.id ? { ...drawing, labelScale } : drawing
    ));
    setBranchMessage(`Duct label ${Math.round(labelScale * 100)}% · route, size, airflow, and connections unchanged`);
  }

  function resetSelectedRunLabel() {
    const selected = drawings.find((drawing) =>
      drawing.id === selectedId &&
      !drawing.fitting &&
      !drawing.symbol &&
      ["supply", "return", "fresh"].includes(drawing.type)
    );
    if (!selected) return;
    if (drawingLocked(selected)) {
      setBranchMessage("Unlock this duct layer before resetting its label");
      return;
    }
    if (!selected.labelOffset && normalizedDuctLabelScale(selected.labelScale) === resetDuctLabelScale()) {
      setBranchMessage("This duct label already uses its default position and size");
      return;
    }
    setHistory(drawings.map((drawing) =>
      drawing.id === selected.id
        ? { ...drawing, labelOffset: undefined, labelScale: resetDuctLabelScale() }
        : drawing
    ));
    setBranchMessage("Duct label position and size reset · route geometry unchanged");
  }

  function updateSelectedCfm(cfm: number) {
    if (!selectedId || !Number.isFinite(cfm)) return;
    setHistory(drawings.map((drawing) => drawing.id === selectedId ? { ...drawing, cfm: Math.max(0, cfm), cfmSource: "manual" } : drawing));
  }

  function updateEquipmentTonnage(tons: number) {
    if (!selectedId || !Number.isFinite(tons)) return;
    setHistory(drawings.map((drawing) => {
      if (drawing.id !== selectedId || drawing.symbol?.kind !== "equipment") return drawing;
      return {
        ...drawing,
        size: `${tons} TON`,
        cfm: isPrimaryAirflowEquipment(drawing) ? Math.round(tons * 400) : drawing.cfm,
        cfmSource: isPrimaryAirflowEquipment(drawing) ? "planning-seed" : drawing.cfmSource,
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
        cfmSource: "planning-seed",
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
    const selected = drawings.find((drawing) => drawing.id === selectedId);
    if (drawingLocked(selected)) {
      setBranchMessage("Unlock this HVAC layer before changing the icon");
      return;
    }
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

  function compactSelectedSymbol() {
    const selected = drawings.find((drawing) => drawing.id === selectedId && drawing.symbol);
    if (!selected?.symbol) return;
    const changes = {
      scaleX: compactSymbolScale(selected.symbol.scaleX, selected.symbol.kind),
      scaleY: compactSymbolScale(selected.symbol.scaleY, selected.symbol.kind),
      labelScale: compactSymbolLabelScale(selected.symbol.labelScale, selected.symbol.kind),
    };
    if (
      selected.symbol.scaleX === changes.scaleX &&
      selected.symbol.scaleY === changes.scaleY &&
      selected.symbol.labelScale === changes.labelScale
    ) {
      setBranchMessage("This icon and label are already at or below the compact sizes");
      return;
    }
    updateSelectedSymbol(changes);
    setBranchMessage("Compact icon and label sizes applied · drag either handle for fine adjustment");
  }

  function adjustSelectedSymbolSize(direction: -1 | 1) {
    const selected = drawings.find((drawing) => drawing.id === selectedId && drawing.symbol);
    if (!selected?.symbol) return;
    updateSelectedSymbol({
      scaleX: stepSymbolScale(selected.symbol.scaleX, direction),
      scaleY: stepSymbolScale(selected.symbol.scaleY, direction),
    });
  }

  function adjustSelectedSymbolLabelSize(direction: -1 | 1) {
    const selected = drawings.find((drawing) => drawing.id === selectedId && drawing.symbol);
    if (!selected?.symbol) return;
    updateSelectedSymbol({
      labelScale: stepSymbolLabelScale(selected.symbol.labelScale, direction),
    });
  }

  function compactPageTerminalSymbols() {
    const terminalKinds = new Set(["diffuser", "returnGrille"]);
    const targets = drawings.filter((drawing) =>
      drawing.page === pageNumber &&
      drawing.symbol &&
      terminalKinds.has(drawing.symbol.kind)
    );
    if (!targets.length) {
      setBranchMessage("No supply or return symbols are on this sheet");
      return;
    }
    let changedCount = 0;
    const next = drawings.map((drawing) => {
      if (
        drawing.page !== pageNumber ||
        !drawing.symbol ||
        !terminalKinds.has(drawing.symbol.kind)
      ) return drawing;
      const scaleX = compactSymbolScale(drawing.symbol.scaleX, drawing.symbol.kind);
      const scaleY = compactSymbolScale(drawing.symbol.scaleY, drawing.symbol.kind);
      const labelScale = compactSymbolLabelScale(drawing.symbol.labelScale, drawing.symbol.kind);
      if (
        drawing.symbol.scaleX === scaleX &&
        drawing.symbol.scaleY === scaleY &&
        drawing.symbol.labelScale === labelScale
      ) return drawing;
      changedCount += 1;
      return {
        ...drawing,
        symbol: {
          ...drawing.symbol,
          scaleX,
          scaleY,
          labelScale,
        },
      };
    });
    if (!changedCount) {
      setBranchMessage("Every supply and return symbol on this sheet is already compact");
      return;
    }
    setHistory(next);
    setBranchMessage(`${changedCount} supply and return symbol${changedCount === 1 ? "" : "s"} compacted on this sheet · one Undo restores them`);
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
      cfmSource: "planning-seed",
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
    dragRef.current = {
      kind: "point",
      drawingId,
      pointIndex,
      before: drawings,
      pointerId: event.pointerId,
      pointerType: event.pointerType,
    };
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
    dragRef.current = {
      kind: "point",
      drawingId,
      pointIndex: segmentIndex + 1,
      before: drawings,
      pointerId: event.pointerId,
      pointerType: event.pointerType,
    };
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
    dragRef.current = {
      kind: "line",
      drawingId: drawing.id,
      start: canvasPoint(event as unknown as PointerEvent<SVGSVGElement>),
      original: drawing.points,
      before: drawings,
      pointerId: event.pointerId,
      pointerType: event.pointerType,
    };
    setSelectedId(drawing.id);
    setActiveSystem(drawingSystem(drawing));
  }

  function startRunLabelDrag(event: PointerEvent<SVGTextElement>, drawing: Drawing) {
    if (activeTool !== "select" || event.button !== 0 || drawingLocked(drawing)) return;
    event.stopPropagation();
    if (!beginEditTransaction(event.pointerId)) return;
    event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId);
    dragRef.current = {
      kind: "label",
      drawingId: drawing.id,
      start: canvasPoint(event as unknown as PointerEvent<SVGSVGElement>),
      originalOffset: drawing.labelOffset || { x: 0, y: 0 },
      before: drawings,
      pointerId: event.pointerId,
      pointerType: event.pointerType,
    };
    selectOnly(drawing.id);
    setActiveSystem(drawingSystem(drawing));
    setBranchMessage("Drag the duct-size label to a clear location");
  }

  function startSymbolLabelDrag(event: PointerEvent<SVGGElement>, drawing: Drawing) {
    if (activeTool !== "select" || !drawing.symbol || event.button !== 0 || drawingLocked(drawing)) return;
    event.stopPropagation();
    if (!beginEditTransaction(event.pointerId)) return;
    event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId);
    dragRef.current = {
      kind: "symbol-label",
      drawingId: drawing.id,
      start: canvasPoint(event as unknown as PointerEvent<SVGSVGElement>),
      originalOffset: clampSymbolLabelOffset(drawing.symbol.labelOffset),
      before: drawings,
      pointerId: event.pointerId,
      pointerType: event.pointerType,
    };
    selectOnly(drawing.id);
    setActiveSystem(drawingSystem(drawing));
    setBranchMessage("Move the label near its icon · the icon stays in place");
  }

  function startSymbolLabelResize(
    event: PointerEvent<SVGGElement>,
    drawing: Drawing,
    anchor: Point,
  ) {
    if (activeTool !== "select" || !drawing.symbol || event.button !== 0 || drawingLocked(drawing)) return;
    event.stopPropagation();
    if (!beginEditTransaction(event.pointerId)) return;
    event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId);
    const raw = canvasPoint(event as unknown as PointerEvent<SVGSVGElement>);
    dragRef.current = {
      kind: "symbol-label-resize",
      drawingId: drawing.id,
      anchor,
      startDistance: Math.max(1, raw.x - anchor.x),
      originalScale: normalizedSymbolLabelScale(drawing.symbol.labelScale),
      before: drawings,
      pointerId: event.pointerId,
      pointerType: event.pointerType,
    };
    selectOnly(drawing.id);
    setActiveSystem(drawingSystem(drawing));
    setBranchMessage("Drag the round label handle to set a readable size");
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
      pointerId: event.pointerId,
      pointerType: event.pointerType,
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
    dragRef.current = {
      kind: "symbol",
      drawingId: drawing.id,
      before: drawings,
      pointerId: event.pointerId,
      pointerType: event.pointerType,
    };
    setSelectedId(drawing.id);
    setActiveSystem(drawingSystem(drawing));
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

  function startSymbolResize(
    event: PointerEvent<SVGGElement>,
    drawing: Drawing,
    cornerX: -1 | 1,
    cornerY: -1 | 1,
  ) {
    if (activeTool !== "select" || !drawing.symbol || event.button !== 0 || drawingLocked(drawing)) return;
    event.stopPropagation();
    if (!beginEditTransaction(event.pointerId)) return;
    event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId);
    const bounds = symbolResizeBounds(drawing);
    dragRef.current = {
      kind: "symbol-resize",
      drawingId: drawing.id,
      center: drawing.points[0],
      rotation: drawing.symbol.rotation,
      halfWidth: bounds.width / 2,
      halfHeight: bounds.height / 2,
      cornerX,
      cornerY,
      before: drawings,
      pointerId: event.pointerId,
      pointerType: event.pointerType,
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
      pointerId: event.pointerId,
      pointerType: event.pointerType,
    };
    setSelectedIds(ids);
    setSelectedId(drawingId);
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    if (panRef.current || touchGestureRef.current || (event.pointerType === "touch" && !dragRef.current)) return;
    const raw = canvasPoint(event);
    const drag = dragRef.current;
    if (drag && drag.pointerId !== event.pointerId) return;
    if (selectionBox && selectionBox.pointerId !== event.pointerId) return;
    if ((drag || selectionBox) && activeEditPointerIdRef.current !== event.pointerId) return;
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
        } else if (drag.kind === "symbol-label") {
          const dx = raw.x - drag.start.x;
          const dy = raw.y - drag.start.y;
          const labelOffset = clampSymbolLabelOffset({
            x: drag.originalOffset.x + dx,
            y: drag.originalOffset.y + dy,
          });
          setDrawings((current) => current.map((drawing) =>
            drawing.id === drag.drawingId && drawing.symbol
              ? { ...drawing, symbol: { ...drawing.symbol, labelOffset } }
              : drawing
          ));
        } else if (drag.kind === "symbol-label-resize") {
          const distance = Math.max(0, raw.x - drag.anchor.x);
          const labelScale = normalizedSymbolLabelScale(
            drag.originalScale * distance / drag.startDistance
          );
          setDrawings((current) => current.map((drawing) =>
            drawing.id === drag.drawingId && drawing.symbol
              ? { ...drawing, symbol: { ...drawing.symbol, labelScale } }
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
          let scaleX = signedCornerScale(localX, drag.cornerX, drag.halfWidth);
          let scaleY = signedCornerScale(localY, drag.cornerY, drag.halfHeight);
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

  function endDrag(event: PointerEvent<SVGSVGElement>, cancelled = false) {
    if (event.pointerType === "touch" && !dragRef.current) return;
    if (activeEditPointerIdRef.current !== null && activeEditPointerIdRef.current !== event.pointerId) return;
    if (selectionBox) {
      if (selectionBox.pointerId !== event.pointerId) return;
      if (cancelled) {
        setSelectionBox(null);
        activeEditPointerIdRef.current = null;
        if (editTransactionRef.current?.pointerId === event.pointerId) editTransactionRef.current = null;
        return;
      }
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
      activeEditPointerIdRef.current = null;
      if (editTransactionRef.current?.pointerId === event.pointerId) editTransactionRef.current = null;
      return;
    }
    const drag = dragRef.current;
    if (!drag) {
      activeEditPointerIdRef.current = null;
      if (editTransactionRef.current?.pointerId === event.pointerId) editTransactionRef.current = null;
      return;
    }
    if (drag.pointerId !== event.pointerId) return;
    if (cancelled) {
      setDrawings(drag.before);
      dragRef.current = null;
      activeEditPointerIdRef.current = null;
      if (editTransactionRef.current?.pointerId === event.pointerId) editTransactionRef.current = null;
      setSnapMarker(null);
      setSnapInfo(null);
      setAlignmentGuides([]);
      return;
    }
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
    } else if (drag.kind === "symbol-label") {
      setBranchMessage("Icon label repositioned · plan geometry was not changed");
    } else if (drag.kind === "symbol-label-resize") {
      setBranchMessage("Icon label size changed · plan geometry was not changed");
    } else if (drag.kind === "label") {
      setBranchMessage("Duct-size label repositioned · route geometry was not changed");
    }
    dragRef.current = null;
    activeEditPointerIdRef.current = null;
    if (editTransactionRef.current?.pointerId === event.pointerId) editTransactionRef.current = null;
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
    const labelOffset = clampSymbolLabelOffset(drawing.symbol.labelOffset);
    const labelScale = normalizedSymbolLabelScale(drawing.symbol.labelScale);
    const labelBox = estimateSymbolLabelBox(displayLabel, labelScale);
    const labelX = labelOffset.x;
    const labelBaselineY = labelPositionY + labelOffset.y;
    const labelCenterY = labelBaselineY - labelBox.height / 2 + 3;
    const labelMoved = Math.hypot(labelOffset.x, labelOffset.y) > 12;
    const visibleHandleSize = 9 / Math.max(.25, zoom);
    const resizeHitRadius = 22 / Math.max(.25, zoom);
    const labelHandleRadius = 6 / Math.max(.25, zoom);
    const labelHitRadius = 22 / Math.max(.25, zoom);
    const directHitRadius = Math.max(
      interactionRadius * Math.max(scaleX, scaleY),
      22 / Math.max(.25, zoom),
    );
    const labelStrokeWidth = Math.max(1.1, 2.6 * labelScale);
    if (variant !== "__legacy") return <g
      className={artworkClass}
      transform={`translate(${center.x} ${center.y})`}
      onPointerDown={preview ? undefined : (event) => startSymbolDrag(event, drawing)}
    >
      <g transform={`rotate(${rotation})`}>
        {!preview && <circle className="symbol-direct-hit" cx="0" cy="0" r={directHitRadius} />}
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
        {selected && !preview && <>
          <rect
            className="symbol-resize-outline"
            x={-resizeBounds.width * scaleX / 2}
            y={-resizeBounds.height * scaleY / 2}
            width={resizeBounds.width * scaleX}
            height={resizeBounds.height * scaleY}
          />
          {([[-1, -1], [1, -1], [1, 1], [-1, 1]] as const).map(([cornerX, cornerY]) => {
            const handleX = cornerX * resizeBounds.width * scaleX / 2;
            const handleY = cornerY * resizeBounds.height * scaleY / 2;
            const cursorClass = cornerX === cornerY
              ? "symbol-resize-corner-nwse"
              : "symbol-resize-corner-nesw";
            return <g
              key={`${cornerX}-${cornerY}`}
              className={cursorClass}
              data-plan-edit-control
              onPointerDown={(event) => startSymbolResize(event, drawing, cornerX, cornerY)}
            >
              <circle
                className="symbol-resize-hit"
                cx={handleX}
                cy={handleY}
                r={resizeHitRadius}
              />
              <rect
                className={`symbol-resize-handle ${cursorClass}`}
                x={handleX - visibleHandleSize / 2}
                y={handleY - visibleHandleSize / 2}
                width={visibleHandleSize}
                height={visibleHandleSize}
                rx={visibleHandleSize * .2}
              />
            </g>;
          })}
        </>}
      </g>
      {labelMoved && <path
        className="symbol-label-leader"
        d={`M 0 0 L ${labelX} ${labelCenterY}`}
      />}
      <g
        className="symbol-label-editor"
        transform={`translate(${labelX} ${labelBaselineY})`}
        data-plan-edit-control
        onPointerDown={preview ? undefined : (event) => startSymbolLabelDrag(event, drawing)}
      >
        <rect
          className="symbol-label-hit"
          x={-labelBox.halfWidth}
          y={-labelBox.height + 3}
          width={labelBox.width}
          height={labelBox.height}
          rx="2"
        />
        {selected && !preview && <rect
          className="symbol-label-outline"
          x={-labelBox.halfWidth}
          y={-labelBox.height + 3}
          width={labelBox.width}
          height={labelBox.height}
          rx="2"
        />}
        <text
          className="symbol-label"
          x="0"
          y="0"
          textAnchor="middle"
          style={{
            fontSize: `${10 * labelScale}px`,
            strokeWidth: `${labelStrokeWidth}px`,
          }}
        >
          {displayLabel}
        </text>
        {selected && !preview && <g
          data-plan-edit-control
          onPointerDown={(event) => startSymbolLabelResize(event, drawing, {
            x: center.x + labelX,
            y: center.y + labelCenterY,
          })}
        >
          <circle
            className="symbol-label-size-hit"
            cx={labelBox.halfWidth}
            cy={-labelBox.height / 2 + 3}
            r={labelHitRadius}
          />
          <circle
            className="symbol-label-size-handle"
            cx={labelBox.halfWidth}
            cy={-labelBox.height / 2 + 3}
            r={labelHandleRadius}
          />
        </g>}
      </g>
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
      if (showDisplaySettings) {
        if (event.key === "Escape") event.preventDefault();
        return;
      }
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
      if (showMarkupAssistant) {
        if (event.key === "Escape") {
          event.preventDefault();
          setShowMarkupAssistant(false);
          setActiveMarkupRecommendation(undefined);
        }
        return;
      }
      if (showPlanIntelligence || showFieldPackageComposer || showSystemBalanceStudio) {
        if (event.key === "Escape") event.preventDefault();
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
      if (target?.closest("input, select, textarea, button, [data-canvas-ui]")) return;
      if (event.key === "Escape") {
        if (calibrating && scaleHelperReturnPending) {
          event.preventDefault();
          cancelPlanScaleCalibration();
          return;
        }
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
  const selectedDrawingLocked = Boolean(selectedDrawing && drawingLocked(selectedDrawing));
  const selectedSelectionHasEditable = selectedIds.some((id) => {
    const drawing = drawings.find((item) => item.id === id);
    return Boolean(drawing && !drawingLocked(drawing));
  });
  const selectedSelectionAllEditable = selectedIds.length > 0 && selectedIds.every((id) => {
    const drawing = drawings.find((item) => item.id === id);
    return Boolean(drawing && !drawingLocked(drawing));
  });
  const selectedFitting = selectedDrawing?.fitting ? selectedDrawing : undefined;
  const selectedRun = selectedDrawing && !selectedDrawing.fitting && ["supply", "return", "fresh"].includes(selectedDrawing.type) ? selectedDrawing : undefined;
  const selectedRunHasLabel = Boolean(
    selectedRun &&
    (
      selectedRun.runNumber?.trim() ||
      selectedRun.sizeReviewed === true ||
      showLengthLabels ||
      showCfmLabels ||
      selectedRun.elevation
    )
  );
  const selectedRunWheelAnchor = selectedRun
    ? [
      ...selectedRun.points,
      ...selectedRun.points.slice(0, -1).map((point, index) => ({
        x: (point.x + selectedRun.points[index + 1].x) / 2,
        y: (point.y + selectedRun.points[index + 1].y) / 2,
      })),
    ].sort((left, right) => {
      const viewportCenter = {
        x: (canvasViewportSize.width / 2 - camera.x) / Math.max(.1, zoom),
        y: (canvasViewportSize.height / 2 - camera.y) / Math.max(.1, zoom),
      };
      return Math.hypot(left.x - viewportCenter.x, left.y - viewportCenter.y) -
        Math.hypot(right.x - viewportCenter.x, right.y - viewportCenter.y);
    })[0]
    : undefined;
  const selectedSymbolWheel = selectedDrawing?.symbol
    && !selectedDrawingLocked
    && selectedDrawing.page === pageNumber
    && selectedIds.length <= 1
    && pdf
    ? positionSymbolActionWheel({
      anchor: {
        x: camera.x + selectedDrawing.points[0].x * zoom,
        y: camera.y + selectedDrawing.points[0].y * zoom,
      },
      viewport: canvasViewportSize,
      objectRadius: (() => {
        const bounds = symbolResizeBounds(selectedDrawing);
        const width = bounds.width * normalizedSymbolScale(selectedDrawing.symbol?.scaleX);
        const height = bounds.height * normalizedSymbolScale(selectedDrawing.symbol?.scaleY);
        return Math.hypot(width, height) / 2;
      })(),
      zoom,
      maxObjectRadiusPx: DEFAULT_SYMBOL_ACTION_WHEEL_OBJECT_RADIUS_CAP_PX,
    })
    : null;
  const selectedSymbolWheelVisible = Boolean(
    selectedDrawing?.symbol && selectedSymbolWheel && !selectedSymbolWheel.hidden
  );
  const selectedRunWheel = selectedRun &&
    !selectedDrawingLocked &&
    selectedRun.page === pageNumber &&
    selectedIds.length <= 1 &&
    pdf &&
    selectedRunWheelAnchor
    ? positionSymbolActionWheel({
      anchor: {
        x: camera.x + selectedRunWheelAnchor.x * zoom,
        y: camera.y + selectedRunWheelAnchor.y * zoom,
      },
      viewport: canvasViewportSize,
      objectRadius: 18,
      zoom,
      maxObjectRadiusPx: DEFAULT_SYMBOL_ACTION_WHEEL_OBJECT_RADIUS_CAP_PX,
    })
    : null;
  const selectedFittingWheel = selectedFitting &&
    !selectedDrawingLocked &&
    selectedFitting.page === pageNumber &&
    selectedIds.length <= 1 &&
    pdf
    ? positionSymbolActionWheel({
      anchor: {
        x: camera.x + selectedFitting.points[0].x * zoom,
        y: camera.y + selectedFitting.points[0].y * zoom,
      },
      viewport: canvasViewportSize,
      objectRadius: 24,
      zoom,
      maxObjectRadiusPx: DEFAULT_SYMBOL_ACTION_WHEEL_OBJECT_RADIUS_CAP_PX,
    })
    : null;
  const selectedRunWheelVisible = Boolean(selectedRunWheel && !selectedRunWheel.hidden);
  const selectedFittingWheelVisible = Boolean(selectedFittingWheel && !selectedFittingWheel.hidden);
  const selectedContextWheelVisible =
    selectedSymbolWheelVisible ||
    selectedRunWheelVisible ||
    selectedFittingWheelVisible;
  const branchTrace = branchNetworkTrace(selectedFitting);
  const branchHealth = branchNetworkConnectionHealth(selectedFitting);
  const branchRepairPreview = branchNetworkRepairPreview(selectedFitting);
  const runTrace = ductNetworkTrace(selectedRun);
  const runAttachment = runAttachmentStatus(selectedRun);
  const symbolTrace = symbolNetworkTrace(selectedDrawing?.symbol ? selectedDrawing : undefined);
  const activeTrace = selectedFitting ? branchTrace : selectedRun ? runTrace : symbolTrace;
  const activeTraceSymbolIds = "symbolIds" in activeTrace ? activeTrace.symbolIds : new Set<string>();
  const activeAirflowSetup = airflowSetupSummary();
  const activeSystemScaleStatus = systemScaleStatus(activeSystem);
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
  const liveDraftCfm = 0;
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
  const planSetupComplete = Boolean(
    activePlanAnalysis &&
    scaleVerified
  );
  const connectionsComplete = Boolean(
    activeBuilderSummary.runs.length &&
    activeAirflowSetup.primaryUnit &&
    !activeBuilderSummary.unconnectedDevices &&
    !activeBuilderSummary.brokenPorts
  );
  const activeSupplyRunsForWorkflow = drawings.filter((drawing) =>
    drawingSystem(drawing) === activeSystem &&
    drawing.type === "supply" &&
    !drawing.fitting &&
    !drawing.symbol
  );
  const activeReturnRunsForWorkflow = drawings.filter((drawing) =>
    drawingSystem(drawing) === activeSystem &&
    drawing.type === "return" &&
    !drawing.fitting &&
    !drawing.symbol
  );
  const activeSupplyDevicesForWorkflow = drawings.filter((drawing) =>
    drawingSystem(drawing) === activeSystem && drawing.symbol?.kind === "diffuser"
  );
  const activeReturnDevicesForWorkflow = drawings.filter((drawing) =>
    drawingSystem(drawing) === activeSystem && drawing.symbol?.kind === "returnGrille"
  );
  const workflowTerminalRunIds = new Set([
    ...activeSupplyDevicesForWorkflow.map(terminalLinkedRunId),
    ...activeReturnDevicesForWorkflow.map(terminalLinkedRunId),
  ].filter((id): id is string => Boolean(id)));
  const drawFirstWorkflow = deriveDrawFirstWorkflow({
    pdfLoaded: Boolean(pdf),
    hasPrimaryUnit: Boolean(activeAirflowSetup.primaryUnit),
    supplyRunCount: activeSupplyRunsForWorkflow.length,
    supplyDeviceCount: activeSupplyDevicesForWorkflow.length,
    pendingSupplyNumbers: activeSupplyRunsForWorkflow.filter((drawing) =>
      workflowTerminalRunIds.has(drawing.id) && !drawing.runNumber?.trim()
    ).length,
    pendingSupplySizes: activeSupplyRunsForWorkflow.filter((drawing) => drawing.sizeReviewed !== true).length,
    returnRunCount: activeReturnRunsForWorkflow.length,
    returnDeviceCount: activeReturnDevicesForWorkflow.length,
    pendingReturnNumbers: activeReturnRunsForWorkflow.filter((drawing) =>
      workflowTerminalRunIds.has(drawing.id) && !drawing.runNumber?.trim()
    ).length,
    pendingReturnSizes: activeReturnRunsForWorkflow.filter((drawing) => drawing.sizeReviewed !== true).length,
    connectionProblems: activeBuilderSummary.unconnectedDevices + activeBuilderSummary.brokenPorts,
    connectionsComplete,
  });
  const drawStepComplete = drawFirstWorkflow.complete;
  const airflowStepComplete = Boolean(
    drawStepComplete &&
    activeAirflowSetup.supplyBalanced &&
    activeAirflowSetup.returnBalanced &&
    !activeBuilderSummary.sizing.length
  );
  const fieldFirstStep = !drawStepComplete
      ? "draw"
      : !airflowStepComplete
        ? "airflow"
        : activeBuilderSummary.audit.counts.critical || activeBuilderSummary.audit.counts.warning
          ? "check"
          : "finish";
  const fieldFirstSteps = [
    {
      id: "draw",
      label: "Draw & Detail",
      detail: drawFirstWorkflow.detail,
      complete: drawStepComplete,
      run: () => {
        if (!pdf) {
          setShowProjectHome(true);
          return;
        }
        if (drawFirstWorkflow.stage === "routes") startSupplyDrawingPass();
        else if (drawFirstWorkflow.stage === "flex-details") startFlexDetailPass();
        else if (drawFirstWorkflow.stage === "returns") startReturnDrawingPass();
        else startConnectionRepairPass();
      },
    },
    {
      id: "airflow",
      label: "Airflow & Sizes",
      detail: airflowStepComplete
        ? "Airflow and sizes checked"
        : "Check CFM and duct sizes",
      complete: airflowStepComplete,
      run: openSystemBalanceStudio,
    },
    {
      id: "check",
      label: "Fix Plan",
      detail: !pdf
        ? "Available after the plan is opened"
        : activeBuilderSummary.audit.counts.critical || activeBuilderSummary.audit.counts.warning
          ? `${activeBuilderSummary.audit.counts.critical + activeBuilderSummary.audit.counts.warning} item${activeBuilderSummary.audit.counts.critical + activeBuilderSummary.audit.counts.warning === 1 ? "" : "s"} need attention`
          : "Plan checks clear",
      complete: Boolean(
        airflowStepComplete &&
        !activeBuilderSummary.audit.counts.critical &&
        !activeBuilderSummary.audit.counts.warning
      ),
      run: () => openMarkupAssistant("fix-plan"),
    },
    {
      id: "finish",
      label: "Materials & Print",
      detail: !pdf
        ? "Available after the plan is opened"
        : activeFieldPackage.gatesClear
          ? "Ready to print or share"
          : "Review materials and printing blockers",
      complete: Boolean(
        airflowStepComplete &&
        !activeBuilderSummary.audit.counts.critical &&
        !activeBuilderSummary.audit.counts.warning &&
        activeFieldPackage.released &&
        !activeFieldPackage.stale
      ),
      run: () => {
        setRightTab("takeoff");
        openInspectorPanel();
      },
    },
  ] as const;
  const activeSmartPlanSetup = buildSmartPlanSetup(activePlanAnalysis);
  const planSetupStep = {
    id: "setup",
    label: "Plan Setup",
    detail: !pdf
      ? "Open a PDF plan"
      : !activePlanAnalysis
        ? "Read the plan information"
        : !scaleVerified
          ? "Confirm the drawing scale"
          : activeSmartPlanSetup?.counts.reviewItems
            ? `${activeSmartPlanSetup.counts.reviewItems} detail${activeSmartPlanSetup.counts.reviewItems === 1 ? "" : "s"} can be reviewed as you work`
            : "Plan information ready",
    complete: planSetupComplete,
    run: () => {
      if (!pdf) {
        setShowProjectHome(true);
        return;
      }
      openAIPlanReader("setup");
    },
  } as const;
  const fieldFirstActiveStep = !planSetupComplete
    ? planSetupStep
    : fieldFirstSteps.find((step) => step.id === fieldFirstStep) || fieldFirstSteps[0];
  const fieldFirstProgress = Math.round(
    [planSetupComplete, ...fieldFirstSteps.map((step) => step.complete)]
      .filter(Boolean).length / 5 * 100
  );
  const assistantSuggestionLayer = buildAssistantSuggestionLayer({
    page: pageNumber,
    scaleVerified: scaleStateForPage(pageNumber).verified,
    smartSetup: activeSmartPlanSetup,
    analysis: activePlanAnalysis,
    sourceFingerprint: pdfFingerprint || activePlanAnalysis?.sourceFingerprint || "",
    activeSystemLabel: systemLabel(activeSystem),
    equipmentAnchors: drawings
      .filter((drawing) =>
        drawing.page === pageNumber &&
        drawingSystem(drawing) === activeSystem &&
        isPrimaryAirflowEquipment(drawing) &&
        drawing.points[0] &&
        renderSize.width > 0 &&
        renderSize.height > 0
      )
      .map((drawing) => ({
        id: drawing.id,
        page: drawing.page,
        label: drawing.symbol?.label || equipmentTypeName(drawing.symbol?.variant),
        point: {
          x: drawing.points[0].x / renderSize.width,
          y: drawing.points[0].y / renderSize.height,
        },
      })),
    existingTerminals: drawings
      .filter((drawing) =>
        drawing.page === pageNumber &&
        drawingSystem(drawing) === activeSystem &&
        ["diffuser", "returnGrille"].includes(drawing.symbol?.kind || "") &&
        drawing.points[0] &&
        renderSize.width > 0 &&
        renderSize.height > 0
      )
      .map((drawing) => ({
        id: drawing.id,
        kind: drawing.symbol?.kind === "returnGrille" ? "return" as const : "supply" as const,
        page: drawing.page,
        roomName: drawing.roomName,
        point: {
          x: drawing.points[0].x / renderSize.width,
          y: drawing.points[0].y / renderSize.height,
        },
      })),
  });
  const assistantBranchOpportunities = branchOpportunities().filter((opportunity) => {
    const run = drawings.find((drawing) => drawing.id === opportunity.mainRunId);
    return run && drawingSystem(run) === activeSystem;
  });
  const assistantTerminalRunIds = new Set(drawings
    .filter((drawing) =>
      drawingSystem(drawing) === activeSystem &&
      ["diffuser", "returnGrille"].includes(drawing.symbol?.kind || "")
    )
    .map(terminalLinkedRunId)
    .filter((id): id is string => Boolean(id)));
  const assistantRunNumberCandidates = buildRunNumberCandidates(drawings
    .filter((drawing) =>
      drawingSystem(drawing) === activeSystem &&
      !drawing.fitting &&
      !drawing.symbol &&
      ["supply", "return"].includes(drawing.type)
    )
    .map((drawing) => ({
      id: drawing.id,
      type: drawing.type as "supply" | "return",
      page: drawing.page,
      size: drawing.size,
      roomName: drawing.roomName,
      runNumber: drawing.runNumber,
      terminalLinked: assistantTerminalRunIds.has(drawing.id),
      firstPoint: drawing.points[0],
    })));
  const markupRecommendations = buildMarkupRecommendations({
    findings: activePlanIntelligenceFindings,
    branchOpportunities: assistantBranchOpportunities,
    sizingCandidateCount: activeBuilderSummary.sizing.length,
    sizingEvidenceFingerprint: stableTextHash(JSON.stringify(activeBuilderSummary.sizing)),
    runNumberCandidateCount: assistantRunNumberCandidates.length,
    runNumberEvidenceFingerprint: stableTextHash(JSON.stringify(assistantRunNumberCandidates)),
    scaleVerified: activeSystemScaleStatus.verified,
    designCfm: activeAirflowSetup.targetCfm,
  });
  const activeFixPlanIssueAnswers: FixPlanIssueAnswer[] = activeReviewedIssueRows.flatMap((row) => {
    const recommendation = markupRecommendations.find((candidate) =>
      candidate.findingId === row.issue.id
    );
    if (!recommendation) return [];
    return [{
      recommendationId: recommendation.id,
      issueId: row.issue.id,
      severity: row.issue.severity,
      status: row.decision?.status,
      reviewer: row.decision?.reviewer,
      note: row.decision?.note,
      updatedAt: row.decision?.updatedAt,
      handledReason: row.decision?.handledReason,
      stale: row.decisionStale,
      resolved: row.resolvedByDecision,
    }];
  });
  const activeDesignStandard = buildDesignStandardProfile({
    systemId: activeSystem,
    evidenceFingerprint: stableTextHash(`${systemDrawingSignature(activeSystem)}|design-standard-v116.0`),
    runs: drawings
      .filter((drawing) =>
        drawingSystem(drawing) === activeSystem &&
        !drawing.fitting &&
        ["supply", "return", "fresh"].includes(drawing.type)
      )
      .map((drawing) => ({
        id: drawing.id,
        type: drawing.type as "supply" | "return" | "fresh",
        size: drawing.size,
        runNumber: drawing.runNumber,
        sizeReviewed: drawing.sizeReviewed,
        terminalLinked: assistantTerminalRunIds.has(drawing.id),
        roomName: drawing.roomName,
        roomType: drawing.roomType,
      })),
    terminals: drawings
      .filter((drawing) =>
        drawingSystem(drawing) === activeSystem &&
        ["diffuser", "returnGrille"].includes(drawing.symbol?.kind || "")
      )
      .map((drawing) => ({
        id: drawing.id,
        kind: drawing.symbol!.kind as "diffuser" | "returnGrille",
        roomName: drawing.roomName,
        roomType: drawing.roomType,
        connected: Boolean(drawing.symbol?.connectedRunId || drawing.symbol?.returnRunId),
      })),
    tyFittingIds: drawings
      .filter((drawing) => drawingSystem(drawing) === activeSystem && drawing.fitting?.kind === "ty")
      .map((drawing) => drawing.id),
    motorDamperIds: drawings
      .filter((drawing) => drawingSystem(drawing) === activeSystem && drawing.symbol?.kind === "motorDamper")
      .map((drawing) => drawing.id),
    residentialFlexMax,
  });
  const markupAssistantSummary = summarizeMarkupAssistant(
    markupRecommendations,
    activePlanIntelligenceFindings,
    activeBuilderSummary.sizing.length,
    assistantBranchOpportunities.length,
  );
  const assistantSizingCandidates = sizingSuggestions();
  const assistantCfmCandidates = terminalCfmProposals();
  const repairEvidenceFingerprint = stableTextHash(JSON.stringify({
    systemId: activeSystem,
    drawingSignature: systemDrawingSignature(activeSystem),
    roomTargets: roomAirflowTargets[activeSystem] || {},
    roomTargetsReviewed: roomAirflowTargetsAreReviewed(),
    sizingVersion: DUCT_SIZING_CALCULATION_VERSION,
    repairVersion: ASSISTANT_REPAIR_VERSION,
    scaleVerified: activeSystemScaleStatus.verified,
    sheetScales: systemSheetScaleSnapshot(activeSystem),
    rules: {
      supplyVelocityLimit,
      returnVelocityLimit,
      freshVelocityLimit,
      residentialFlexMax,
    },
    sizingCandidates: assistantSizingCandidates.map((candidate) => ({
      id: candidate.id,
      current: candidate.current,
      recommended: candidate.recommended,
      cfm: candidate.cfm,
      airflowSource: candidate.airflowSource,
      airflowReviewed: candidate.airflowReviewed,
      airflowEvidence: candidate.airflowEvidence,
      roomTargetReviewFingerprint: candidate.roomTargetReviewFingerprint,
      equipmentRooted: candidate.equipmentRooted,
      applyEligible: candidate.applyEligible,
      overCapacity: candidate.overCapacity,
      reasonCodes: candidate.reasonCodes,
    })),
    findings: activePlanIntelligenceFindings.map((finding) => ({
      id: finding.id,
      evidenceFingerprint: finding.evidenceFingerprint,
      resolved: finding.resolved,
    })),
    branches: assistantBranchOpportunities.map((opportunity) => ({
      id: opportunity.id,
      center: opportunity.center,
      mainRunId: opportunity.mainRunId,
      branchRunId: opportunity.branchRunId,
      style: opportunity.style,
    })),
    runNumbers: assistantRunNumberCandidates.map((candidate) => ({
      drawingId: candidate.drawingId,
      current: candidate.currentRunNumber,
      proposed: candidate.proposedRunNumber,
      duplicate: candidate.duplicateExistingNumber,
      evidenceFingerprint: candidate.evidenceFingerprint,
    })),
  }));
  const assistantRepairPlan = buildRepairPlan({
    systemId: activeSystem,
    evidenceFingerprint: repairEvidenceFingerprint,
    recommendations: markupRecommendations,
    cfmCandidates: assistantCfmCandidates,
    roomTargetsReviewed: roomAirflowTargetsAreReviewed(),
    runNumberCandidates: assistantRunNumberCandidates,
    sizeCandidates: assistantSizingCandidates.map((candidate) => {
      const affectedFittings = drawings.filter((drawing) =>
        drawing.fitting?.connectedIds.includes(candidate.id) &&
        drawingSystem(drawing) === activeSystem
      );
      const affectedFittingChanges: RepairChange[] = affectedFittings.flatMap((drawing) => {
        const fitting = drawing.fitting!;
        const port = fitting.connectedIds.indexOf(candidate.id);
        if (port < 0) return [];
        const currentPortSizes = [
          fitting.upstreamSize,
          fitting.downstreamSize,
          fitting.branchSize,
        ];
        const proposedPortSizes = [...currentPortSizes];
        proposedPortSizes[port] = candidate.recommended;
        const proposedLabel = proposedPortSizes.join("×");
        const portLabels = ["upstream", "downstream", "branch"];
        const changes: RepairChange[] = [];
        if (drawing.size !== proposedLabel) {
          changes.push({
            objectId: drawing.id,
            field: "Fitting size label",
            before: drawing.size,
            after: proposedLabel,
          });
        }
        if (currentPortSizes[port] !== candidate.recommended) {
          changes.push({
            objectId: drawing.id,
            field: `Fitting ${portLabels[port]} size`,
            before: `${currentPortSizes[port]}"`,
            after: `${candidate.recommended}"`,
          });
        }
        return changes;
      });
      return {
        ...candidate,
        type: candidate.type as "supply" | "return" | "fresh",
        affectedFittingIds: affectedFittings.map((drawing) => drawing.id),
        affectedFittingChanges,
        affectedConnectedRunIds: affectedFittings.flatMap((drawing) =>
          drawing.fitting?.connectedIds.filter((id) => {
            const connected = drawings.find((candidateDrawing) => candidateDrawing.id === id);
            return connected && drawingSystem(connected) === activeSystem;
          }) || []
        ),
      };
    }),
    branchCandidates: assistantBranchOpportunities.map((opportunity) => ({
      id: opportunity.id,
      mainRunId: opportunity.mainRunId,
      branchRunId: opportunity.branchRunId,
      style: opportunity.style,
      parentSize: opportunity.parentSize,
      evidenceFingerprint: stableTextHash(JSON.stringify({
        systemId: activeSystem,
        ...opportunity,
      })),
    })),
    scaleVerified: activeSystemScaleStatus.verified,
  });
  const assistantSelectedSizeActions = assistantRepairPlan.actions.filter((action): action is RunSizeRepairAction =>
    action.kind === "run-size" &&
    action.readiness === "ready" &&
    assistantPreparedEvidenceFingerprint === assistantRepairPlan.evidenceFingerprint &&
    assistantPreparedRepairPlanId === assistantRepairPlan.id &&
    assistantSelectedActionIds.includes(action.id)
  );
  const assistantPreviewSizeChanges = new Map(
    assistantSelectedSizeActions.map((action) => [action.drawingId, action.proposedSize]),
  );
  const assistantPreviewResizedDrawings = drawings.map((drawing) =>
    assistantPreviewSizeChanges.has(drawing.id)
      ? { ...drawing, size: assistantPreviewSizeChanges.get(drawing.id)!, sizeReviewed: false }
      : drawing
  );
  const assistantPreviewDrawings = assistantSelectedSizeActions.length
    ? synchronizeFittingSizes(assistantPreviewResizedDrawings, drawings, {
      fittingIds: new Set(assistantSelectedSizeActions.flatMap((action) => action.affectedFittingIds)),
      snapEndpoints: false,
    })
    : drawings;
  const assistantTakeoffRuns = (sourceDrawings: Drawing[]) => sourceDrawings.flatMap((drawing) => {
    if (
      drawingSystem(drawing) !== activeSystem ||
      drawing.fitting ||
      drawing.symbol ||
      !["supply", "return", "fresh"].includes(drawing.type)
    ) return [];
    return [{
      id: drawing.id,
      type: drawing.type as "supply" | "return" | "fresh",
      size: drawing.size,
      measuredLengthFeet: drawingLengthFeet(drawing),
    }];
  });
  const assistantTakeoffImpact = buildTakeoffImpact({
    runs: assistantTakeoffRuns(drawings),
    afterRuns: assistantTakeoffRuns(assistantPreviewDrawings),
    sizeChanges: [],
    wastePercent: materialWastePercent,
    affectedFittingIds: assistantSelectedSizeActions.flatMap((action) => action.affectedFittingIds),
    holds: assistantRepairPlan.actions
      .filter((action) => action.readiness === "needs-input")
      .map((action) => action.blocker || action.title),
  });
  const activeAdvancedPlanIntelligence = buildAdvancedPlanIntelligence(activePlanAnalysis);

  function prepareAssistantRepairPlan() {
    setAssistantPreparedEvidenceFingerprint(assistantRepairPlan.evidenceFingerprint);
    setAssistantPreparedRepairPlanId(assistantRepairPlan.id);
    setAssistantSelectedActionIds(assistantRepairPlan.selectedByDefault);
    setBranchMessage(
      assistantRepairPlan.readyCount
        ? `${assistantRepairPlan.readyCount} evidence-bound repair${assistantRepairPlan.readyCount === 1 ? "" : "s"} prepared · review once, then apply in one Undo`
        : "The repair plan is prepared, but no automatic action is ready yet · review the listed inputs and manual follow-ups",
    );
  }

  async function applyAssistantRepairPlan(input: {
    actionIds: string[];
    evidenceFingerprint: string;
    reviewer: string;
    note: string;
    planningOverrideAcknowledged: boolean;
  }) {
    if (assistantAutonomyMode !== "guided") {
      setBranchMessage("Guided Apply is not active. Zero actions were applied.");
      return false;
    }
    if (!input.reviewer.trim()) {
      setBranchMessage("Enter reviewer initials or a reviewer name before applying this guided batch.");
      return false;
    }
    if (
      input.evidenceFingerprint !== assistantRepairPlan.evidenceFingerprint ||
      assistantPreparedEvidenceFingerprint !== assistantRepairPlan.evidenceFingerprint ||
      assistantPreparedRepairPlanId !== assistantRepairPlan.id
    ) {
      setBranchMessage("The repair plan changed before commit. Zero actions were applied · refresh and review the new evidence.");
      return false;
    }

    const selection = validateRepairSelection(assistantRepairPlan, input.actionIds);
    const actions = selection.actions;
    if (!selection.valid || !actions.length) {
      setBranchMessage(`${selection.reason || "No safe fixes were selected."} Zero actions were applied.`);
      return false;
    }
    const cfmActions = actions.filter((action): action is TerminalCfmRepairAction => action.kind === "terminal-cfm");
    const sizeActions = actions.filter((action): action is RunSizeRepairAction => action.kind === "run-size");
    const runNumberActions = actions.filter((action): action is RunNumberRepairAction => action.kind === "run-number");
    if (sizeActions.some((action) => action.requiresPlanningOverride) && !input.planningOverrideAcknowledged) {
      setBranchMessage("The velocity-only planning override was not acknowledged. Zero size changes were applied.");
      return false;
    }

    const liveCfm = new Map(terminalCfmProposals().map((proposal) => [proposal.drawingId, proposal]));
    const liveSizing = new Map(sizingSuggestions().map((suggestion) => [suggestion.id, suggestion]));
    const liveRunNumbers = new Map(assistantRunNumberCandidates.map((candidate) => [candidate.drawingId, candidate]));
    const allActionsStillMatch = actions.every((action) => {
      if (action.kind === "terminal-cfm") {
        const drawing = drawings.find((candidate) => candidate.id === action.drawingId);
        const proposal = liveCfm.get(action.drawingId);
        return Boolean(
          drawing &&
          proposal &&
          roomAirflowTargetsAreReviewed() &&
          proposal.connected &&
          (drawing.cfm || 0) === action.currentCfm &&
          (drawing.cfmSource || "unset") === action.currentCfmSource &&
          proposal.proposed === action.proposedCfm
        );
      }
      if (action.kind === "run-size") {
        const drawing = drawings.find((candidate) => candidate.id === action.drawingId);
        const suggestion = liveSizing.get(action.drawingId);
        return Boolean(
          drawing &&
          suggestion &&
          drawing.size === action.currentSize &&
          suggestion.recommended === action.proposedSize &&
          suggestion.cfm === action.cfm &&
          suggestion.airflowReviewed &&
          action.airflowReviewed &&
          (action.roomTargetReviewFingerprint || "") === (suggestion.roomTargetReviewFingerprint || "") &&
          suggestion.equipmentRooted &&
          suggestion.applyEligible &&
          !suggestion.overCapacity
        );
      }
      if (action.kind === "run-number") {
        const drawing = drawings.find((candidate) => candidate.id === action.drawingId);
        const candidate = liveRunNumbers.get(action.drawingId);
        return Boolean(
          drawing &&
          candidate &&
          candidate.terminalLinked &&
          !candidate.duplicateExistingNumber &&
          !drawing.runNumber?.trim() &&
          candidate.proposedRunNumber === action.proposedRunNumber &&
          candidate.evidenceFingerprint &&
          action.evidenceFingerprint.includes(candidate.evidenceFingerprint)
        );
      }
      return false;
    });
    if (!allActionsStillMatch) {
      setBranchMessage("The live drawing no longer matches the reviewed object diffs. Zero actions were applied · refresh the repair plan.");
      return false;
    }

    let next = drawings;
    if (cfmActions.length) {
      const changes = new Map(cfmActions.map((action) => [action.drawingId, action.proposedCfm]));
      next = next.map((drawing) => changes.has(drawing.id)
        ? { ...drawing, cfm: changes.get(drawing.id), cfmSource: "room-target" as const }
        : drawing);
    }
    if (sizeActions.length) {
      const changes = new Map(sizeActions.map((action) => [action.drawingId, action.proposedSize]));
      const resized = next.map((drawing) => changes.has(drawing.id)
        ? { ...drawing, size: changes.get(drawing.id)!, sizeReviewed: false }
        : drawing);
      const affectedFittingIds = new Set(sizeActions.flatMap((action) => action.affectedFittingIds));
      next = synchronizeFittingSizes(resized, drawings, {
        fittingIds: affectedFittingIds,
        snapEndpoints: false,
      });
    }
    if (runNumberActions.length) {
      try {
        const activeSystemDrawings = next.filter((drawing) => drawingSystem(drawing) === activeSystem);
        const numberedSystemDrawings = applyRunNumberEdits(activeSystemDrawings, runNumberActions.map((action) => ({
          drawingId: action.drawingId,
          currentRunNumber: action.currentRunNumber,
          proposedRunNumber: action.proposedRunNumber,
          evidenceFingerprint: action.evidenceFingerprint,
        })));
        const numberedById = new Map(numberedSystemDrawings.map((drawing) => [drawing.id, drawing]));
        next = next.map((drawing) => numberedById.get(drawing.id) || drawing);
      } catch {
        setBranchMessage("A run label changed after review. Zero actions were applied - refresh the fix list.");
        return false;
      }
    }
    const beforeById = new Map(drawings.map((drawing) => [drawing.id, JSON.stringify(drawing)]));
    const allowedObjectIds = new Set(actions.flatMap((action) => action.objectIds));
    const changedObjectIds = next
      .filter((drawing) => beforeById.get(drawing.id) !== JSON.stringify(drawing))
      .map((drawing) => drawing.id);
    const outOfScopeChange = changedObjectIds.some((id) => {
      const drawing = next.find((candidate) => candidate.id === id);
      return !allowedObjectIds.has(id) || !drawing || drawingSystem(drawing) !== activeSystem;
    });
    if (outOfScopeChange) {
      setBranchMessage("A fitting synchronization would change an object outside the reviewed batch. Zero actions were applied.");
      return false;
    }
    const mutationActions: RepairMutationAction[] = [];
    actions.forEach((action) => {
      if (action.kind === "terminal-cfm") {
        mutationActions.push({ id: action.id, kind: "terminal-cfm", drawingId: action.drawingId });
      } else if (action.kind === "run-size") {
        mutationActions.push({
          id: action.id,
          kind: "run-size",
          drawingId: action.drawingId,
          affectedFittingIds: action.affectedFittingIds,
        });
      } else if (action.kind === "run-number") {
        mutationActions.push({ id: action.id, kind: "run-number", drawingId: action.drawingId });
      }
    });
    const mutationViolations = validateRepairMutationScope(drawings, next, mutationActions);
    if (mutationViolations.length) {
      setBranchMessage(`An unreviewed ${mutationViolations[0].field} change was detected. Zero actions were applied.`);
      return false;
    }
    if (next === drawings || JSON.stringify(next) === JSON.stringify(drawings)) {
      setBranchMessage("The selected repair plan does not change the current drawing. Zero actions were applied.");
      return false;
    }
    const exactMutationChanges = describeRepairMutationChanges(drawings, next, mutationActions);
    const exactChangesByAction = new Map<string, RepairChange[]>();
    exactMutationChanges.forEach((change) => {
      exactChangesByAction.set(change.actionId, [
        ...(exactChangesByAction.get(change.actionId) || []),
        {
          objectId: change.objectId,
          field: change.field,
          before: change.before,
          after: change.after,
        },
      ]);
    });

    const beforeDrawingFingerprint = systemDrawingSignatureFor(drawings, activeSystem);
    const afterDrawingFingerprint = systemDrawingSignatureFor(next, activeSystem);
    const repairTakeoffRuns = (sourceDrawings: Drawing[]) => sourceDrawings.flatMap((drawing) => {
      if (
        drawingSystem(drawing) !== activeSystem ||
        drawing.fitting ||
        drawing.symbol ||
        !["supply", "return", "fresh"].includes(drawing.type)
      ) return [];
      return [{
        id: drawing.id,
        type: drawing.type as "supply" | "return" | "fresh",
        size: drawing.size,
        measuredLengthFeet: drawingLengthFeet(drawing),
      }];
    });
    const appliedTakeoffImpact = buildTakeoffImpact({
      runs: repairTakeoffRuns(drawings),
      afterRuns: repairTakeoffRuns(next),
      sizeChanges: [],
      wastePercent: materialWastePercent,
      affectedFittingIds: sizeActions.flatMap((action) => action.affectedFittingIds),
    });
    const createdAt = new Date().toISOString();
    const record: RepairBatchRecord = {
      id: `repair-batch-${stableTextHash(`${assistantRepairPlan.id}|${createdAt}|${actions.map((action) => action.id).join("|")}`)}`,
      repairPlanId: assistantRepairPlan.id,
      systemId: activeSystem,
      repairVersion: ASSISTANT_REPAIR_VERSION,
      evidenceFingerprint: assistantRepairPlan.evidenceFingerprint,
      beforeDrawingFingerprint,
      afterDrawingFingerprint,
      autonomyMode: assistantAutonomyMode,
      actionIds: actions.map((action) => action.id),
      actions: actions.map((action) => ({
        id: action.id,
        kind: action.kind,
        title: action.title,
        detail: action.detail,
        problem: action.problem,
        proposedFix: action.proposedFix,
        expectedResult: action.expectedResult,
        objectIds: action.objectIds,
        evidenceFingerprint: action.evidenceFingerprint,
        priority: action.priority,
        stage: action.stage,
        changeScope: action.changeScope,
        geometryChanges: action.geometryChanges,
        changes: exactChangesByAction.get(action.id) || action.changes,
      })),
      takeoffImpact: appliedTakeoffImpact,
      reviewer: input.reviewer,
      note: input.note,
      planningOverrideAcknowledged: input.planningOverrideAcknowledged,
      createdAt,
      cloudSync: workingCloudProjectId ? "pending" : "local",
    };

    setHistory(next);
    setAssistantRepairRecords((current) => [...current, record]);
    setAssistantSelectedActionIds([]);
    setAssistantPreparedEvidenceFingerprint("");
    setAssistantPreparedRepairPlanId("");
    setBranchMessage(
      `${actions.length} reviewed planning change${actions.length === 1 ? "" : "s"} applied in one undoable batch` +
      (sizeActions.length ? ` · ${appliedTakeoffImpact.affectedFittings} fitting port${appliedTakeoffImpact.affectedFittings === 1 ? "" : "s"} synchronized` : "") +
      (workingCloudProjectId ? " · cloud receipt pending" : " · local checkpoint saved"),
    );
    if (workingCloudProjectId) {
      try {
        const cloudBatch = await saveCloudRepairBatch({
          projectId: workingCloudProjectId,
          revisionId: workingCloudRevisionId,
          record,
        });
        setAssistantRepairRecords((current) => current.map((candidate) =>
          candidate.id === record.id
            ? { ...candidate, cloudBatchId: cloudBatch.id, cloudSync: "synced" }
            : candidate
        ));
        setBranchMessage(
          `${actions.length} reviewed planning change${actions.length === 1 ? "" : "s"} applied in one Undo · cloud receipt saved`,
        );
      } catch {
        setBranchMessage(
          `${actions.length} reviewed planning change${actions.length === 1 ? "" : "s"} applied in one Undo · cloud receipt is pending and remains visible locally`,
        );
      }
    }
    return true;
  }

  const activeFieldRuns = activeFieldPackage.runs;
  const modalWorkspaceActive = showProjectHome || showProjectSetup || showPlanIntelligence || showFieldPackageComposer || showSystemBalanceStudio || showDisplaySettings;
  const packagePrintClasses = printPackageSections.map((section) => `package-include-${section}`).join(" ");

  function openAIPlanReader(view: "setup" | "reader" | "findings" = "setup") {
    setPlanWorkspaceInitialView(view);
    setShowPlanIntelligence(false);
    openMarkupAssistant(view === "setup" ? "setup" : "fix-plan");
  }

  function applyDetectedPlanScale(candidate: PlanScaleCandidate, page: number) {
    goToPage(page);
    if (applyResolvedScale(candidate, page)) {
      setBranchMessage(`${candidate.label} confirmed for sheet ${page} · Plan Helper stayed open`);
      return;
    }
    startPlanScaleCalibration(page, candidate.label);
  }

  function startPlanScaleCalibration(page: number, detectedLabel?: string) {
    goToPage(page);
    setShowMarkupAssistant(false);
    setScaleHelperReturnPending(true);
    setCalibrating(true);
    setMeasureDraft([]);
    setActiveTool("measure");
    openToolsPanel();
    setBranchMessage(detectedLabel
      ? `${detectedLabel} was found on the plan · confirm it by picking two points on a known distance`
      : "Pick two points on a known distance to confirm this drawing scale");
  }

  function cancelPlanScaleCalibration() {
    setCalibrating(false);
    setMeasureDraft([]);
    setActiveTool("select");
    const returnToHelper = scaleHelperReturnPending;
    setScaleHelperReturnPending(false);
    if (returnToHelper) window.requestAnimationFrame(() => openMarkupAssistant("setup"));
  }

  function openFieldPackageComposer() {
    setShowCommandPalette(false);
    setShowCloudProjects(false);
    setShowPlanIntelligence(false);
    setShowMarkupAssistant(false);
    setShowProjectHome(false);
    setShowProjectSetup(false);
    setShowFieldPackageComposer(true);
  }

  function openSystemBalanceStudio() {
    setShowCommandPalette(false);
    setShowCloudProjects(false);
    setShowPlanIntelligence(false);
    setShowMarkupAssistant(false);
    setShowFieldPackageComposer(false);
    setShowProjectHome(false);
    setShowProjectSetup(false);
    setSelectedCfmProposalIds([]);
    setSelectedSizingIds([]);
    setShowSystemBalanceStudio(true);
  }

  function openMarkupAssistant(
    initialView: PlanHelperPrimaryView = "fix-plan",
    focusedRecommendation?: MarkupRecommendation,
  ) {
    setShowCommandPalette(false);
    setShowCloudProjects(false);
    setShowPlanIntelligence(false);
    setShowFieldPackageComposer(false);
    setShowSystemBalanceStudio(false);
    setShowProjectHome(false);
    setShowProjectSetup(false);
    setAssistantInitialView(initialView);
    setAssistantFocusedRecommendationId(focusedRecommendation?.id || "");
    setActiveMarkupRecommendation(focusedRecommendation);
    if (!assistantPreparedEvidenceFingerprint && assistantAutonomyMode !== "inspect") {
      setAssistantPreparedEvidenceFingerprint(assistantRepairPlan.evidenceFingerprint);
      setAssistantPreparedRepairPlanId(assistantRepairPlan.id);
      setAssistantSelectedActionIds(assistantRepairPlan.selectedByDefault);
    }
    setShowMarkupAssistant(true);
  }

  function printSelectedFieldPackage(sections: FieldPackageSectionId[]) {
    setPrintPackageSections(sections);
    setShowFieldPackageComposer(false);
    selectOnly(null);
    setActiveReviewIssueId("");
    setPendingBranchFittingId(null);
    setQueuedBranchRunId(null);
    setBranchHoverRunId(null);
    setBranchPreview(null);
    setSnapMarker(null);
    setAlignmentGuides([]);
    window.setTimeout(() => window.print(), 80);
  }

  const projectCommands: ProjectCommand[] = [
    {
      id: "project-home",
      label: "Go to Jobs",
      detail: "Continue this job, open a PDF, or start a new job",
      group: "Project",
      shortcut: "⇧H",
      recommended: true,
      keywords: "home dashboard recent projects onboarding",
      run: () => setShowProjectHome(true),
    },
    {
      id: "project-hub",
      label: "Open saved jobs",
      detail: "Find a job saved on this device or in the cloud",
      group: "Project",
      shortcut: "P",
      keywords: "cloud command center dashboard collaboration",
      run: () => setShowCloudProjects(true),
    },
    {
      id: "continue-work",
      label: fieldFirstActiveStep.label,
      detail: `${systemLabel(activeSystem)} · ${fieldFirstActiveStep.detail}`,
      group: "Project",
      shortcut: "↵",
      recommended: true,
      run: fieldFirstActiveStep.run,
    },
    {
      id: "supply-run",
      label: "Start a supply run",
      detail: `Draw a ${ductSize}" supply route on the active sheet`,
      group: "Draw",
      shortcut: "S",
      recommended: true,
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
      id: "markup-assistant",
      label: "Open Fix Plan",
      detail: `${markupAssistantSummary.open} item${markupAssistantSummary.open === 1 ? "" : "s"} to review · nothing changes until approval`,
      group: "Systems",
      recommended: true,
      keywords: "fix plan plan helper issue repair routing return branch ty recommendation approval",
      run: () => openMarkupAssistant("fix-plan"),
    },
    {
      id: "airflow",
      label: "Check airflow and duct sizes",
      detail: `${activeAirflowSetup.targetCfm || "No"} planning CFM · review paths, room airflow, and sizes`,
      group: "Systems",
      recommended: true,
      keywords: "airflow balancing cfm duct size velocity review v103",
      run: openSystemBalanceStudio,
    },
    {
      id: "ai-plan-reader",
      label: "Review plan setup",
      detail: pdf ? `Find scale, rooms, ceiling heights, equipment, and missing details across ${pdf.numPages} sheet${pdf.numPages === 1 ? "" : "s"}` : "Open a plan PDF to start",
      group: "Review",
      disabled: !pdf,
      keywords: "ai plan reader sheets evidence schedules takeoff v105",
      run: () => openAIPlanReader("setup"),
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
    <main className={`app-shell field-first-workspace layout-${workspaceLayout} density-${workspaceDensity} render-${renderQuality} ${workspaceLayout !== "desktop" ? "tablet-layout" : ""} ${fieldMode ? "field-mode" : ""} ${leftPanelOpen ? "" : "left-closed"} ${rightPanelOpen ? "" : "right-closed"} ${showCloudProjects ? "cloud-open" : ""} ${showProjectHome ? "project-home-open" : ""} ${showPlanIntelligence ? "plan-intelligence-open" : ""} ${showFieldPackageComposer ? "field-package-open" : ""} ${showSystemBalanceStudio ? "system-balance-open" : ""} ${showMarkupAssistant ? "markup-assistant-open" : ""} ${["rooms", "checks"].includes(rightTab) && rightPanelOpen ? "wide-inspector" : ""} ${packagePrintClasses} ${activeFieldPackage.released && !activeFieldPackage.stale ? "package-print-released" : "package-print-draft"}`}>
      <input
        ref={inputRef}
        className="file-input"
        type="file"
        accept="application/pdf,.pdf"
        aria-label="Choose a PDF construction plan"
        onChange={onFileChange}
      />
      <header className="topbar" inert={modalWorkspaceActive ? true : undefined} aria-hidden={modalWorkspaceActive}>
        <button className="brand" onClick={() => setShowProjectHome(true)} aria-label="Open Project Home">
          <div className="brand-mark"><Wind size={23} strokeWidth={2.4} /></div>
          <div>
            <strong>HVAC Plan Studio</strong>
            <span>Plans · markup · materials</span>
          </div>
        </button>

        <div className="project-name">
          <div className="project-breadcrumb">
            <span><HomeIcon size={13} /> Current job</span>
            <i>/</i>
            <strong>{fileName}</strong>
          </div>
          <div className="project-context-row">
            <select className="system-switcher" aria-label="Active HVAC system" value={activeSystem} onChange={(event) => { setActiveSystem(event.target.value); setSelectedId(null); }}>
              {systems.map((system) => <option key={system.id} value={system.id}>{systemLabel(system.id)}</option>)}
            </select>
            <span className={`project-readiness ${workingCloudRevisionId ? "cloud" : "local"}`}>
              <i /> {workingCloudRevisionId ? `Saved version ${cloudProjectRisk?.latestRevisionNumber || "—"}` : "Saved on this device"}
            </span>
          </div>
        </div>

        <nav className="top-actions" aria-label="Project actions">
          <span className={`studio-save-state ${saveState}`}>
            <i /> {saveState === "saving" ? "Saving…" : "Saved"}
          </span>
          <button className="command-button" onClick={() => setShowCommandPalette(true)} title="Search tools · Ctrl/⌘ K">
            <Search size={16} /> <span>Find a tool</span><kbd>⌘K</kbd>
          </button>
          <button className={`cloud-button ${showCloudProjects ? "active" : ""}`} aria-pressed={showCloudProjects} onClick={() => setShowCloudProjects(true)}>
            <Cloud size={16} /> Saved jobs
          </button>
        </nav>
      </header>

      <section className="field-first-guide" aria-label="Job steps" inert={modalWorkspaceActive ? true : undefined} aria-hidden={modalWorkspaceActive}>
        <div className="field-first-next">
          <small>NEXT STEP</small>
          <strong>{fieldFirstActiveStep.detail}</strong>
        </div>
        <nav aria-label="Plan setup and four job steps">
          <button
            className={`field-first-setup ${planSetupComplete ? "complete" : "active"}`}
            aria-current={!planSetupComplete ? "step" : undefined}
            onClick={() => {
              if (!pdf) {
                setShowProjectHome(true);
                return;
              }
              openAIPlanReader("setup");
            }}
          >
            <b>{planSetupComplete ? <CheckCircle2 size={14} /> : <ScanSearch size={14} />}</b>
            <span>
              <strong>Plan setup</strong>
              <small>{!pdf
                ? "Open a plan"
                : !activePlanAnalysis
                  ? "Reading plan information"
                  : !scaleVerified
                    ? "Confirm the drawing scale"
                    : activeSmartPlanSetup?.counts.reviewItems
                      ? `${activeSmartPlanSetup.counts.reviewItems} detail${activeSmartPlanSetup.counts.reviewItems === 1 ? "" : "s"} can be reviewed later`
                      : "Plan information ready"}</small>
            </span>
          </button>
          {fieldFirstSteps.map((step, index) => <button
            key={step.id}
            className={`${planSetupComplete && fieldFirstStep === step.id ? "active" : ""} ${step.complete ? "complete" : ""}`}
            aria-current={planSetupComplete && fieldFirstStep === step.id ? "step" : undefined}
            onClick={step.run}
          >
            <b>{step.complete ? <CheckCircle2 size={14} /> : index + 1}</b>
            <span><strong>{step.label}</strong><small>{step.detail}</small></span>
          </button>)}
        </nav>
        <button className="field-first-primary" onClick={fieldFirstActiveStep.run}>
          Continue <ArrowRight size={16} />
        </button>
      </section>

      <div className="print-package-watermark" aria-hidden="true">DRAFT · NOT ISSUED FOR FIELD</div>
      <section className="print-header" inert={modalWorkspaceActive ? true : undefined} aria-hidden={modalWorkspaceActive}>
        <div>
          <strong>HVAC PLAN STUDIO · FIELD INSTALLATION PLAN</strong>
          <h1>{fileName}</h1>
        </div>
        <dl>
          <div><dt>Sheet</dt><dd>{pageNumber} of {pdf?.numPages || 1}</dd></div>
          <div><dt>Scale</dt><dd>{scaleLabel}</dd></div>
          <div><dt>Airflow</dt><dd>{Math.max(0, ...drawings.filter((drawing) => drawing.type === "supply").map((drawing) => drawing.cfm || 0))} CFM</dd></div>
        </dl>
      </section>

      <section className="workspace" inert={modalWorkspaceActive ? true : undefined} aria-hidden={modalWorkspaceActive}>
        {workspaceLayout !== "desktop" && (leftPanelOpen || rightPanelOpen) && <button
          className="workspace-drawer-scrim"
          aria-label="Close open workspace drawer"
          onClick={() => { setLeftPanelOpen(false); setRightPanelOpen(false); }}
        />}
        <aside id="workspace-tools-panel" className={`left-panel view-${leftPanelView}`} aria-label="HVAC plan tools">
          <div className="panel-heading">
            <div><span>PLAN TOOLS</span><small>CHOOSE ONE GROUP</small></div>
            <button aria-label="Collapse design tools" aria-controls="workspace-tools-panel" aria-expanded={leftPanelOpen} onClick={() => setLeftPanelOpen(false)}><PanelLeftClose size={17} /></button>
          </div>
          <nav className="left-panel-tabs" aria-label="Plan tool groups">
            <button className={leftPanelView === "draw" ? "active" : ""} aria-pressed={leftPanelView === "draw"} onClick={() => setLeftPanelView("draw")}>Draw</button>
            <button className={leftPanelView === "symbols" ? "active" : ""} aria-pressed={leftPanelView === "symbols"} onClick={() => setLeftPanelView("symbols")}>Symbols</button>
            <button className={leftPanelView === "properties" ? "active" : ""} aria-pressed={leftPanelView === "properties"} disabled={!selectedId} onClick={() => setLeftPanelView("properties")}>Selected</button>
          </nav>
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
                <b>{selectedRun ? `SELECTED ${selectedRun.type.toUpperCase()}` : "ADD DURING DETAIL PASS"}</b>
              </div>
              <select
                aria-label={selectedRun ? "Selected run size" : "Default new run size"}
                value={selectedRun?.size || ductSize}
                onChange={(event) => selectedRun ? updateSelectedSize(event.target.value) : setDuctSize(event.target.value)}
              >
                {[...runSizeOptions].reverse().map((size) => <option key={size} value={size}>{size}&quot;</option>)}
              </select>
              <small>{selectedRun ? "Selected runs update immediately." : "Draw first. New supply and return runs stay unlabeled until you confirm a size."}</small>
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
                <button onClick={compactSelectedSymbol}>Compact</button>
                <div className="symbol-size-step-actions" role="group" aria-label="Adjust selected icon size">
                  <button onClick={() => adjustSelectedSymbolSize(-1)}>− Smaller</button>
                  <button onClick={() => adjustSelectedSymbolSize(1)}>Larger +</button>
                </div>
                {["diffuser", "returnGrille"].includes(selectedDrawing.symbol.kind) && <button
                  className="symbol-sheet-compact"
                  onClick={compactPageTerminalSymbols}
                >Compact all supply &amp; return symbols on this sheet</button>}
                <small>Drag a blue corner directly on the icon, or use Smaller for precise steps. Hold Shift to keep the original proportions.</small>
              </div>
              <div className="symbol-resize-control symbol-label-control">
                <div>
                  <span>LABEL POSITION &amp; SIZE</span>
                  <strong>{Math.round(normalizedSymbolLabelScale(selectedDrawing.symbol.labelScale) * 100)}% · {Math.hypot(
                    selectedDrawing.symbol.labelOffset?.x || 0,
                    selectedDrawing.symbol.labelOffset?.y || 0
                  ) > 1 ? "CUSTOM POSITION" : "DEFAULT POSITION"}</strong>
                </div>
                <button onClick={() => updateSelectedSymbol({
                  labelOffset: { x: 0, y: 0 },
                  labelScale: defaultSymbolLabelScale(selectedDrawing.symbol!.kind),
                })}>Reset label</button>
                <div className="symbol-size-step-actions" role="group" aria-label="Adjust selected label size">
                  <button onClick={() => adjustSelectedSymbolLabelSize(-1)}>− Smaller</button>
                  <button onClick={() => adjustSelectedSymbolLabelSize(1)}>Larger +</button>
                </div>
                <small>Drag the label beside the icon. Drag its round handle or use Smaller to resize it without moving the icon.</small>
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
                <button onClick={openSystemBalanceStudio}>Review system balance</button>
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
                  value={selectedRun
                    ? normalizedRunLineWeight(selectedRun.lineWeight)
                    : runLineWeights[activeTool === "return" ? "return" : "supply"]}
                  onChange={(event) => updateRunLineWeight(Number(event.target.value))}
                >
                  <option value="0.1">0.10 mm · Fine</option>
                  <option value="0.2">0.20 mm · Standard</option>
                  <option value="0.3">0.30 mm · Bold</option>
                </select>
                <small>Supply and return only · every connected T/Y leg matches this weight automatically.</small>
              </label>}
              {selectedRun && <div className="engineering-properties">
                {["supply", "return"].includes(selectedRun.type) && <div className={`run-detail-editor ${selectedRun.runNumber && selectedRun.sizeReviewed === true ? "complete" : "attention"}`}>
                  <div className="run-detail-heading">
                    <span>
                      <small>POST-DRAW DETAIL PASS</small>
                      <strong>{selectedRun.type === "supply" ? "Flex number & size" : "Return number & size"}</strong>
                    </span>
                    <b>{selectedRun.runNumber && selectedRun.sizeReviewed === true ? "READY" : "REVIEW"}</b>
                  </div>
                  <div className="run-detail-fields">
                    <label>Run number
                      <input
                        key={`${selectedRun.id}-run-number`}
                        className="property-input"
                        defaultValue={selectedRun.runNumber || ""}
                        placeholder={selectedRun.type === "supply" ? "F1" : "R1"}
                        onBlur={(event) => updateSelectedRunNumber(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") event.currentTarget.blur();
                        }}
                      />
                    </label>
                    <label>Run size
                      <select value={selectedRun.size} onChange={(event) => updateSelectedSize(event.target.value)}>
                        {[...runSizeOptions].reverse().map((size) => <option key={size} value={size}>{size}&quot;</option>)}
                      </select>
                    </label>
                  </div>
                  <div className="run-detail-actions">
                    <button
                      className="primary"
                      disabled={selectedRun.sizeReviewed === true}
                      onClick={confirmSelectedRunSize}
                    >
                      {selectedRun.sizeReviewed === true ? `${selectedRun.size}" confirmed` : `Confirm ${selectedRun.size}" size`}
                    </button>
                    <button onClick={() => focusNextRunDetail(selectedRun.type as "supply" | "return")}>Next unreviewed run</button>
                  </div>
                  <small>The route stays exactly where you drew it. This pass changes only its visible number and reviewed size.</small>
                </div>}
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
                  <div>
                    <span>DUCT LABEL POSITION &amp; SIZE</span>
                    <strong>{selectedRunHasLabel
                      ? `${Math.round(normalizedDuctLabelScale(selectedRun.labelScale) * 100)}% · drag the label directly on the plan`
                      : "Add a run number or confirm the duct size before resizing its label"}</strong>
                  </div>
                  <div className="run-label-size-actions" role="group" aria-label="Resize the selected duct label">
                    <button disabled={!selectedRunHasLabel} onClick={() => adjustSelectedRunLabelScale(-1)}>− Smaller</button>
                    <button disabled={!selectedRunHasLabel} onClick={() => adjustSelectedRunLabelScale(1)}>Larger +</button>
                    <button
                      disabled={!selectedRunHasLabel || (!selectedRun.labelOffset && normalizedDuctLabelScale(selectedRun.labelScale) === resetDuctLabelScale())}
                      onClick={resetSelectedRunLabel}
                    >Reset</button>
                  </div>
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
                  <div><span>Length</span><strong>{scaleStateForPage(selectedRun.page).verified ? `${drawingLengthFeet(selectedRun)} LF` : "SCALE UNVERIFIED"}</strong></div>
                  <div><span>Connected airflow</span><strong>{runAirflow(selectedRun)} CFM</strong></div>
                  <div><span>Velocity</span><strong>{velocityFpm(selectedRun.size, runAirflow(selectedRun))} FPM</strong></div>
                  <div><span>Source</span><strong>{selectedRun.cfmSource === "manual" ? "MANUAL" : airflowNetwork().calculated.get(selectedRun.id) ? "TERMINAL SCHEDULE" : "PLANNING"}</strong></div>
                  <div><span>Friction rate</span><strong>{runPressure(selectedRun).frictionRate.toFixed(2)} /100 FT</strong></div>
                  <div><span>Segment loss</span><strong>{scaleStateForPage(selectedRun.page).verified ? `${runPressure(selectedRun).pressureDrop.toFixed(2)} IN. W.G.` : "SCALE UNVERIFIED"}</strong></div>
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
            {!leftPanelOpen && <button className="panel-restore" aria-controls="workspace-tools-panel" aria-expanded={leftPanelOpen} onClick={openToolsPanel}><PanelLeftClose size={16} /> Tools</button>}
            {workspaceLayout !== "desktop" && <>
              <button className="tablet-quick-action" onClick={() => void openFromDrive()}><HardDrive size={15} /> Drive</button>
              <button className="tablet-quick-action" disabled={!pdf} onClick={() => openAIPlanReader("setup")}><ScanSearch size={15} /> Plan setup</button>
              <button className="tablet-quick-action" disabled={!pdf} onClick={() => openMarkupAssistant("fix-plan")}><Sparkles size={15} /> Fix Plan</button>
            </>}
            <div className="canvas-edit-actions" role="group" aria-label="Edit history">
              <button aria-label="Undo" onClick={undo} disabled={!undoStack.length}><Undo2 size={16} /></button>
              <button aria-label="Redo" onClick={redo} disabled={!redoStack.length}><Redo2 size={16} /></button>
              <button aria-label="Save working copy" onClick={saveProject}><Save size={15} /></button>
            </div>
            <span className="divider" />
            <button onClick={() => setActiveTool("select")}><MousePointer2 size={16} /> {activeTool === "select" ? "Select" : tools.find((tool) => tool.id === activeTool)?.label}</button>
            <span className="divider" />
            <button className={activeTool === "select" ? "active" : ""} aria-label="Pan drawing" title="Right-click and drag anywhere to pan the plan. Left-click stays reserved for drawing and selecting. On tablets, use two fingers to pan or pinch; use a stylus to draw." onClick={() => setActiveTool("select")}><Hand size={16} /> Grab plan</button>
            <button aria-label="Zoom out" onClick={zoomOut} disabled={!pdf}><ZoomOut size={17} /></button>
            <strong>{Math.round(zoom * 100)}%</strong>
            <button aria-label="Zoom in" onClick={zoomIn} disabled={!pdf}><ZoomIn size={17} /></button>
            <button className="view-button" disabled={!pdf} onClick={fitPage} title="Fit the entire sheet in the workspace">Fit</button>
            <button className="view-button" disabled={!pdf} onClick={fitWidth} title="Fit sheet width to the workspace">Width</button>
            <button className="view-button" disabled={!pdf} onClick={() => applyViewportZoom(1)} title="Return to 100% zoom">100%</button>
            <button
              ref={displaySettingsTriggerRef}
              className={`quality-button ${renderQuality === "4k" ? "ultra" : ""}`}
              aria-haspopup="dialog"
              aria-expanded={showDisplaySettings}
              onClick={() => setShowDisplaySettings((visible) => !visible)}
              title="Choose plan rendering quality, including a fixed 8.3 MP 4K canvas"
            >
              <SlidersHorizontal size={15} /> {renderQuality === "4k" ? "4K" : renderQuality === "performance" ? "Fast" : renderQuality === "sharp" ? "Sharp" : "Auto"}
              <span>{renderQualityStatus.megapixels ? `${renderQualityStatus.megapixels.toFixed(1)} MP` : "HD"}</span>
            </button>
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
                {scaleVerified &&
                  !scaleLabel.startsWith("Calibrated") &&
                  !drawingScalePresets.some((preset) => preset === scaleLabel) &&
                  <option value={scaleLabel}>{scaleLabel} · plan recommendation</option>}
                {drawingScalePresets.map((preset) => <option value={preset} key={preset}>{preset}</option>)}
                <option value="custom">Custom calibrated</option>
              </select>
              {calibrating && <input className="reference-input" aria-label="Known distance in feet" type="number" min="1" value={referenceFeet} onChange={(event) => setReferenceFeet(event.target.value)} />}
              <button className={calibrating ? "calibrate active" : "calibrate"} onClick={() => { setCalibrating((value) => !value); setScaleHelperReturnPending(false); setMeasureDraft([]); }}>
                {calibrating ? `${referenceFeet} ft · pick 2 points` : scaleVerified ? "Recalibrate" : "Calibrate"}
              </button>
            </div>
            {!rightPanelOpen && <button className="panel-restore" aria-controls="workspace-inspector-panel" aria-expanded={rightPanelOpen} onClick={openInspectorPanel}>Inspector <PanelRightClose size={16} /></button>}
          </div>

          {calibrating && scaleHelperReturnPending && <div className="scale-calibration-guide" role="status">
            <span><Ruler size={17} /></span>
            <div>
              <strong>Confirm the recommended scale</strong>
              <small>Pick two plan points exactly {referenceFeet} ft apart. Plan Helper will reopen when you finish.</small>
            </div>
            <button onClick={cancelPlanScaleCalibration}>Cancel &amp; return to Plan Helper</button>
          </div>}

          <div
            ref={canvasViewportRef}
            className={`canvas ${pdf ? "has-plan" : ""} ${showGrid ? "" : "grid-hidden"}`}
            onDragOver={(event) => event.preventDefault()}
            onDrop={onDrop}
            onWheel={handleWheelZoom}
            onPointerDownCapture={handleViewportPointerDownCapture}
            onPointerMoveCapture={handleViewportPointerMoveCapture}
            onPointerUpCapture={handleViewportPointerUpCapture}
            onPointerCancelCapture={handleViewportPointerCancelCapture}
            onLostPointerCapture={handleViewportLostPointerCapture}
            onContextMenu={(event) => {
              event.preventDefault();
              if (draft.length) finishDrawing();
            }}
          >
            {selectedId && !selectedContextWheelVisible && <div className="field-context-toolbar" role="toolbar" aria-label="Selected HVAC object actions" data-canvas-ui>
              <strong>{selectedIds.length > 1 ? `${selectedIds.length} OBJECTS` : selectedDrawing?.fitting ? "T/Y FITTING" : selectedDrawing?.symbol ? "HVAC SYMBOL" : selectedDrawing?.measurement ? "MEASUREMENT" : "DUCT RUN"}{selectedDrawingLocked ? " · LAYER LOCKED" : ""}</strong>
              {!selectedDrawingLocked && selectedIds.length === 1 && !selectedDrawing?.symbol && !selectedDrawing?.measurement && <select
                aria-label="Quick duct size"
                value={selectedDrawing?.fitting?.upstreamSize || selectedDrawing?.size || ductSize}
                onChange={(event) => updateSelectedSize(event.target.value)}
              >
                {[...runSizeOptions].reverse().map((size) => <option key={size} value={size}>{size}&quot;</option>)}
              </select>}
              {!selectedDrawingLocked && selectedDrawing?.symbol && <button onClick={() => rotateSelectedSymbol(-15)}>−15°</button>}
              {!selectedDrawingLocked && selectedDrawing?.symbol && <button onClick={() => rotateSelectedSymbol(15)}>+15°</button>}
              {!selectedDrawingLocked && selectedDrawing?.symbol && <button title="Use compact icon and label sizes" onClick={compactSelectedSymbol}><Minimize2 size={15} /> Compact</button>}
              {!selectedDrawingLocked && selectedRun && selectedIds.length === 1 && <button title="Continue drawing from the first endpoint" onClick={() => extendSelectedRun(true)}><Route size={15} /> Extend A</button>}
              {!selectedDrawingLocked && selectedRun && selectedIds.length === 1 && <button title="Continue drawing from the last endpoint" onClick={() => extendSelectedRun(false)}><Route size={15} /> Extend B</button>}
              {!selectedDrawingLocked && selectedRun && selectedIds.length === 1 && <button className={splitMode ? "active" : ""} title="Click the selected run where it should split" onClick={() => { setActiveTool("select"); setSplitMode((enabled) => !enabled); }}><Scissors size={15} /> Split</button>}
              {!selectedDrawingLocked && selectedRun && selectedRunHasLabel && selectedIds.length === 1 && <button title="Make the duct label smaller" onClick={() => adjustSelectedRunLabelScale(-1)}>Label −</button>}
              {!selectedDrawingLocked && selectedRun && selectedRunHasLabel && selectedIds.length === 1 && <button title="Make the duct label larger" onClick={() => adjustSelectedRunLabelScale(1)}>Label +</button>}
              {!selectedDrawingLocked && selectedRun && selectedRunHasLabel && selectedIds.length === 1 && <button title="Reset the duct label position and size" onClick={resetSelectedRunLabel}>Reset label</button>}
              {!selectedDrawingLocked && selectedFitting && selectedIds.length === 1 && <button title="Inspect the fitting ports and connected runs" onClick={() => {
                setRightTab("network");
                openInspectorPanel();
              }}>Connections</button>}
              {!selectedDrawingLocked && selectedFitting && selectedIds.length === 1 && <button title="Edit the fitting properties" onClick={() => {
                setLeftPanelView("properties");
                openToolsPanel();
              }}>Properties</button>}
              {selectedIds.length === 2 && selectedSelectionAllEditable && <button title="Join the two nearest compatible run endpoints" onClick={joinSelectedRuns}><Route size={15} /> Join runs</button>}
              {!selectedDrawingLocked && selectedIds.length === 1 && (selectedDrawing?.symbol || selectedDrawing?.measurement) && <button title="Mirror selection" onClick={mirrorSelectedHorizontal}><FlipHorizontal2 size={15} /> Mirror</button>}
              {!selectedDrawingLocked && selectedIds.length === 1 && (selectedDrawing?.symbol || selectedDrawing?.measurement) && <button title="Duplicate selection" onClick={duplicateSelected}><Copy size={15} /> Duplicate</button>}
              {selectedSelectionHasEditable && <button className="danger" title="Delete selection" onClick={deleteSelected}><Trash2 size={15} /></button>}
              <button title="Clear selection" onClick={() => selectOnly(null)}><X size={15} /></button>
            </div>}
            {selectedDrawing?.symbol && selectedSymbolWheelVisible && selectedSymbolWheel && <SymbolActionWheel
              x={selectedSymbolWheel.center.x}
              y={selectedSymbolWheel.center.y}
              label={selectedDrawing.symbol.label || "HVAC icon"}
              onRotateLeft={() => rotateSelectedSymbol(-15)}
              onRotateRight={() => rotateSelectedSymbol(15)}
              onMirror={mirrorSelectedHorizontal}
              onCompact={compactSelectedSymbol}
              onDuplicate={duplicateSelected}
              onDelete={deleteSelected}
              onClose={() => selectOnly(null)}
            />}
            {selectedRun && selectedRunWheelVisible && selectedRunWheel && <SymbolActionWheel
              variant="run"
              x={selectedRunWheel.center.x}
              y={selectedRunWheel.center.y}
              label={`${selectedRun.size}" ${selectedRun.type} duct`}
              labelAvailable={selectedRunHasLabel}
              splitActive={splitMode}
              onLabelSmaller={() => adjustSelectedRunLabelScale(-1)}
              onLabelLarger={() => adjustSelectedRunLabelScale(1)}
              onResetLabel={resetSelectedRunLabel}
              onExtendA={() => extendSelectedRun(true)}
              onExtendB={() => extendSelectedRun(false)}
              onSplit={() => {
                setActiveTool("select");
                setSplitMode((enabled) => !enabled);
              }}
              onDelete={deleteSelected}
              onClose={() => selectOnly(null)}
            />}
            {selectedFitting && selectedFittingWheelVisible && selectedFittingWheel && <SymbolActionWheel
              variant="fitting"
              x={selectedFittingWheel.center.x}
              y={selectedFittingWheel.center.y}
              label={`${selectedFitting.fitting?.style === "tee90" ? "Tee" : "Wye"} fitting`}
              onInspectConnections={() => {
                setRightTab("network");
                openInspectorPanel();
              }}
              onEditProperties={() => {
                setLeftPanelView("properties");
                openToolsPanel();
              }}
              onDelete={deleteSelected}
              onClose={() => selectOnly(null)}
            />}
            {showAssistantSuggestionLayer && assistantSuggestionLayer.status === "review" && <div
              className="assistant-suggestion-layer-hud"
              role="status"
              aria-live="polite"
              data-canvas-ui
            >
              <span><Eye size={17} /></span>
              <div>
                <strong>Assistant layer · page {pageNumber}</strong>
                <small>{assistantSuggestionLayer.suggestions.length} transparent review zone{assistantSuggestionLayer.suggestions.length === 1 ? "" : "s"} · plan unchanged</small>
              </div>
              <button type="button" onClick={() => openMarkupAssistant("fix-plan")}>Review</button>
              <button type="button" onClick={() => setShowAssistantSuggestionLayer(false)}>Hide</button>
            </div>}
            {draft.length > 0 && ["supply", "return", "fresh"].includes(activeTool) && <div className="live-draft-hud" data-canvas-ui>
              <span>LIVE RUN</span>
              <strong>{ductSize}&quot; · {liveDraftFeet.toFixed(1)} LF</strong>
              <b>{liveDraftCfm} CFM · {liveDraftVelocity} FPM</b>
              <small>Left-click direction · Shift locks angle · Right-click finishes</small>
            </div>}
            {pdf && activeTool === "branch" && <div className={`branch-workflow-hud ${pendingBranchFittingId ? "awaiting-branch" : ""} ${queuedBranchRunId ? "run-armed" : ""} ${branchPlacementResult ? "complete" : ""}`} aria-live="polite" data-canvas-ui>
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
            {pdf && showSheetNavigator && <div className="sheet-navigator" role="dialog" aria-label="PDF sheet navigator" data-canvas-ui>
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
              <div ref={pdfStageRef} className="pdf-stage">
                <div ref={planSheetRef} className="plan-sheet" style={{ width: renderSize.width * zoom, height: renderSize.height * zoom }}>
                  <canvas ref={canvasRef} aria-label={`PDF page ${pageNumber}`} style={{ opacity: backgroundOpacity / 100 }} />
                  <svg
                    className={`drawing-layer tool-${activeTool}`}
                    viewBox={`0 0 ${renderSize.width || 1} ${renderSize.height || 1}`}
                    onPointerDown={handleDrawingClick}
                    onPointerMove={handlePointerMove}
                    onPointerUp={endDrag}
                    onPointerCancel={(event) => endDrag(event, true)}
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
                          if (event.button !== 0 || panRef.current || activeTool !== "select" || drawingLocked(drawing)) return;
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
                      const assistantPreviewClass =
                        showMarkupAssistant &&
                        activeMarkupRecommendation?.preview?.kind === "branch-junction" &&
                        [activeMarkupRecommendation.preview.mainRunId, activeMarkupRecommendation.preview.branchRunId].includes(drawing.id)
                          ? "markup-preview-run"
                          : showMarkupAssistant &&
                            activeMarkupRecommendation?.preview?.kind === "drawing" &&
                            activeMarkupRecommendation.preview.drawingId === drawing.id
                            ? "markup-preview-run"
                            : "";
                      const runSelected = isSelected(drawing.id);
                      const showRunNodeHandles = runSelected || Boolean(branchCandidateClass);
                      const runLabelText = [
                        drawing.runNumber?.trim(),
                        drawing.sizeReviewed === true ? `${drawing.size}"` : "",
                        showLengthLabels ? `${drawingLengthFeet(drawing).toFixed(1)} LF` : "",
                        showCfmLabels ? `${runAirflow(drawing)} CFM${airflowNetwork().calculated.get(drawing.id) ? " AUTO" : ""}` : "",
                        drawing.elevation ? `EL ${drawing.elevation}` : "",
                      ].filter(Boolean).join(" · ");
                      const runLabelScale = normalizedDuctLabelScale(drawing.labelScale);
                      return <g key={drawing.id} className={`${activeTrace.runIds.has(drawing.id) ? "traced-run" : ""} ${runSelected ? "selected-drawing" : ""} ${branchCandidateClass} ${assistantPreviewClass}`.trim()} onPointerDown={(event) => {
                        if (event.button !== 0 || panRef.current || activeTool !== "select" || drawingLocked(drawing)) return;
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
                        {runLabelText && <text
                          className={`run-label ${drawing.labelOffset ? "custom-position" : ""}`}
                          x={runLabelPoint.x}
                          y={runLabelPoint.y}
                          style={{
                            fontSize: `${13 * runLabelScale}px`,
                            strokeWidth: Math.max(2, 4 * runLabelScale),
                          }}
                          onPointerDown={(event) => startRunLabelDrag(event, drawing)}
                        >
                          <title>Drag to reposition this run label</title>
                          {runLabelText}
                        </text>}
                      </g>;
                    })}
                    {showAssistantSuggestionLayer && assistantSuggestionLayer.status === "review" && <g
                      id="assistant-suggestion-layer"
                      className="assistant-suggestion-layer"
                      aria-hidden="true"
                    >
                      {assistantSuggestionLayer.suggestions.map((suggestion) => {
                        const x = suggestion.point.x * renderSize.width;
                        const y = suggestion.point.y * renderSize.height;
                        return <g
                          key={suggestion.id}
                          className={`assistant-review-zone ${suggestion.kind}`}
                          transform={`translate(${x} ${y}) scale(${1 / Math.max(.1, zoom)})`}
                        >
                          <title>{suggestion.label}. {suggestion.explanation}</title>
                          <circle className="assistant-review-zone-fill" cx="0" cy="0" r="34" />
                          <circle className="assistant-review-zone-ring" cx="0" cy="0" r="27" />
                          <path d="M -17 0 L -8 0 M 8 0 L 17 0 M 0 -17 L 0 -8 M 0 8 L 0 17" />
                          <text className="assistant-review-zone-letter" x="0" y="5" textAnchor="middle">
                            {suggestion.kind === "supply" ? "S" : "R"}
                          </text>
                          <text className="assistant-review-zone-label" x="0" y="47" textAnchor="middle">
                            {suggestion.kind === "supply" ? "SUPPLY REVIEW ZONE" : "RETURN-PATH REVIEW ZONE"}
                          </text>
                          <text className="assistant-review-zone-room" x="0" y="60" textAnchor="middle">{suggestion.roomName}</text>
                        </g>;
                      })}
                    </g>}
                    {showMarkupAssistant && activeMarkupRecommendation?.preview && (() => {
                      const preview = activeMarkupRecommendation.preview;
                      if (preview.kind === "branch-junction") {
                        const mainRun = drawings.find((drawing) => drawing.id === preview.mainRunId && drawing.page === pageNumber);
                        const branchRun = drawings.find((drawing) => drawing.id === preview.branchRunId && drawing.page === pageNumber);
                        if (!mainRun || !branchRun) return null;
                        const mainDegrees = preview.angle * 180 / Math.PI;
                        const branchDegrees = preview.branchAngle * 180 / Math.PI;
                        return <g
                          className="markup-suggestion-preview branch"
                          aria-hidden="true"
                          transform={`translate(${preview.point.x} ${preview.point.y}) scale(${1 / Math.max(.1, zoom)})`}
                        >
                          <circle className="markup-preview-halo" cx="0" cy="0" r="24" />
                          <path className="markup-preview-main" d="M -23 0 L 23 0" transform={`rotate(${mainDegrees})`} />
                          <path className="markup-preview-branch" d="M 0 0 L 23 0" transform={`rotate(${branchDegrees})`} />
                          <circle className="markup-preview-port" cx="0" cy="0" r="7" />
                          <text x="0" y="-31" textAnchor="middle">APPROVAL PREVIEW · PLAN UNCHANGED</text>
                        </g>;
                      }
                      const drawing = drawings.find((candidate) => candidate.id === preview.drawingId && candidate.page === pageNumber);
                      if (!drawing) return null;
                      const point = drawing.points[Math.floor(drawing.points.length / 2)] || drawing.points[0];
                      if (!point) return null;
                      return <g
                        className={`markup-suggestion-preview ${drawing.type}`}
                        aria-hidden="true"
                        transform={`translate(${point.x} ${point.y}) scale(${1 / Math.max(.1, zoom)})`}
                      >
                        <circle className="markup-preview-halo" cx="0" cy="0" r="25" />
                        <circle className="markup-preview-target" cx="0" cy="0" r="14" />
                        <path d="M -20 0 L -9 0 M 9 0 L 20 0 M 0 -20 L 0 -9 M 0 9 L 0 20" />
                        <text x="0" y="-31" textAnchor="middle">ASSISTANT PREVIEW</text>
                      </g>;
                    })()}
                    {planEvidenceRegion?.page === pageNumber && (() => {
                      const region = planEvidenceRegion.region;
                      const scaleX = renderSize.width / Math.max(1, region.pageWidth);
                      const scaleY = renderSize.height / Math.max(1, region.pageHeight);
                      const x = region.x * scaleX;
                      const y = region.y * scaleY;
                      const width = Math.max(8, region.width * scaleX);
                      const height = Math.max(8, region.height * scaleY);
                      return <g className="plan-evidence-region" aria-hidden="true">
                        <rect x={x - 4} y={y - 4} width={width + 8} height={height + 8} rx="4" />
                        <text x={x} y={Math.max(14, y - 9)}>SOURCE EVIDENCE · V115</text>
                      </g>;
                    })()}
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
                    {connectionReviewOpen && focusedConnectionRepairItem?.page === pageNumber && (() => {
                      const candidate = focusedConnectionRepairItem.candidate || focusedConnectionRepairItem.candidates[0];
                      if (!candidate) return null;
                      const target = focusedConnectionRepairItem.targetPoint;
                      const midpointX = (candidate.point.x + target.x) / 2;
                      const midpointY = (candidate.point.y + target.y) / 2;
                      const markerScale = 1 / Math.max(.1, zoom);
                      return <g className={`step-one-repair-preview ${focusedConnectionRepairItem.status}`} aria-hidden="true">
                        <path d={`M ${candidate.point.x} ${candidate.point.y} L ${target.x} ${target.y}`} />
                        <circle className="current-end" cx={candidate.point.x} cy={candidate.point.y} r={7 * markerScale} />
                        <circle className="proposed-end" cx={target.x} cy={target.y} r={9 * markerScale} />
                        <g transform={`translate(${midpointX} ${midpointY}) scale(${markerScale})`}>
                          <rect x="-62" y="-27" width="124" height="22" rx="5" />
                          <text x="0" y="-13" textAnchor="middle">{focusedConnectionRepairItem.status === "choice" ? "CHOOSE THIS RUN?" : "REVIEWED ENDPOINT MOVE"}</text>
                        </g>
                      </g>;
                    })()}
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
                      <polyline
                        points={[...draft, ...(hoverPoint ? [hoverPoint] : [])].map((point) => `${point.x},${point.y}`).join(" ")}
                        stroke={drawingColors[activeTool as DrawType]}
                        style={{
                          strokeWidth: runStrokeWidth(
                            activeTool === "supply" || activeTool === "return"
                              ? runLineWeights[activeTool]
                              : 0.2
                          ),
                        }}
                      />
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
                          scaleX: defaultSymbolScale(symbolPreview.kind),
                          scaleY: defaultSymbolScale(symbolPreview.kind),
                          labelScale: defaultSymbolLabelScale(symbolPreview.kind),
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
              <p>{error || "Upload a construction PDF to begin HVAC plan reading, markup, and takeoff."}</p>
              <div className="upload-actions">
                <button className="primary-button" disabled={loading} onClick={() => startDirectLocalPdf("workspace")}><FolderOpen size={17} /> Open PDF and start drawing</button>
                <button className="drive-upload-button" disabled={loading} onClick={() => void openFromDrive()}><HardDrive size={17} /> Open from Drive directly</button>
                <button className="drive-upload-button" disabled={loading} onClick={() => setShowProjectSetup(true)}><ScanSearch size={17} /> Guided setup</button>
              </div>
              <span>or drag and drop a file here</span>
              {driveConfigured === null && <div className="drive-setup-note">Checking Google Drive connection…</div>}
              {driveConfigured === false && <div className="drive-setup-note">Google Drive needs administrator configuration before it can open plans.</div>}
              <div className="file-note"><CircleDot size={13} /> PDF up to 100 MB · Set drawing scale after upload</div>
            </div>}
          </div>
        </section>

        <aside id="workspace-inspector-panel" className="right-panel" aria-label="HVAC plan inspector">
          <div className="right-tabs">
            <div className="right-tablist" role="tablist" aria-label="HVAC workspace panels">
              <button role="tab" aria-selected={rightTab === "builder"} className={rightTab === "builder" ? "active" : ""} onClick={() => setRightTab("builder")}>Current step</button>
              <button role="tab" aria-selected={rightTab === "layers"} className={rightTab === "layers" ? "active" : ""} onClick={() => setRightTab("layers")}>Layers</button>
              <button role="tab" aria-selected={rightTab === "rooms"} className={rightTab === "rooms" ? "active" : ""} onClick={() => openSystemBalanceWorkspace("system")}>Airflow</button>
              <button role="tab" aria-selected={rightTab === "takeoff"} className={rightTab === "takeoff" ? "active" : ""} onClick={() => setRightTab("takeoff")}>Materials</button>
            </div>
            <button type="button" aria-pressed={showMarkupAssistant} className={`right-fix-plan ${showMarkupAssistant ? "active" : ""}`} onClick={() => openMarkupAssistant("fix-plan")}>Fix Plan</button>
            <button className="right-collapse" aria-label="Collapse inspector" aria-controls="workspace-inspector-panel" aria-expanded={rightPanelOpen} onClick={() => setRightPanelOpen(false)}><PanelRightClose size={15} /></button>
          </div>
          {rightTab === "builder" ? <div className="system-builder-panel">
            <div className="builder-hero">
              <div className="builder-hero-heading">
                <span><Sparkles size={17} /></span>
                <div><strong>CURRENT JOB STEP</strong><small>{systemLabel(activeSystem)} · one clear action at a time</small></div>
                <b>{fieldFirstProgress}%</b>
              </div>
              <div className="builder-progress"><i style={{ width: `${fieldFirstProgress}%` }} /></div>
            </div>

            {!planSetupComplete && <div className="smart-plan-preflight">
              <header>
                <span>
                  <strong>{activeSmartPlanSetup && scaleVerified && !activeSmartPlanSetup.counts.requiredReviewItems ? "PLAN SETUP READY" : "PLAN SETUP"}</strong>
                  <small>{!pdf
                    ? "Open a PDF to find its scale, rooms, ceiling heights, equipment, and systems."
                    : !activeSmartPlanSetup
                      ? "Reading the plan in the background. You can keep working."
                      : activeSmartPlanSetup.summary.detail}</small>
                </span>
                {activeSmartPlanSetup && <b>{activeSmartPlanSetup.counts.reviewItems}</b>}
              </header>
              <dl>
                <div><dt>Scale</dt><dd>{scaleVerified ? scaleLabel : activeSmartPlanSetup?.counts.likelyScales || activeSmartPlanSetup?.counts.verifiedScales ? "Found · confirm it" : "Needs review"}</dd></div>
                <div><dt>Rooms &amp; heights</dt><dd>{activeSmartPlanSetup ? `${activeSmartPlanSetup.counts.rooms} rooms · ${activeSmartPlanSetup.counts.roomHeights} heights` : "Reading…"}</dd></div>
                <div><dt>Equipment</dt><dd>{activeSmartPlanSetup ? `${activeSmartPlanSetup.counts.equipment} units · ${activeSmartPlanSetup.counts.systems} systems` : "Reading…"}</dd></div>
                <div><dt>Needs your review</dt><dd>{activeSmartPlanSetup ? `${activeSmartPlanSetup.counts.reviewItems} details` : "Checking…"}</dd></div>
              </dl>
              <div className="smart-plan-preflight-actions">
                <button disabled={!pdf} onClick={() => openAIPlanReader("setup")}>
                  {activeSmartPlanSetup?.counts.reviewItems
                    ? `Review ${activeSmartPlanSetup.counts.reviewItems} detail${activeSmartPlanSetup.counts.reviewItems === 1 ? "" : "s"}`
                    : activeSmartPlanSetup
                      ? "Review plan information"
                      : "Open plan setup"}
                </button>
              </div>
            </div>}

            <div className="builder-workflow">
              <div className={`builder-action-card connection-repair-card draw-first-card ${planSetupComplete && fieldFirstStep === "draw" ? "current" : "other-step"} ${drawStepComplete ? "complete" : "attention"}`}>
                <div className="builder-action-icon"><Route size={17} /></div>
                <span><i>STEP 1</i><strong>Draw the system first</strong><small>Draw the blue routes first. Then add flex numbers and reviewed sizes, place the red returns, and finish with connection repair.</small></span>
                <div className="draw-first-pass" aria-label="Draw-first detail sequence">
                  <div className={drawFirstWorkflow.stage === "routes" ? "active" : activeSupplyRunsForWorkflow.length && activeSupplyDevicesForWorkflow.length && activeAirflowSetup.primaryUnit ? "complete" : ""}>
                    <b>1</b><span><strong>Draw routes</strong><small>{activeSupplyRunsForWorkflow.length} blue runs · {activeSupplyDevicesForWorkflow.length} cans</small></span>
                  </div>
                  <div className={drawFirstWorkflow.stage === "flex-details" ? "active" : drawFirstWorkflow.stage === "returns" || drawFirstWorkflow.stage === "connections" || drawFirstWorkflow.stage === "complete" ? "complete" : ""}>
                    <b>2</b><span><strong>Flex details</strong><small>Numbers and reviewed sizes</small></span>
                  </div>
                  <div className={drawFirstWorkflow.stage === "returns" ? "active" : drawFirstWorkflow.stage === "connections" || drawFirstWorkflow.stage === "complete" ? "complete" : ""}>
                    <b>3</b><span><strong>Add returns</strong><small>{activeReturnRunsForWorkflow.length} red runs · {activeReturnDevicesForWorkflow.length} grilles</small></span>
                  </div>
                  <div className={drawFirstWorkflow.stage === "connections" ? "active" : drawFirstWorkflow.stage === "complete" ? "complete" : ""}>
                    <b>4</b><span><strong>Connect &amp; repair</strong><small>Equipment, cans, and T/Y ports</small></span>
                  </div>
                </div>
                <div className="draw-first-actions">
                  {drawFirstWorkflow.stage === "routes" && <button className="builder-primary-action" onClick={startSupplyDrawingPass}>Start drawing blue routes</button>}
                  {drawFirstWorkflow.stage === "flex-details" && <>
                    <button onClick={() => assignRunNumbers("supply")}>Number flex runs</button>
                    <button className="builder-primary-action" onClick={startFlexDetailPass}>Review next flex size</button>
                  </>}
                  {drawFirstWorkflow.stage === "returns" && <>
                    <button className="builder-primary-action" onClick={startReturnDrawingPass}>{activeReturnDevicesForWorkflow.length ? activeReturnRunsForWorkflow.length ? "Review return details" : "Draw return routes" : "Place return grille"}</button>
                    {activeReturnRunsForWorkflow.length > 0 && <button onClick={() => assignRunNumbers("return")}>Number return runs</button>}
                  </>}
                </div>
                {(drawFirstWorkflow.stage === "connections" || connectionReviewOpen || drawStepComplete) && <>
                <div className="connection-repair-summary">
                  <b className="ready">{activeConnectionRepairPlan.counts.ready} can connect</b>
                  <b className="choice">{activeConnectionRepairPlan.counts.choice} need your choice</b>
                  <b className="blocked">{activeConnectionRepairPlan.counts.blocked} need a manual check</b>
                  <b className="healthy">{activeConnectionRepairPlan.counts.healthy} already connected</b>
                </div>
                {!showLegacyConnectionRepairPanel ? <button
                  className="builder-primary-action connection-review-launch"
                  disabled={!activeConnectionRepairIssues.length}
                  onClick={() => {
                    startConnectionRepairPass();
                  }}
                >
                  {activeConnectionRepairIssues.length
                    ? `Open ${activeConnectionRepairIssues.length} connection fix${activeConnectionRepairIssues.length === 1 ? "" : "es"} in Fix Plan`
                    : "All saved connections are aligned"}
                </button> : <div className="connection-repair-review">
                  <div className="connection-review-heading">
                    <div>
                      <strong>Connection review</strong>
                      <small>Red is the loose run end. Green is where it will connect.</small>
                    </div>
                    <button onClick={() => setConnectionReviewOpen(false)} aria-label="Close connection review"><X size={15} /></button>
                  </div>

                  {connectionReviewStale && <div className="connection-review-stale">
                    <AlertTriangle size={15} />
                    <span><strong>The plan changed</strong><small>Refresh this review before selecting or applying fixes.</small></span>
                    <button onClick={refreshConnectionRepairReview}>Refresh</button>
                  </div>}

                  <div className="connection-repair-list">
                    {activeConnectionRepairIssues.map((item) => {
                      const selected = selectedReadyConnectionRepairIds.includes(item.id);
                      const distanceLabel = connectionRepairDistance(item);
                      return <article className={`connection-repair-row ${item.status} ${focusedConnectionRepairId === item.id ? "focused" : ""}`} key={item.id}>
                        <button className="connection-repair-focus" onClick={() => focusConnectionRepair(item)}>
                          <span className="connection-repair-state" aria-hidden="true">
                            {item.status === "ready" ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                          </span>
                          <span>
                            <strong>{item.label}</strong>
                            <small>{item.detail} · Sheet {item.page}</small>
                            <em>{item.reason}{distanceLabel ? ` · ${distanceLabel}` : ""}</em>
                          </span>
                          <b>{item.status === "ready" ? "READY" : item.status === "choice" ? "CHOOSE A RUN" : "CHECK ON PLAN"}</b>
                        </button>

                        {item.status === "choice" && <div className="connection-candidate-choices">
                          {item.candidates.map((candidate) => <button
                            className={connectionCandidateChoices[item.id] === candidate.id ? "selected" : ""}
                            key={candidate.id}
                            disabled={connectionReviewStale}
                            aria-pressed={connectionCandidateChoices[item.id] === candidate.id}
                            onClick={() => chooseConnectionCandidate(item, candidate.id)}
                          >
                            Use {candidate.runSize}&quot; run · {candidate.end} end · {connectionRepairDistanceValue(candidate.distance, item.page)}
                            <small>{candidate.signals.join(" · ")}</small>
                          </button>)}
                        </div>}

                        <div className="connection-repair-row-actions">
                          <button onClick={() => focusConnectionRepair(item)}>Show on plan</button>
                          {item.status === "ready" && <button
                            className={selected ? "selected" : ""}
                            disabled={connectionReviewStale}
                            aria-pressed={selected}
                            onClick={() => toggleConnectionRepair(item)}
                          >
                            {selected ? "Selected" : "Add this fix"}
                          </button>}
                        </div>
                      </article>;
                    })}
                    {!activeConnectionRepairIssues.length && <div className="connection-review-clear">
                      <CheckCircle2 size={18} />
                      <span><strong>No loose saved connections</strong><small>Every unit connection, can, grille, and saved T/Y port is aligned.</small></span>
                    </div>}
                  </div>

                  <div className="connection-repair-scope">
                    <span><strong>{selectedReadyConnectionRepairIds.length}</strong> run endpoint{selectedReadyConnectionRepairIds.length === 1 ? "" : "s"} will move</span>
                    <span><strong>0</strong> placed objects move</span>
                    <span><strong>0</strong> runs created</span>
                  </div>
                  <div className="connection-repair-footer">
                    <button
                      disabled={connectionReviewStale || !activeConnectionRepairPlan.counts.ready}
                      onClick={selectAllReadyConnectionRepairs}
                    >Select ready fixes</button>
                    <button
                      className="apply"
                      disabled={connectionReviewStale || !selectedReadyConnectionRepairIds.length}
                      onClick={applySelectedConnectionRepairs}
                    >
                      Apply {selectedReadyConnectionRepairIds.length} selected · one Undo
                    </button>
                  </div>
                </div>}</>}
              </div>

              <div className={`builder-action-card ${planSetupComplete && fieldFirstStep === "airflow" ? "current" : "other-step"} ${airflowStepComplete ? "complete" : "attention"}`}>
                <div className="builder-action-icon"><Gauge size={17} /></div>
                <span><i>STEP 2</i><strong>Calculate CFM &amp; review duct sizes</strong><small>Propagates reviewed terminal airflow through continuous T/Y paths and prepares velocity-screened candidates using your limits and 16″ residential maximum.</small></span>
                <div className={`system-airflow-setup ${!activeAirflowSetup.primaryUnit ? "missing-unit" : ""}`}>
                  <div className="airflow-setup-heading">
                    <span><Wind size={15} /><strong>SYSTEM AIRFLOW SETUP</strong></span>
                    <b>{activeAirflowSetup.primaryUnit ? `${activeAirflowSetup.targetCfm} CFM` : "UNIT REQUIRED"}</b>
                  </div>
                  <label>Planning airflow · editable 400 CFM per ton
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
                        <span>Return vs planning baseline</span>
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
                  <button disabled={!activeAirflowSetup.primaryUnit} onClick={openSystemBalanceStudio}>Open Balance Studio</button>
                  <button disabled={!activeBuilderSummary.runs.length} onClick={openSystemSizingWorkflow}>Review duct sizes</button>
                </div>
              </div>

              <div className={`builder-action-card ${planSetupComplete && fieldFirstStep === "check" ? "current" : "other-step"} ${activeBuilderSummary.audit.counts.critical ? "critical" : activeBuilderSummary.audit.counts.warning ? "attention" : "complete"}`}>
                <div className="builder-action-icon"><ShieldAlert size={17} /></div>
                <span><i>STEP 3</i><strong>Fix Plan</strong><small>Review disconnected cans, airflow balance, velocity, size progression, return paths, elevations, fresh air, controls, and accidental zone connections one item at a time.</small></span>
                <div className="builder-audit-strip">
                  <b>{activeBuilderSummary.audit.score} score</b>
                  <span>{activeBuilderSummary.audit.counts.critical} critical</span>
                  <span>{activeBuilderSummary.audit.counts.warning} warnings</span>
                </div>
                <button className="builder-primary-action" onClick={openSystemAuditWorkflow}>Open Fix Plan</button>
              </div>

              <div className={`builder-action-card ${planSetupComplete && fieldFirstStep === "finish" ? "current" : "other-step"} ${activeBuilderSummary.packageSummary.ready ? "complete" : "attention"}`}>
                <div className="builder-action-icon"><FileText size={17} /></div>
                <span><i>STEP 4</i><strong>Materials &amp; Print</strong><small>Review run quantities, air devices, fitting counts, material allowances, and printing blockers before exporting.</small></span>
                <div className="builder-action-buttons">
                  <button onClick={() => setRightTab("takeoff")}>Open takeoff</button>
                </div>
              </div>
            </div>
            <div className="builder-safety-note"><ShieldAlert size={13} /><span><strong>You stay in control.</strong> The assistant can prepare reviewed CFM and connected-network size changes, but applies only a selected, fingerprint-bound batch after final confirmation. No silent rerouting, unit moves, cross-zone connections, branch stubs, or balancing dampers.</span></div>
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
                <div><dt>Total duct length</dt><dd>{activeSystemScaleStatus.verified ? `${drawings.filter((drawing) => ["supply", "return", "fresh"].includes(drawing.type) && drawingSystem(drawing) === activeSystem).reduce((total, drawing) => total + drawingLengthFeet(drawing), 0).toFixed(1)} LF` : activeSystemScaleStatus.detail}</dd></div>
                <div><dt>System airflow</dt><dd>{Math.max(0, ...drawings.filter((drawing) => drawing.type === "supply" && drawingSystem(drawing) === activeSystem).map((drawing) => runAirflow(drawing)))} CFM</dd></div>
                <div><dt>Continuous terminals</dt><dd>{drawings.filter((drawing) => ["diffuser", "returnGrille"].includes(drawing.symbol?.kind || "") && drawingSystem(drawing) === activeSystem && airflowNetwork().rootedTerminalRun.has(drawing.id)).length}</dd></div>
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
                {activeAirflowSetup.targetCfm ? activeAirflowSetup.supplyBalanced && activeAirflowSetup.returnBalanced ? "SCHEDULE ALIGNED" : "REVIEW" : "NO UNIT"}
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
                <div><small>PLANNING AIRFLOW</small><strong>{activeAirflowSetup.targetCfm} CFM</strong><p>{activeAirflowSetup.equipment.length} indoor airflow source{activeAirflowSetup.equipment.length === 1 ? "" : "s"} · editable 400 CFM/ton starting value</p></div>
                <button disabled={!activeAirflowSetup.primaryUnit} onClick={() => { setSelectedId(activeAirflowSetup.primaryUnit?.id || null); setActiveTool("select"); }}>Select unit</button>
              </div>
              <div className="balance-system-grid">
                <div className={activeAirflowSetup.supplyBalanced ? "good" : "attention"}><span>Supply scheduled</span><strong>{activeAirflowSetup.supplyCfm}</strong><small>{activeAirflowSetup.supplyGap > 0 ? `${activeAirflowSetup.supplyGap} remaining` : activeAirflowSetup.supplyGap < 0 ? `${Math.abs(activeAirflowSetup.supplyGap)} over` : "Target matched"}</small></div>
                <div className={activeAirflowSetup.returnBalanced ? "good" : "attention"}><span>Return vs planning baseline</span><strong>{activeAirflowSetup.returnCfm}</strong><small>{activeAirflowSetup.returnGap > 0 ? `${activeAirflowSetup.returnGap} remaining` : activeAirflowSetup.returnGap < 0 ? `${Math.abs(activeAirflowSetup.returnGap)} over` : "Baseline matched"}</small></div>
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
                    <div><span>Return vs planning baseline</span><strong>{row.returnCfm} CFM</strong></div>
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
              <div className="balance-workspace-note">System return is shown once against the planning-airflow baseline, not as a verified return design. A return is never assigned to an individual unit unless you explicitly separate it into another system.</div>
            </> : balanceView === "rooms" ? <>
              <div className="balance-toolbar">
                <button disabled={!roomSchedule().length || !activeAirflowSetup.targetCfm} onClick={recalculateRoomAirflowTargets}><Sparkles size={12} /> Recalculate targets</button>
                <button disabled={!roomSchedule().length} onClick={saveReviewedRoomAirflowTargets}><CheckCircle2 size={12} /> Save reviewed targets</button>
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
                  const connectedIds = room.drawingIds.filter((id) => airflowNetwork().rootedTerminalRun.has(id));
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
                <div className="cfm-review-heading"><span><strong>{roomAirflowTargetsAreReviewed() ? "REVIEWED-TARGET CFM CHANGES" : "DRAFT CFM CHANGES"}</strong><small>{roomAirflowTargetsAreReviewed() ? "Continuous paths only · still not a room-load calculation" : "Review and save targets before applying"}</small></span><b>{selectedCfmProposalIds.length}/{terminalCfmProposals().length}</b></div>
                <div className="cfm-review-actions">
                  <button disabled={!roomAirflowTargetsAreReviewed() || !terminalCfmProposals().some((proposal) => proposal.connected)} onClick={() => setSelectedCfmProposalIds(terminalCfmProposals().filter((proposal) => proposal.connected).map((proposal) => proposal.id))}>Select continuous</button>
                  <button disabled={!selectedCfmProposalIds.length} onClick={() => setSelectedCfmProposalIds([])}>Clear</button>
                </div>
                {terminalCfmProposals().length ? <div className="cfm-proposal-list">
                  {terminalCfmProposals().map((proposal) => <div className={!proposal.connected ? "disconnected" : ""} key={proposal.id}>
                    <input aria-label={`Approve ${proposal.room} ${proposal.label} CFM change`} type="checkbox" disabled={!roomAirflowTargetsAreReviewed() || !proposal.connected} checked={selectedCfmProposalIds.includes(proposal.id)} onChange={() => setSelectedCfmProposalIds((current) => current.includes(proposal.id) ? current.filter((id) => id !== proposal.id) : [...current, proposal.id])} />
                    <button onClick={() => { setSelectedId(proposal.drawingId); setActiveTool("select"); }}>
                      <span><strong>{proposal.room} · {proposal.kind}</strong><small>{proposal.label} · {proposal.connected ? "connected" : "connect before release"}</small></span>
                      <b>{proposal.current} → {proposal.proposed}</b>
                    </button>
                  </div>)}
                </div> : <div className="cfm-review-clear"><CheckCircle2 size={16} /> Scheduled terminal CFM matches the room targets.</div>}
                <button className="apply-cfm-proposals" disabled={!roomAirflowTargetsAreReviewed() || !selectedCfmProposalIds.length} onClick={applySelectedCfmProposals}>Apply {selectedCfmProposalIds.length} reviewed CFM change{selectedCfmProposalIds.length === 1 ? "" : "s"} · one Undo</button>
              </div>
              <div className="balance-workspace-note">Targets are coordination values you can edit. Final room airflow still requires load review, equipment data, field balancing, and your approval.</div>
            </> : <>
              <div className="balance-toolbar">
                <button disabled={!sizingSuggestions().some((suggestion) => suggestion.applyEligible && suggestion.airflowReviewed && !suggestion.overCapacity)} onClick={() => setSelectedSizingIds(sizingSuggestions().filter((suggestion) => suggestion.applyEligible && suggestion.airflowReviewed && !suggestion.overCapacity).map((suggestion) => suggestion.id))}>Select velocity-screened sizes</button>
                <button disabled={!selectedSizingIds.length} onClick={() => setSelectedSizingIds([])}>Clear</button>
              </div>
              <div className="run-review-rules">
                <span><b>{residentialFlexMax}″</b> maximum residential flex</span>
                <span><b>{supplyVelocityLimit}</b> supply FPM limit</span>
                <span><b>{returnVelocityLimit}</b> return FPM limit</span>
              </div>
              {sizingSuggestions().length ? <div className="balance-run-list">
                {sizingSuggestions().map((suggestion) => <div className={`balance-run-row ${suggestion.overCapacity ? "over-capacity" : ""}`} key={suggestion.id}>
                  <input aria-label={`Approve ${suggestion.room} duct size change`} type="checkbox" disabled={suggestion.overCapacity || !suggestion.applyEligible || !suggestion.airflowReviewed} checked={selectedSizingIds.includes(suggestion.id)} onChange={() => toggleSizingSuggestion(suggestion.id)} />
                  <button onClick={() => { setSelectedId(suggestion.id); setActiveTool("select"); }}>
                    <span><strong>{suggestion.room} · {suggestion.type.toUpperCase()}</strong><small>{suggestion.cfm} CFM · {suggestion.currentVelocity} FPM now · {suggestion.velocity} FPM proposed</small></span>
                    <b>{suggestion.current}″ → {suggestion.recommended}″</b>
                  </button>
                  {suggestion.overCapacity && <p>Over the {suggestion.limit} FPM limit even at {residentialFlexMax}″. Add a parallel path or revise the design manually.</p>}
                  {!suggestion.airflowReviewed && <p>Size change paused: replace planning-seed airflow with reviewed room targets or explicit manual CFM.</p>}
                </div>)}
              </div> : <div className="cfm-review-clear"><CheckCircle2 size={17} /> All connected runs match the current sizing rules.</div>}
              <button className="balance-apply-sizes" disabled={!selectedSizingIds.length} onClick={applySizingSuggestions}>Continue {selectedSizingIds.length} size candidate{selectedSizingIds.length === 1 ? "" : "s"} in Guided Repair</button>
              <div className={`progression-summary ${sizeProgressionIssues().length ? "attention" : "good"}`}>
                <span><strong>{sizeProgressionIssues().length} progression review{sizeProgressionIssues().length === 1 ? "" : "s"}</strong><small>Keep reductions gradual—such as 14×12×10 → 12×10×10 → 10×8×8.</small></span>
                <button onClick={openSystemSizingWorkflow}>Full sizing checks</button>
              </div>
              <div className="balance-workspace-note">Existing and recommended sizes are shown together. Selected rows open in Guided Repair; reviewer identity, an explicit velocity-only planning override, and final batch confirmation are required before anything resizes.</div>
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
                  <b>{row.balanced ? "SCHEDULE ALIGNED" : row.rootRunId ? "REVIEW" : "DISCONNECTED"}</b>
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
            <div className="production-hero">
              <div>
                <span className="production-kicker"><CloudUpload size={12} /> V106 · PLAN INTELLIGENCE</span>
                <strong>HVAC Takeoff Center</strong>
                <small>{systemLabel(activeSystem)} · source-backed material quantities and review</small>
              </div>
              <b className={materialSummary().holds.length ? "hold" : buildTakeoff().length ? "ready" : "empty"}>
                {materialSummary().holds.length ? `${materialSummary().holds.length} HOLD` : buildTakeoff().length ? "READY" : "EMPTY"}
              </b>
            </div>
            <nav className="production-tabs" role="tablist" aria-label="HVAC Takeoff Center">
              {([
                ["overview", "Overview"],
                ["materials", "Materials"],
              ] as const).map(([view, label]) => <button role="tab" aria-selected={takeoffView === view} className={takeoffView === view ? "active" : ""} onClick={() => setTakeoffView(view)} key={view}>{label}</button>)}
            </nav>
            {takeoffView === "overview" && <>
              <div className="production-project-strip">
                <span><b>{projectProductionSummary().systems}</b><small>Active systems</small></span>
                <span><b>{projectProductionSummary().lineItems}</b><small>Project line items</small></span>
                <span><b>{projectProductionSummary().flexRolls}</b><small>25-ft flex rolls</small></span>
              </div>
              <div className="material-summary-grid production-metrics">
                <div><span>25-ft flex rolls</span><strong>{materialSummary().flexBoxes}</strong><small>Every started 25 ft counts</small></div>
                <div><span>Air devices</span><strong>{materialSummary().deviceCount}</strong><small>Supply + return faces</small></div>
                <div><span>T/Y fittings</span><strong>{materialSummary().fittingCount}</strong><small>Saved plan geometry</small></div>
                <div className={materialSummary().holds.length ? "attention" : "good"}><span>Fabrication holds</span><strong>{materialSummary().holds.length}</strong><small>{materialSummary().holds.length ? "Resolve before order" : "No active holds"}</small></div>
              </div>
              <div className="production-readiness-card">
                <div className="field-section-heading"><strong>PRODUCTION READINESS</strong><span>{activeSystemScaleStatus.verified && !materialSummary().holds.length ? "REVIEWED" : "CHECK"}</span></div>
                <label className={activeSystemScaleStatus.verified ? "clear" : "hold"}>{activeSystemScaleStatus.verified ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}<span><b>Drawing scale</b><small>{activeSystemScaleStatus.detail}</small></span></label>
                <label className={activeFieldPackage.connectionProblems ? "hold" : "clear"}>{activeFieldPackage.connectionProblems ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}<span><b>Connections</b><small>{activeFieldPackage.connectionProblems ? `${activeFieldPackage.connectionProblems} open or detached connection${activeFieldPackage.connectionProblems === 1 ? "" : "s"}` : "Saved run and fitting connections are complete"}</small></span></label>
                <label className={materialSummary().holds.length ? "hold" : "clear"}>{materialSummary().holds.length ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}<span><b>Fabrication coordination</b><small>{materialSummary().holds.length ? "Clear the highlighted plan issues before fabrication" : "No active coordination holds"}</small></span></label>
              </div>
              <div className="production-guardrail"><ShieldAlert size={15} /><span><strong>Your drawing stays manual.</strong><small>Add field numbers and confirm sizes after drawing. Connection, route, return, and repair decisions still require approval.</small></span></div>
            </>}
            {takeoffView === "materials" && <>
              <div className="material-controls production-controls">
                <label>Material allowance
                  <select value={materialWastePercent} onChange={(event) => setMaterialWastePercent(Number(event.target.value))}>
                    {[0, 5, 10, 15, 20].map((value) => <option value={value} key={value}>{value}% waste</option>)}
                  </select>
                </label>
                <button disabled={!buildTakeoff().length} onClick={exportPurchaseSheetCsv}><Save size={13} /> Purchase CSV</button>
              </div>
              {materialSummary().holds.length > 0 && <div className="fabrication-holds">
                <div><ShieldAlert size={15} /><span><strong>DO NOT FABRICATE YET</strong><small>Resolve these coordination items first</small></span></div>
                {materialSummary().holds.slice(0, 5).map((issue, index) => <button key={`${issue.title}-hold-${index}`} onClick={() => focusReviewIssue(issue)}>
                  <AlertTriangle size={11} /><span><strong>{issue.title}</strong><small>{issue.detail}</small></span>
                </button>)}
              </div>}
              {buildTakeoff().length ? <div className="takeoff-list production-list">
                {buildTakeoff().map((row, index) => <div className="takeoff-row" key={`${row.item}-${row.size}-${index}`}>
                  <div><i>{row.category}</i><strong>{row.item}</strong><small>{row.size} · {row.note}</small></div>
                  <b>{row.quantity}</b>
                </div>)}
              </div> : <div className="empty-takeoff">Draw ductwork or place HVAC symbols to build the takeoff.</div>}
              <div className="takeoff-note">Flex quantity uses your rule: total measured length by size, plus the selected allowance, divided into 25-ft rolls; every started roll counts as one.</div>
            </>}
            {takeoffView === "installer" && <div className="production-installer-sheet">
              <div className="installer-sheet-title"><span><b>INSTALLER SHEET</b><small>{fileName} · {systemLabel(activeSystem)}</small></span><button onClick={openFieldPackageComposer}><FileText size={13} /> Compose PDF</button></div>
              <div className="installer-sheet-stats">
                <span><small>Design airflow</small><b>{systemStats(activeSystem).designCfm || 0} CFM</b></span>
                <span><small>Duct runs</small><b>{activeFieldRuns.length}</b></span>
                <span><small>Flex rolls</small><b>{materialSummary().flexBoxes}</b></span>
                <span><small>Devices</small><b>{materialSummary().deviceCount}</b></span>
              </div>
              <div className="field-section-heading"><strong>FIELD MATERIAL SUMMARY</strong><span>{buildTakeoff().length} ITEMS</span></div>
              {buildTakeoff().slice(0, 12).map((row, index) => <div className="installer-line" key={`${row.item}-installer-${index}`}><span><b>{row.item}</b><small>{row.size} · {row.note}</small></span><strong>{row.quantity}</strong></div>)}
              <div className="field-section-heading installer-check-heading"><strong>CREW CHECKS</strong><span>FIELD VERIFY</span></div>
              {["Approved plan revision is on site", "Scale, ceiling heights, and access are verified", "Fitting orientation matches the saved plan", "Flex is supported, straight, and free of kinks", "Equipment instructions and inspector comments govern"].map((label) => <label className="installer-check" key={label}><input type="checkbox" /><span>{label}</span></label>)}
            </div>}
            {takeoffView === "packages" && <div className="production-packages">
              <div className="package-form">
                <div className="field-section-heading"><strong>CREATE CONTROLLED TAKEOFF PACKAGE</strong><span>MANUAL ISSUE</span></div>
                <label>Package name<input value={takeoffPackageName} onChange={(event) => setTakeoffPackageName(event.target.value)} placeholder={`${systemLabel(activeSystem)} rough-in`} /></label>
                <div>
                  <label>Revision<input value={takeoffRevision} onChange={(event) => setTakeoffRevision(event.target.value)} placeholder="A, 1, IFC…" /></label>
                  <label>Prepared by<input value={takeoffPreparedBy} onChange={(event) => setTakeoffPreparedBy(event.target.value)} placeholder="Name / initials" /></label>
                </div>
                <div className="package-actions">
                  <button disabled={takeoffSaving || !buildTakeoff().length} onClick={() => void createTakeoffPackage(false)}><Save size={13} /> Save package</button>
                  <button disabled={takeoffSaving || !buildTakeoff().length || driveConfigured === false} onClick={() => void createTakeoffPackage(true)}><HardDrive size={13} /> Save to Drive</button>
                </div>
                <p>Each package stores its drawing fingerprint. A later plan change marks that package stale without changing the plan.</p>
              </div>
              <div className="package-history">
                <div className="field-section-heading"><strong>PACKAGE HISTORY</strong><span>{activeTakeoffPackages().length}</span></div>
                {activeTakeoffPackages().length ? activeTakeoffPackages().map((record) => {
                  const current = record.drawingSignature === activeTakeoffSignature();
                  return <div className={current ? "current" : "stale"} key={record.id}>
                    <b>{record.revision}</b>
                    <span><strong>{record.name}</strong><small>{record.preparedBy} · {new Date(record.createdAt).toLocaleString()} · {record.lineItemCount} items · {record.flexRollCount} flex rolls</small></span>
                    {record.driveUrl ? <a href={record.driveUrl} target="_blank" rel="noreferrer">DRIVE</a> : <em>{current ? "CURRENT" : "STALE"}</em>}
                  </div>;
                }) : <div className="empty-takeoff">No controlled takeoff packages for this system yet.</div>}
              </div>
            </div>}
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
              <button onClick={openFieldPackageComposer}><FileText size={13} /> Compose package</button>
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
                <button onClick={openFieldPackageComposer}><FileText size={13} /> Compose installer package</button>
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
              <div className="takeoff-note">Takeoff output is a source-backed review aid. Approved plans, code, equipment instructions, and the estimator&apos;s final review govern purchasing decisions.</div>
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
                <button disabled={!activeReviewedIssueRows.some((row) => !row.resolvedByDecision)} onClick={selectNextValidationIssue}>Jump to next issue</button>
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
                {activeReviewRow.decision && <div className={`recorded-decision ${activeReviewRow.decisionStale ? "stale" : activeReviewRow.resolvedByDecision ? "complete" : "pending"}`}>
                  {activeReviewRow.resolvedByDecision ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                  <span>
                    <strong>{activeReviewRow.decision.status.toUpperCase()} · {activeReviewRow.decisionStale ? "EVIDENCE CHANGED · REVIEW AGAIN" : activeReviewRow.resolvedByDecision ? "REVIEW COMPLETE" : "PENDING CLOSEOUT"} · {activeReviewRow.decision.reviewer}</strong>
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
                      disabled={suggestion.overCapacity || !suggestion.applyEligible || !suggestion.airflowReviewed}
                      onChange={() => toggleSizingSuggestion(suggestion.id)}
                    />
                    <button onClick={() => { setSelectedId(suggestion.id); setActiveTool("select"); }}>
                      <span>
                        <strong>{suggestion.type.toUpperCase()} · {suggestion.cfm} CFM · {suggestion.room}</strong>
                        <small>{suggestion.current}″ existing → {suggestion.recommended}″ recommended · {suggestion.currentVelocity} → {suggestion.velocity} FPM</small>
                      </span>
                      <b>{suggestion.overCapacity ? `OVER ${suggestion.limit}` : `${suggestion.velocity} FPM`}</b>
                    </button>
                    {!suggestion.airflowReviewed && <p>Paused: governing airflow is not fully reviewed.</p>}
                  </div>)}
                  <button className="apply-sizing" onClick={applySizingSuggestions} disabled={!selectedSizingIds.length}>
                    Continue {selectedSizingIds.filter((id) => sizingSuggestions().some((suggestion) => suggestion.id === id && suggestion.applyEligible && suggestion.airflowReviewed && !suggestion.overCapacity)).length} candidates in Guided Repair
                  </button>
                </> : <div className="sizing-clear"><CheckCircle2 size={17} /> Connected runs already match the sizing rules.</div>}
              </div>}
              <p className="sizing-safety-note">Recommendations are advisory. Checked rows move to Guided Repair, where reviewer identity, an explicit pressure-evidence override, and final confirmation are required. Over-capacity and unreviewed-airflow runs stay blocked.</p>
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
              <div className="wide"><span>Continuous network</span><strong>{drawings.filter((drawing) => ["diffuser", "returnGrille"].includes(drawing.symbol?.kind || "") && drawingSystem(drawing) === activeSystem && airflowNetwork().rootedTerminalRun.has(drawing.id)).length} terminals traced to equipment in {systemLabel(activeSystem)}</strong></div>
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
            <div className={`pressure-card ${!activeSystemScaleStatus.verified ? "attention" : pressureSummary().highestDrop > .15 ? "attention" : "good"}`}>
              <div><Gauge size={16} /><span><strong>PRESSURE-LOSS ESTIMATE</strong><small>{activeSystemScaleStatus.verified ? "Current segment rough loss · bends include 8 equivalent ft each" : activeSystemScaleStatus.detail}</small></span></div>
              <dl>
                <div><dt>Average friction</dt><dd>{pressureSummary().averageFriction.toFixed(2)} in. w.g./100 ft</dd></div>
                <div><dt>Highest segment loss</dt><dd>{activeSystemScaleStatus.verified ? `${pressureSummary().highestDrop.toFixed(2)} in. w.g.` : "Scale unverified"}</dd></div>
                <div><dt>Runs reviewed</dt><dd>{pressureSummary().runs.length}</dd></div>
              </dl>
              {activeSystemScaleStatus.verified && pressureSummary().highestRun && <button onClick={() => { setSelectedId(pressureSummary().highestRun!.id); setActiveTool("select"); }}>
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
        <div className="print-section-heading package-print-section package-section-materials">
          <strong>MATERIAL TAKEOFF</strong>
          <span>Approximate quantities · field verify before ordering</span>
        </div>
        <table className="package-print-section package-section-materials">
          <thead><tr><th>Category</th><th>Item</th><th>Size</th><th>Quantity</th><th>Field note</th></tr></thead>
          <tbody>
            {buildTakeoff().map((row, index) => <tr key={`${row.item}-print-${index}`}>
              <td>{row.category}</td><td>{row.item}</td><td>{row.size}</td><td>{row.quantity}</td><td>{row.note}</td>
            </tr>)}
          </tbody>
        </table>
        <div className="field-notes package-print-section package-section-materials">
          <strong>FIELD NOTES</strong>
          <span>Keep flex straight, fully supported, and free of kinks or sags.</span>
          <span>Verify structure, lighting, plumbing, ceiling height, and access before installation.</span>
          <span>Elevation labels marked EL VERIFY must be coordinated before duct installation.</span>
          <span>Final duct sizes, routing, fabricated dimensions, and airflow must be field verified.</span>
        </div>
        <div className="print-checks package-print-section package-section-review">
          <strong>AIRFLOW & VALIDATION SUMMARY</strong>
          <div>
            <span>Design airflow: {designAirflow().targetCfm} CFM</span>
            <span>Assigned diffusers: {designAirflow().supplyCfm} CFM ({designAirflow().percent}%)</span>
            <span>Assigned return: {designAirflow().returnCfm} CFM</span>
            <span>Duct elevations assigned: {drawings.filter((drawing) => drawingSystem(drawing) === activeSystem && ["supply", "return", "fresh"].includes(drawing.type) && !drawing.fitting && drawing.elevation?.trim()).length} of {drawings.filter((drawing) => drawingSystem(drawing) === activeSystem && ["supply", "return", "fresh"].includes(drawing.type) && !drawing.fitting).length}</span>
          </div>
          {activeReviewedIssueRows.filter((row) => row.issue.severity !== "info").map((row, index) => <span key={`${row.issue.id}-print-${index}`}>
            • {row.issue.title}: {row.issue.detail}
            {row.decisionStale
              ? ` · EVIDENCE CHANGED — REVIEW AGAIN · ${row.issue.evidenceFingerprint.toUpperCase()}`
              : row.decision
                ? ` · ${row.issue.severity === "critical" ? "DOCUMENTED / STILL BLOCKING" : row.resolvedByDecision ? row.decision.status.toUpperCase() : `${row.decision.status.toUpperCase()} / PENDING`} by ${row.decision.reviewer} · ${row.issue.evidenceFingerprint.toUpperCase()}`
                : ` · OPEN · ${row.issue.evidenceFingerprint.toUpperCase()}`}
          </span>)}
          {!activeReviewedIssueRows.filter((row) => row.issue.severity !== "info").length && <span>✓ No critical airflow or velocity issues detected.</span>}
        </div>
        <div className="print-field-package package-print-section package-section-release">
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
        {activeRfiItems().length > 0 && <div className="print-rfi-list package-print-section package-section-coordination">
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
        <div className="print-commissioning package-print-section package-section-startup">
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
        {activePunchItems().length > 0 && <div className="print-punch-list package-print-section package-section-coordination">
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
          <div className="print-section-heading room-print-heading package-print-section package-section-airflow">
            <strong>ROOM AIRFLOW SCHEDULE · {systemLabel(activeSystem)}</strong>
            <span>Supply, return, terminal count, and bedroom return-path review</span>
          </div>
          <table className="print-room-schedule package-print-section package-section-airflow">
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

      {showDisplaySettings && <div className="display-settings-overlay" role="presentation">
        <button className="display-settings-scrim" aria-label="Close display settings" onClick={() => setShowDisplaySettings(false)} />
        <section
          ref={displaySettingsPanelRef}
          className="display-settings-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="display-settings-title"
          onKeyDown={handleDisplaySettingsKeyDown}
        >
          <header>
            <div>
              <small>TABLET + ULTRA-HD WORKSPACE</small>
              <h2 id="display-settings-title">Display &amp; input</h2>
            </div>
            <button ref={displaySettingsCloseRef} aria-label="Close display settings" onClick={() => setShowDisplaySettings(false)}><X size={18} /></button>
          </header>
          <div className="display-settings-body">
            <fieldset>
              <legend>Plan rendering</legend>
              {([
                ["auto", "Auto", "Adapts to zoom, monitor DPR, and a safe 12 MP page budget."],
                ["performance", "Performance", "Fastest redraws for large scanned sets and older tablets."],
                ["sharp", "Sharp", "Higher-detail plan text with a bounded 16 MP page budget."],
                ["4k", "4K Fixed", "Targets an 8.3 MP full-sheet canvas without unsafe 5K/8K memory growth."],
              ] as Array<[RenderQualityMode, string, string]>).map(([mode, label, detail]) => <button
                type="button"
                key={mode}
                className={renderQuality === mode ? "selected" : ""}
                aria-pressed={renderQuality === mode}
                onClick={() => setRenderQuality(mode)}
              >
                <span><strong>{label}</strong><small>{detail}</small></span>
                <i aria-hidden="true" />
              </button>)}
            </fieldset>
            <div className={`render-quality-readout ${renderQualityStatus.reduced ? "reduced" : ""}`}>
              <span>{renderQualityStatus.reduced ? <ShieldAlert size={17} /> : <CheckCircle2 size={17} />}</span>
              <div><strong>{renderQualityStatus.label}</strong><small>{renderQualityStatus.megapixels.toFixed(1)} MP full-sheet canvas · measurements and markups stay in PDF coordinates.</small></div>
            </div>
            <fieldset className="density-options">
              <legend>Control density</legend>
              <div>
                <button type="button" className={workspaceDensity === "comfortable" ? "selected" : ""} aria-pressed={workspaceDensity === "comfortable"} onClick={() => setWorkspaceDensity("comfortable")}>Comfortable</button>
                <button type="button" className={workspaceDensity === "compact" ? "selected" : ""} aria-pressed={workspaceDensity === "compact"} onClick={() => setWorkspaceDensity("compact")}>Compact</button>
              </div>
            </fieldset>
            <div className="tablet-input-note">
              <strong>Tablet controls are active</strong>
              <span>Two fingers pan and pinch. Apple Pencil or another stylus draws and edits. Stylus-aware touch suppression keeps finger input out of duct geometry.</span>
            </div>
          </div>
        </section>
      </div>}

      <footer inert={modalWorkspaceActive ? true : undefined} aria-hidden={modalWorkspaceActive}>
        <span><i className="online" /> Ready</span>
        <span>{selectedIds.length ? `${selectedIds.length} selected · Arrow nudge · Shift+Arrow 10× · midpoint grips stretch` : "Right-click drag pans anywhere · left-click selects/draws · wheel zooms at cursor · two-finger touch navigates · stylus draws"}</span>
        <span><Ruler size={11} /> {scaleLabel}</span>
        <span className="footer-right">{saveState === "saving" ? "Autosaving…" : "All changes saved"} · Nothing changes without your approval</span>
      </footer>
      <ProjectHome
        open={showProjectHome && !showProjectSetup}
        hasPlan={Boolean(pdf)}
        currentProjectName={fileName}
        currentRevisionLabel={workingCloudRevisionId ? `Cloud revision R${cloudProjectRisk?.latestRevisionNumber || "—"}` : "Local working copy"}
        driveConfigured={driveConfigured}
        busy={loading}
        notice={error}
        pdfStartMode={pdfStartMode}
        onClose={() => setShowProjectHome(false)}
        onOpenPdfDirect={() => {
          setError("");
          startDirectLocalPdf("home");
        }}
        onOpenPdfGuided={() => {
          setError("");
          pendingPdfOpenRef.current = null;
          setShowProjectSetup(true);
        }}
        onOpenDrive={() => {
          setError("");
          void openFromDrive(createPdfOpenContext("drive", "direct", "home"));
        }}
        onDropPdf={(file) => {
          setError("");
          void openPdf(file, createPdfOpenContext("local", "direct", "drop"));
        }}
        onPdfStartModeChange={updatePdfStartMode}
        onOpenProjectHub={(projectId) => {
          setCloudInitialProjectId(projectId || null);
          setShowProjectHome(false);
          setShowCloudProjects(true);
        }}
      />
      {showProjectSetup && <GuidedProjectSetup
        open
        driveConfigured={driveConfigured}
        onCancel={() => setShowProjectSetup(false)}
        onStart={startGuidedProject}
      />}
      <AIPlanWorkspace
        open={showPlanIntelligence}
        initialView={planWorkspaceInitialView}
        autoRun
        pdf={pdf}
        sourceFingerprint={pdfFingerprint || sourceFileName || fileName}
        sourceFileName={sourceFileName || `${fileName}.pdf`}
        projectName={fileName}
        currentScaleLabel={scaleLabel}
        scaleVerified={activeSystemScaleStatus.verified}
        onClose={() => setShowPlanIntelligence(false)}
        onShowPage={(page, region) => {
          setShowPlanIntelligence(false);
          goToPage(page);
          setPlanEvidenceRegion(region ? { page, region } : null);
        }}
        onPrepareMarkup={(page) => {
          goToPage(page);
          openMarkupAssistant();
        }}
        onUseDetectedScale={(candidate, page) => {
          setShowPlanIntelligence(false);
          applyDetectedPlanScale(candidate, page);
        }}
        onStartCalibration={(page) => {
          setShowPlanIntelligence(false);
          startPlanScaleCalibration(page);
        }}
        onOpenConnectionRepair={() => {
          setShowPlanIntelligence(false);
          setRightTab("builder");
          openInspectorPanel();
          openConnectionRepairReview();
        }}
        cloudProjectConnected={Boolean(workingCloudProjectId)}
        onOpenCloudWorkspace={() => {
          setShowPlanIntelligence(false);
          setShowCloudProjects(true);
        }}
        onAnalysisChange={async (analysis) => {
          setActivePlanAnalysis(analysis);
          setCloudPlanAnalysisRunId(null);
          if (!workingCloudProjectId) return;
          try {
            const run = await saveCloudPlanAnalysis({
              projectId: workingCloudProjectId,
              revisionId: workingCloudRevisionId,
              analysis,
            });
            setCloudPlanAnalysisRunId(run.id);
            setBranchMessage("Plan setup was saved to this cloud project");
          } catch {
            setBranchMessage("Plan setup is available locally. Sign in with edit access to save it to the cloud project.");
          }
        }}
        onFindingDecision={async (_analysis, finding, decision, note) => {
          if (!cloudPlanAnalysisRunId) return;
          try {
            await updateCloudPlanFindingDecision({
              runId: cloudPlanAnalysisRunId,
              findingClientId: finding.id,
              decision,
              note,
            });
          } catch {
            setBranchMessage("The review decision is saved locally, but cloud sync needs edit access.");
          }
        }}
      />
      <MarkupAssistantStudio
        key={`plan-helper:${assistantFocusedRecommendationId || "general"}`}
        open={showMarkupAssistant}
        initialView={assistantInitialView}
        projectName={fileName}
        systemName={systemLabel(activeSystem)}
        recommendations={markupRecommendations}
        focusedRecommendationId={assistantFocusedRecommendationId}
        summary={markupAssistantSummary}
        repairPlan={assistantRepairPlan}
        autonomyMode={assistantAutonomyMode}
        selectedActionIds={assistantSelectedActionIds}
        preparedEvidenceFingerprint={assistantPreparedEvidenceFingerprint}
        preparedRepairPlanId={assistantPreparedRepairPlanId}
        repairRecords={assistantRepairRecords.filter((record) => record.systemId === activeSystem)}
        takeoffImpact={assistantTakeoffImpact}
        advancedIntelligence={activeAdvancedPlanIntelligence}
        smartSetup={activeSmartPlanSetup}
        suggestionLayer={assistantSuggestionLayer}
        suggestionLayerVisible={showAssistantSuggestionLayer && assistantSuggestionLayer.status === "review"}
        connectionRepairItems={activeConnectionRepairIssues}
        connectionRepairFingerprint={activeConnectionRepairPlan.fingerprint}
        connectionCandidateChoices={connectionCandidateChoices}
        connectionRepairChanges={Object.fromEntries(
          activeConnectionRepairIssues.map((item) => [item.id, connectionRepairPreviewChanges(item)]),
        )}
        issueAnswers={activeFixPlanIssueAnswers}
        showIssueMarkers={showReviewMarkers}
        scaleVerified={activeSystemScaleStatus.verified}
        confirmedScaleByPage={Object.fromEntries(
          Object.entries(sheetScales)
            .filter(([, scale]) => scale.verified)
            .map(([page, scale]) => [page, scale.label]),
        )}
        onUseDetectedScale={applyDetectedPlanScale}
        onStartCalibration={startPlanScaleCalibration}
        designStandard={activeDesignStandard}
        canUndo={Boolean(undoableAssistantRepairRecord())}
        onClose={() => {
          setShowMarkupAssistant(false);
          setActiveMarkupRecommendation(undefined);
          setAssistantFocusedRecommendationId("");
        }}
        onActiveRecommendationChange={setActiveMarkupRecommendation}
        onFocusDrawing={(drawingId) => {
          focusDrawingOnPlan(drawingId, { avoidAssistant: true });
        }}
        onOpenManualReview={(recommendation) => {
          const issue = recommendation.findingId
            ? activeValidationIssues.find((candidate) => candidate.id === recommendation.findingId)
            : undefined;
          if (issue) {
            setShowMarkupAssistant(false);
            setActiveMarkupRecommendation(undefined);
            openInspectorPanel();
            window.requestAnimationFrame(() => focusReviewIssue(issue));
            return;
          }
          if (recommendation.action === "sizing-review") {
            setShowMarkupAssistant(false);
            setActiveMarkupRecommendation(undefined);
            openSystemBalanceStudio();
            return;
          }
          setBranchMessage("This recommendation needs a manual plan decision before geometry can change");
        }}
        onOpenSizingReview={() => {
          setShowMarkupAssistant(false);
          setActiveMarkupRecommendation(undefined);
          openSystemBalanceStudio();
        }}
        onAutonomyModeChange={setAssistantAutonomyMode}
        onSelectedActionIdsChange={setAssistantSelectedActionIds}
        onPrepareRepairPlan={prepareAssistantRepairPlan}
        onApplyRepairPlan={applyAssistantRepairPlan}
        onUndoRepairBatch={undo}
        onRecordIssueAnswer={(input) => {
          const issue = activeValidationIssues.find((candidate) => candidate.id === input.issueId);
          if (!issue) {
            setBranchMessage("That issue changed with the plan. Refresh Fix Plan before recording an answer.");
            return false;
          }
          return resolveReviewIssue(issue, input.status, {
            reviewer: input.reviewer,
            note: input.note,
            handledReason: input.handledReason,
          });
        }}
        onShowIssueMarkersChange={setShowReviewMarkers}
        onSuggestionLayerVisibleChange={setShowAssistantSuggestionLayer}
        onChooseConnectionCandidate={(itemId, candidateId) => {
          const item = activeConnectionRepairPlan.items.find((candidate) => candidate.id === itemId);
          if (!item) return;
          setConnectionReviewOpen(true);
          setConnectionReviewFingerprint(activeConnectionRepairPlan.fingerprint);
          chooseConnectionCandidate(item, candidateId);
        }}
        onApplyConnectionRepair={(input) =>
          applyConnectionRepairSelection([input.itemId], input.evidenceFingerprint, {
            reviewer: input.reviewer,
            note: input.note,
          })
        }
        onFocusConnectionRepair={(itemId) => {
          const item = activeConnectionRepairPlan.items.find((candidate) => candidate.id === itemId);
          if (!item) return;
          setConnectionReviewOpen(true);
          setConnectionReviewFingerprint(activeConnectionRepairPlan.fingerprint);
          focusConnectionRepair(item);
        }}
        onShowPlanSetupSource={(page, region) => {
          goToPage(page);
          setPlanEvidenceRegion(region ? { page, region } : null);
          if (window.matchMedia("(max-width: 560px)").matches) {
            setShowMarkupAssistant(false);
          }
        }}
        onApplyRecommendation={(recommendation) => {
          const preview = recommendation.preview;
          if (preview?.kind !== "branch-junction") return;
          const opportunity = assistantBranchOpportunities.find((candidate) =>
            candidate.mainRunId === preview.mainRunId &&
            candidate.branchRunId === preview.branchRunId &&
            Math.hypot(candidate.center.x - preview.point.x, candidate.center.y - preview.point.y) < 1
          );
          if (!opportunity) {
            setBranchMessage("That preview changed with the plan. Review the refreshed junction before placing it.");
            setActiveMarkupRecommendation(undefined);
            return;
          }
          setShowMarkupAssistant(false);
          setActiveMarkupRecommendation(undefined);
          finishDrawing();
          setBranchWorkflow("run-first");
          setQueuedBranchRunId(opportunity.branchRunId);
          setActiveTool("branch");
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
            mode: "attach-run",
          });
          setBranchMessage("Approved T/Y preview armed · click the highlighted junction to confirm placement · Undo remains available");
        }}
      />
      {showSystemBalanceStudio && <SystemBalanceStudio
        open={showSystemBalanceStudio}
        projectName={fileName}
        model={buildSystemBalanceModel()}
        onClose={() => setShowSystemBalanceStudio(false)}
        onFocusDrawing={(drawingId) => {
          setShowSystemBalanceStudio(false);
          window.requestAnimationFrame(() => focusDrawingOnPlan(drawingId));
        }}
        onOpenEngineering={(view) => {
          setShowSystemBalanceStudio(false);
          openInspectorPanel();
          openSystemBalanceWorkspace(view);
          window.requestAnimationFrame(() => {
            document.querySelector<HTMLElement>('.balance-view-tabs button[aria-selected="true"]')?.focus();
          });
        }}
        onApplySizes={applySizingSuggestionIds}
        onApplyCfm={applyCfmProposalIds}
        onRecordReview={recordSystemBalanceReview}
        onExportRooms={exportRoomScheduleCsv}
        onExportRuns={exportSystemBalanceRunCsv}
      />}
      <FieldPackageComposer
        open={showFieldPackageComposer}
        projectName={fileName}
        systemName={systemLabel(activeSystem)}
        status={activeFieldPackage.status}
        released={activeFieldPackage.released}
        stale={activeFieldPackage.stale}
        scaleVerified={activeSystemScaleStatus.verified}
        releaseRevision={activeFieldPackage.latestRelease?.revision}
        drawingSignature={activeFieldPackage.signature}
        runCount={activeFieldPackage.runs.length}
        critical={activeFieldPackage.critical}
        warnings={activeFieldPackage.openWarnings}
        connectionProblems={activeFieldPackage.connectionProblems}
        gateCount={activeFieldPackage.gates.length}
        clearedGateCount={activeFieldPackage.gates.filter((gate) => gate.clear).length}
        onClose={() => setShowFieldPackageComposer(false)}
        onPrint={printSelectedFieldPackage}
        onDownloadManifest={exportReleaseManifestCsv}
        onDownloadRuns={exportFieldRunScheduleCsv}
        onDownloadTakeoff={exportPurchaseSheetCsv}
      />
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
        currentStepLabel={fieldFirstActiveStep.label}
        currentStepDetail={fieldFirstActiveStep.detail}
        currentStepProgress={fieldFirstProgress}
        onContinueWorkflow={() => {
          setShowCloudProjects(false);
          fieldFirstActiveStep.run();
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
