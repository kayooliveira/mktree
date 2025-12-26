import * as assert from 'assert';
import { parseLine, validateStructure } from '../parser';

suite('MkTree Refined Logic Suite', () => {

    suite('Parser Unit Tests', () => {
        
        test('Should ignore Markdown titles and code fences', () => {
            const title = parseLine('# Project Title');
            const fence = parseLine('```txt');
            const empty = parseLine('   ');
            
            assert.strictEqual(title, null, 'Should ignore Markdown titles');
            assert.strictEqual(fence, null, 'Should ignore code fences');
            assert.strictEqual(empty, null, 'Should ignore empty lines');
        });

        test('Should identify valid tree lines', () => {
            const root = parseLine('my-app/');
            const folder = parseLine('├── src/');
            const file = parseLine('│   └── main.ts');
            
            assert.ok(root !== null && root.isDir === true, 'Should identify root folder');
            assert.ok(folder !== null && folder.name === 'src', 'Should identify nested folder');
            assert.ok(file !== null && file.name === 'main.ts', 'Should identify file');
        });

        test('Should identify known files without extensions', () => {
            const docker = parseLine('├── Dockerfile');
            const pkg = parseLine('├── package.json');
            
            assert.ok(docker !== null && docker.isDir === false, 'Dockerfile should be a file');
            assert.ok(pkg !== null && pkg.isDir === false, 'package.json should be a file');
        });
    });

    suite('Validation & Hierarchy Tests', () => {

        test('Should ignore garbage lines in validation', () => {
            const mixedText = [
                '# My Project',
                '```txt',
                'src/',
                '├── app.ts',
                '```'
            ].join('\n');
            
            const result = validateStructure(mixedText, '/tmp');
            assert.strictEqual(result.valid, true, 'Should be valid by ignoring garbage lines');
        });

        test('Should detect duplicates in deep structures', () => {
            const duplicatedText = [
                'root/',
                '├── src/',
                '│   └── utils.ts',
                '└── src/',
                '    └── utils.ts'
            ].join('\n');
            
            const result = validateStructure(duplicatedText, '/tmp');
            assert.strictEqual(result.valid, false, 'Should detect duplicate path');
            assert.ok(result.errors.length > 0);
        });

        test('Should detect invalid characters for OS', () => {
            const invalidText = '├── invalid:file.txt';
            const result = validateStructure(invalidText, '/tmp');
            assert.strictEqual(result.valid, false, 'Should detect colon as invalid character');
        });
    });
});