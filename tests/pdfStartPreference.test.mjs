import assert from "node:assert/strict";
import test from "node:test";

import { loadTypescriptModule } from "./load-typescript-module.mjs";

const {
  DEFAULT_PDF_START_PREFERENCE,
  PDF_START_PREFERENCE_STORAGE_KEY,
  loadPdfStartPreference,
  normalizePdfStartPreference,
  savePdfStartPreference,
} = await loadTypescriptModule(
  new URL("../app/pdfStartPreference.ts", import.meta.url),
);

function memoryStorage(initialValue = null) {
  const values = new Map();
  if (initialValue !== null) values.set(PDF_START_PREFERENCE_STORAGE_KEY, initialValue);
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    value() {
      return values.get(PDF_START_PREFERENCE_STORAGE_KEY) ?? null;
    },
  };
}

test("defaults new and invalid preferences to direct PDF opening", () => {
  assert.deepEqual(loadPdfStartPreference(memoryStorage()), DEFAULT_PDF_START_PREFERENCE);
  assert.deepEqual(normalizePdfStartPreference({ version: 1, mode: "automatic" }), DEFAULT_PDF_START_PREFERENCE);
  assert.deepEqual(normalizePdfStartPreference({ version: 2, mode: "guided" }), DEFAULT_PDF_START_PREFERENCE);
});

test("retains an explicit guided preference in the versioned local schema", () => {
  const storage = memoryStorage();
  savePdfStartPreference({ version: 1, mode: "guided" }, storage);

  assert.deepEqual(JSON.parse(storage.value()), { version: 1, mode: "guided" });
  assert.deepEqual(loadPdfStartPreference(storage), { version: 1, mode: "guided" });
});

test("recovers from malformed and unavailable browser storage", () => {
  assert.deepEqual(
    loadPdfStartPreference(memoryStorage("{not-json")),
    DEFAULT_PDF_START_PREFERENCE,
  );

  assert.doesNotThrow(() => savePdfStartPreference(
    { version: 1, mode: "direct" },
    { setItem() { throw new Error("storage unavailable"); } },
  ));
});
