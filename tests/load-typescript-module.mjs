import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, extname, resolve } from "node:path";

const moduleCache = new Map();
const compiledUrlCache = new Map();

async function resolveRelativeTypescriptModule(parentUrl, specifier) {
  const parentPath = fileURLToPath(parentUrl);
  const unresolvedPath = resolve(dirname(parentPath), specifier);
  const candidates = extname(unresolvedPath)
    ? [unresolvedPath]
    : [`${unresolvedPath}.ts`, `${unresolvedPath}.tsx`, `${unresolvedPath}.js`, `${unresolvedPath}.mjs`];

  for (const candidate of candidates) {
    try {
      await readFile(candidate);
      return pathToFileURL(candidate);
    } catch {
      // Try the next supported local-module extension.
    }
  }

  throw new Error(`Unable to resolve ${specifier} from ${parentUrl.href}`);
}

async function compileTypescriptModuleUrl(sourceUrl) {
  const cacheKey = sourceUrl.href;
  if (compiledUrlCache.has(cacheKey)) return compiledUrlCache.get(cacheKey);

  const compiledUrlPromise = (async () => {
    const source = await readFile(sourceUrl, "utf8");
    const typescriptImport = await import("typescript");
    const typescript = typescriptImport.default || typescriptImport;
    let compiled = typescript.transpileModule(source, {
      compilerOptions: {
        module: typescript.ModuleKind.ESNext,
        target: typescript.ScriptTarget.ES2022,
      },
      fileName: sourceUrl.pathname,
    }).outputText;

    const relativeSpecifiers = [
      ...compiled.matchAll(/\bfrom\s+(["'])(\.[^"']+)\1/g),
      ...compiled.matchAll(/\bimport\s+(["'])(\.[^"']+)\1/g),
    ].map((match) => match[2]);

    for (const specifier of [...new Set(relativeSpecifiers)]) {
      const dependencyUrl = await resolveRelativeTypescriptModule(sourceUrl, specifier);
      const dependencyDataUrl = await compileTypescriptModuleUrl(dependencyUrl);
      compiled = compiled.replaceAll(`"${specifier}"`, `"${dependencyDataUrl}"`);
      compiled = compiled.replaceAll(`'${specifier}'`, `'${dependencyDataUrl}'`);
    }

    const packageSpecifiers = [
      ...compiled.matchAll(/\bfrom\s+(["'])([^."'\/][^"']*)\1/g),
      ...compiled.matchAll(/\bimport\s+(["'])([^."'\/][^"']*)\1/g),
    ].map((match) => match[2]).filter((specifier) => (
      !specifier.startsWith("node:")
      && !specifier.startsWith("data:")
      && !specifier.startsWith("file:")
    ));

    for (const specifier of [...new Set(packageSpecifiers)]) {
      const dependencyPath = createRequire(sourceUrl).resolve(specifier);
      const dependencyUrl = pathToFileURL(dependencyPath).href;
      compiled = compiled.replaceAll(`"${specifier}"`, `"${dependencyUrl}"`);
      compiled = compiled.replaceAll(`'${specifier}'`, `'${dependencyUrl}'`);
    }

    return `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`;
  })();

  compiledUrlCache.set(cacheKey, compiledUrlPromise);
  return compiledUrlPromise;
}

export async function loadTypescriptModule(sourceUrl) {
  const url = sourceUrl instanceof URL ? sourceUrl : new URL(sourceUrl, import.meta.url);
  const cacheKey = url.href;
  if (moduleCache.has(cacheKey)) return moduleCache.get(cacheKey);

  const modulePromise = compileTypescriptModuleUrl(url).then((compiledUrl) => import(compiledUrl));
  moduleCache.set(cacheKey, modulePromise);
  return modulePromise;
}
