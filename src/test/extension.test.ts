import * as assert from 'assert';
import { parseLine, validateStructure } from '../parser';

suite('MkTree Refined Logic Suite', () => {

    suite('Parser Unit Tests', () => {
        
        test('Should ignore Markdown titles and code fences', () => {
            const title = parseLine('# Project Title');
            const fence = parseLine('```txt');
            const empty = parseLine('   ');
            
            assert.strictEqual(title, null);
            assert.strictEqual(fence, null);
            assert.strictEqual(empty, null);
        });

        test('Should ignore programming code (Method chaining)', () => {
            const methodCall = parseLine('    .filter(d => d.message)');
            const mapCall = parseLine('    .map(diagnostic => {');
            
            assert.strictEqual(methodCall, null, 'Should ignore method calls starting with dot');
            assert.strictEqual(mapCall, null, 'Should ignore map calls');
        });

        test('Should identify valid tree lines', () => {
            const root = parseLine('my-app/');
            const folder = parseLine('├── src/');
            const file = parseLine('│   └── main.ts');
            
            assert.ok(root !== null && root.isDir === true);
            assert.ok(folder !== null && folder.name === 'src');
            assert.ok(file !== null && file.name === 'main.ts');
        });

        test('Should identify known files without extensions', () => {
            const docker = parseLine('├── Dockerfile');
            const make = parseLine('└── Makefile');
            
            assert.ok(docker !== null && docker.isDir === false);
            assert.ok(make !== null && make.isDir === false);
        });
    });

    suite('Validation & Hierarchy Tests', () => {

        test('Should ignore garbage lines in validation', () => {
            const mixedText = [
                '# My Project',
                'src/',
                '├── app.ts',
                '    .filter(x => x)' 
            ].join('\n');
            
            const result = validateStructure(mixedText, '/tmp');
            assert.strictEqual(result.valid, true);
        });

        test('Should detect duplicates and return localized error format', () => {
            const duplicatedText = [
                'root/',
                '├── src/',
                '└── src/'
            ].join('\n');
            
            const result = validateStructure(duplicatedText, '/tmp');
            assert.strictEqual(result.valid, false);
            assert.ok(result.errors[0].includes('src'), 'Error message should mention the duplicate name');
        });

        test('Should handle deep nested paths correctly', () => {
            const deepText = [
                'project/',
                '└── src/',
                '    └── components/',
                '        └── Button.tsx'
            ].join('\n');
            
            const result = validateStructure(deepText, '/tmp');
            assert.strictEqual(result.valid, true);
        });
    });
});