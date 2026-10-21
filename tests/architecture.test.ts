import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = fileURLToPath(new URL("../src", import.meta.url));
const IMPORT_SPECIFIER = /(?:from|import)\s*\(?\s*["']([^"']+)["']/g;

const ALLOWED_LAYERS: Readonly<Record<string, readonly string[]>> = {
  domain: ["domain"],
  application: ["domain", "application"],
};

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return path.endsWith(".ts") ? [path] : [];
  });
}

function forbiddenImports(layer: string): string[] {
  const allowed = ALLOWED_LAYERS[layer];
  return sourceFiles(join(SRC, layer)).flatMap((file) =>
    [...readFileSync(file, "utf8").matchAll(IMPORT_SPECIFIER)]
      .map((match) => match[1])
      .filter((specifier) => {
        if (!specifier.startsWith(".")) return true;
        const targetLayer = relative(SRC, resolve(dirname(file), specifier)).split(sep)[0];
        return !allowed.includes(targetLayer);
      })
      .map((specifier) => `${relative(SRC, file)} → ${specifier}`),
  );
}

describe("dependency rule", () => {
  it.each(Object.keys(ALLOWED_LAYERS))("%s only depends on inner layers and no package", (layer) => {
    expect(forbiddenImports(layer)).toEqual([]);
  });
});
