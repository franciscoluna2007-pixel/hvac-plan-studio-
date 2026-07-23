# HVAC Plan Studio

A professional, field-focused HVAC plan drafting application for marking up construction PDFs and producing installer-ready plans.

## Project status

This repository contains the initialized v0.1 interface foundation. The PDF renderer, scale calibration, drawing engine, object model, snapping, duct calculations, persistence, and exports will be added in focused phases.

## Design standard

- Blue: supply trunks and runs
- Yellow: branches, T-fittings, and Y-fittings
- Red: return air
- Green: fresh air
- Orange: notes and dimensions
- Flex-heavy residential layouts with clear duct-size labels
- Units remain in the mechanical-plan location
- Zones remain separate
- Field readability is the priority

## Local development

```bash
npm install
npm run dev
```

Create a production build:

```bash
npm run build
```

## Planned architecture

1. PDF import, rendering, page controls, and scale calibration
2. CAD-style canvas, zoom/pan, selection, snapping, undo/redo
3. HVAC object model for equipment, duct runs, fittings, diffusers, returns, and fresh air
4. Automatic T/Y branch connection and run splitting
5. CFM-aware duct sizing and zone validation
6. Save/load, takeoff reports, and high-resolution PDF export
