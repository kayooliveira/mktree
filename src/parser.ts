import * as path from 'path';

const KNOWN_FILES = new Set([
    'makefile', 'dockerfile', 'license', 'readme', 'procfile', 
    'config', '.gitignore', '.env', '.eslintrc', '.babelrc', 'package.json', 'tsconfig.json'
]);

export interface ParseResult {
    indent: number;
    name: string;
    isDir: boolean;
}

export function parseLine(line: string): ParseResult | null {
    const match = line.match(/^([\s│├└─]*)([a-zA-Z0-9._\-\/]+.*)/);
    
    if (!match) {return null;}

    const prefix = match[1];
    let name = match[2].trim();

    if (prefix.length === 0 && !name.endsWith('/') && !name.includes('.')) {
        return null; 
    }

    let isDir = name.endsWith('/');
    if (isDir) {name = name.slice(0, -1);}

    if (!isDir && name.length > 0) {
        const lowerName = name.toLowerCase();
        const hasExtension = name.includes('.');
        const isKnown = KNOWN_FILES.has(lowerName);
        isDir = !hasExtension && !isKnown;
    }

    return { indent: prefix.length, name, isDir };
}

export function validateStructure(text: string, rootPath: string): { valid: boolean; errors: string[] } {
    const lines = text.split('\n');
    const errors: string[] = [];
    const seenPaths = new Set<string>();
    let stack: { indent: number, path: string }[] = [];

    lines.forEach((line, i) => {
        const result = parseLine(line);
        if (!result) {return;}

        const { indent, name, isDir } = result;

        while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
            stack.pop();
        }

        const parent = stack.length > 0 ? stack[stack.length - 1].path : rootPath;
        const currentPath = path.join(parent, name);

        if (seenPaths.has(currentPath)) {
            errors.push(`Line ${i + 1}: Duplicate path -> "${name}"`);
        }
        seenPaths.add(currentPath);

        if (isDir) {
            stack.push({ indent, path: currentPath });
        }
    });

    return { valid: errors.length === 0, errors };
}