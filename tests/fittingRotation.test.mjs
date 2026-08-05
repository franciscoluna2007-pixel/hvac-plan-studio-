import assert from "node:assert/strict";
import test from "node:test";
import { loadTypescriptModule } from "./load-typescript-module.mjs";

const rotation = await loadTypescriptModule(
  new URL("../app/fittingRotation.ts", import.meta.url),
);

function portsFor(drawing) {
  const center = drawing.points[0];
  const axis = drawing.fitting.angle;
  const branch = drawing.fitting.branchAngle;
  return [
    { x: center.x - Math.cos(axis) * 5, y: center.y - Math.sin(axis) * 5 },
    { x: center.x + Math.cos(axis) * 5, y: center.y + Math.sin(axis) * 5 },
    { x: center.x + Math.cos(branch) * 5, y: center.y + Math.sin(branch) * 5 },
  ];
}

test("dragging the on-canvas handle rotates freely and keeps all endpoints connected", () => {
  const drawings = [
    {
      id: "fit",
      points: [{ x: 50, y: 50 }],
      fitting: { angle: 0, branchAngle: Math.PI / 2, side: 1, style: "tee90", connectedIds: ["a", "b", "c"] },
    },
    { id: "a", points: [{ x: 0, y: 50 }, { x: 45, y: 50 }] },
    { id: "b", points: [{ x: 55, y: 50 }, { x: 100, y: 50 }] },
    { id: "c", points: [{ x: 50, y: 55 }, { x: 50, y: 100 }] },
  ];
  const angle = rotation.fittingMainAngleForBranchHandle({
    center: { x: 50, y: 50 },
    pointer: { x: 80, y: 80 },
    mainAngle: 0,
    branchAngle: Math.PI / 2,
  });
  assert.ok(Math.abs(angle + Math.PI / 4) < 1e-9);
  const rotated = rotation.rotateFittingNetwork({ drawings, fittingId: "fit", nextAngle: angle, portsFor });
  assert.ok(Math.abs(rotated[0].fitting.angle + Math.PI / 4) < 1e-9);
  assert.ok(Math.abs(rotated[0].fitting.branchAngle - Math.PI / 4) < 1e-9);
  const ports = portsFor(rotated[0]);
  assert.deepEqual(rotated[1].points.at(-1), ports[0]);
  assert.deepEqual(rotated[2].points[0], ports[1]);
  assert.deepEqual(rotated[3].points[0], ports[2]);
});
