import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("runtime dependency notices match the pinned packages and ship with the Sites artifact", async () => {
  const [packageJson, packageLock, notices, sitesPlugin] = await Promise.all([
    readFile(new URL("../package.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../package-lock.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../THIRD_PARTY_NOTICES.md", import.meta.url), "utf8"),
    readFile(new URL("../build/sites-vite-plugin.ts", import.meta.url), "utf8"),
  ]);

  assert.equal(packageJson.dependencies.flatbush, "4.6.2");
  assert.equal(packageLock.packages["node_modules/flatbush"].version, "4.6.2");
  assert.equal(packageLock.packages["node_modules/flatbush"].license, "ISC");
  assert.equal(packageLock.packages["node_modules/flatqueue"].version, "3.1.0");
  assert.equal(packageLock.packages["node_modules/flatqueue"].license, "ISC");
  assert.match(notices, /## Flatbush 4\.6\.2[\s\S]*ISC License/);
  assert.match(notices, /## Flatqueue 3\.1\.0[\s\S]*ISC License/);
  assert.equal(packageJson.dependencies["@flatten-js/core"], "1.6.12");
  assert.equal(packageLock.packages["node_modules/@flatten-js/core"].version, "1.6.12");
  assert.equal(packageLock.packages["node_modules/@flatten-js/core"].license, "MIT");
  assert.equal(packageLock.packages["node_modules/@flatten-js/interval-tree"].version, "2.0.3");
  assert.equal(packageLock.packages["node_modules/@flatten-js/interval-tree"].license, "MIT");
  assert.equal(packageJson.devDependencies["fast-check"], "4.9.0");
  assert.equal(packageLock.packages["node_modules/fast-check"].version, "4.9.0");
  assert.equal(packageLock.packages["node_modules/fast-check"].dev, true);
  assert.match(notices, /## Flatten\.js Core 1\.6\.12 and Interval Tree 2\.0\.3[\s\S]*MIT License/);
  assert.match(sitesPlugin, /resolve\(root, "THIRD_PARTY_NOTICES\.md"\)/);
  assert.match(sitesPlugin, /resolve\(root, "dist", "THIRD_PARTY_NOTICES\.md"\)/);
});
