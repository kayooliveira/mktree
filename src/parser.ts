import * as path from "path";
import { msg } from "./messages";

const KNOWN_FILES = new Set([
  "makefile",
  "dockerfile",
  "license",
  "readme",
  "procfile",
  "config",
  ".gitignore",
  ".env",
  ".eslintrc",
  ".babelrc",
  "package.json",
  "tsconfig.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lockb",
  "vercel.json",
  "netlify.toml",
]);

export interface ParseResult {
  indent: number;
  name: string;
  isDir: boolean;
}

export function parseLine(line: string): ParseResult | null {
  if (/^\s*\.{3,}/.test(line)) {
    return null;
  }

  const match = line.match(/^([│├└─\s\t\|\+\-]*)(.*)$/);
  if (!match) {
    return null;
  }

  let prefix = match[1];
  let name = match[2].trim();

  if (!name) {
    return null;
  }

  if (/[:;=]/.test(name)) {
    return null;
  }

  const isExplicitDir = name.endsWith("/");
  const hasExtension = name.includes(".");

  if (prefix.trim().length === 0) {
    if (
      !isExplicitDir &&
      !hasExtension &&
      !KNOWN_FILES.has(name.toLowerCase())
    ) {
      if (name.includes(" ")) {
        return null;
      }
    }
  }

  const indent = prefix.replace(/\t/g, "    ").length;

  let isDir = isExplicitDir;
  if (isDir) {
    name = name.slice(0, -1);
  }

  if (!isDir && name.length > 0) {
    const lowerName = name.toLowerCase();
    const nameHasDot = name.includes(".");
    const isKnownFile = KNOWN_FILES.has(lowerName);

    if (!nameHasDot && !isKnownFile) {
      isDir = true;
    }
  }

  return { indent, name, isDir };
}

export function validateStructure(
  text: string,
  rootPath: string
): { valid: boolean; errors: string[] } {
  const lines = text.split("\n");
  const errors: string[] = [];
  const seenPaths = new Set<string>();

  let stack: { indent: number; path: string }[] = [];

  lines.forEach((line, i) => {
    if (!line.trim()) {
      return;
    }

    const result = parseLine(line);
    if (!result) {
      return;
    }

    const { indent, name, isDir } = result;

    while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    const parent = stack.length > 0 ? stack[stack.length - 1].path : rootPath;
    const currentPath = path.join(parent, name);

    if (seenPaths.has(currentPath)) {
      errors.push(msg.duplicatePath(i + 1, name));
    }
    seenPaths.add(currentPath);

    if (isDir) {
      stack.push({ indent, path: currentPath });
    }
  });

  return { valid: errors.length === 0, errors };
}
