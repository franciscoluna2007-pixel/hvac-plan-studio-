# HVAC Plan Studio

Professional, field-focused HVAC plan drafting application for construction PDFs and installer-ready plans.

## Standards

- Blue: supply duct
- Yellow: T/Y branches
- Red: return air
- Green: fresh air
- Orange: notes and dimensions
- Flex-heavy residential layouts
- Clear duct-size labels and separate system zones
- Equipment stays in the mechanical-plan location
- Field readability comes first

## Start

```bash
npm install
npm run dev
```

Create a production build with `npm run build`.

## Roadmap

1. PDF rendering and scale calibration
2. CAD canvas, zoom, pan, selection, snapping, and undo/redo
3. HVAC objects for equipment, duct, fittings, diffusers, returns, and fresh air
4. Automatic T/Y branch connection and run splitting
5. CFM-aware duct sizing and zone validation
6. Save/load, takeoff reports, and high-resolution PDF export
