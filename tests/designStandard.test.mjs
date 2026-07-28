import assert from "node:assert/strict";
import test from "node:test";

import { loadTypescriptModule } from "./load-typescript-module.mjs";

const { buildDesignStandardProfile } = await loadTypescriptModule(
  new URL("../app/designStandard.ts", import.meta.url),
);

function build(terminals) {
  return buildDesignStandardProfile({
    systemId: "system-1",
    evidenceFingerprint: "design-standard-proof",
    runs: [],
    terminals,
    tyFittingIds: [],
    motorDamperIds: [],
    residentialFlexMax: "16",
  });
}

test("a disconnected same-room return does not clear the bedroom return-path review", () => {
  const profile = build([
    {
      id: "bedroom-supply",
      kind: "diffuser",
      roomName: "Bedroom 1",
      roomType: "bedroom",
      connected: true,
    },
    {
      id: "bedroom-return",
      kind: "returnGrille",
      roomName: "Bedroom 1",
      roomType: "bedroom",
      connected: false,
    },
  ]);
  const returnRule = profile.rules.find((rule) => rule.id === "bedroom-return-path");

  assert.equal(returnRule.status, "review");
  assert.deepEqual(returnRule.drawingIds, ["bedroom-supply"]);
  assert.match(returnRule.finding, /no connected same-room return path/i);
});

test("a connected same-room return clears the bedroom return-path review", () => {
  const profile = build([
    {
      id: "bedroom-supply",
      kind: "diffuser",
      roomName: "Bedroom 1",
      roomType: "bedroom",
      connected: true,
    },
    {
      id: "bedroom-return",
      kind: "returnGrille",
      roomName: "bedroom 1",
      roomType: "bedroom",
      connected: true,
    },
  ]);
  const returnRule = profile.rules.find((rule) => rule.id === "bedroom-return-path");

  assert.equal(returnRule.status, "clear");
  assert.match(returnRule.finding, /connected same-room return path/i);
});
