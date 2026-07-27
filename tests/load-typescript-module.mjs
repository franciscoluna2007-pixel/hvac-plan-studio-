import { readFile } from "node:fs/promises";

const moduleCache = new Map();

export async function loadTypescriptModule(sourceUrl) {
  const url = sourceUrl instanceof URL ? sourceUrl : new URL(sourceUrl, import.meta.url);
  const cacheKey = url.href;
  if (moduleCache.has(cacheKey)) return moduleCache.get(cacheKey);

  const source = await readFile(url, "utf8");
  const typescriptImport = await import("typescript");
  const typescript = typescriptImport.default || typescriptImport;
  const compiled = typescript.transpileModule(source, {
    compilerOptions: {
      module: typescript.ModuleKind.ESNext,
      target: typescript.ScriptTarget.ES2022,
    },
    fileName: url.pathname,
  }).outputText;
  const modulePromise = import(
    `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
  );
  moduleCache.set(cacheKey, modulePromise);
  return modulePromise;
}
