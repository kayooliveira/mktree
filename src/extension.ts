import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { parseLine, validateStructure } from './parser';

export function activate(context: vscode.ExtensionContext) {
    const isPt = vscode.env.language.startsWith('pt');
    
    const msg = {
        success: isPt ? 'Estrutura criada com sucesso!' : 'Structure created successfully!',
        error: isPt ? 'Erro ao criar estrutura' : 'Error creating structure',
        invalid: isPt ? 'MkTree: Erros de validação encontrados' : 'MkTree: Validation errors found',
        creating: isPt ? 'MkTree: Criando arquivos...' : 'MkTree: Creating files...',
        noWorkspace: isPt ? 'Abra uma pasta primeiro.' : 'Please open a workspace folder first.'
    };

    const outputChannel = vscode.window.createOutputChannel("MkTree");

    const createCmd = vscode.commands.registerCommand('mktree.createStructure', async (textArg?: string) => {
        const editor = vscode.window.activeTextEditor;
        const text = textArg || editor?.document.getText(editor.selection);
        const rootPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;

        if (!text) {return;}
        if (!rootPath) {
            vscode.window.showErrorMessage(msg.noWorkspace);
            return;
        }

        const validation = validateStructure(text, rootPath);
        if (!validation.valid) {
            outputChannel.clear();
            outputChannel.appendLine(msg.invalid + ":");
            validation.errors.forEach(err => outputChannel.appendLine(`- ${err}`));
            outputChannel.show();
            vscode.window.showErrorMessage(msg.invalid);
            return;
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: msg.creating
        }, async () => {
            try {
                await executeCreation(text, rootPath);
                vscode.window.showInformationMessage(msg.success);
            } catch (err: any) {
                vscode.window.showErrorMessage(`${msg.error}: ${err.message}`);
            }
        });
    });

    const codeLensProvider = vscode.languages.registerCodeLensProvider({ scheme: 'file' }, {
        provideCodeLenses(document: vscode.TextDocument) {
            const lenses: vscode.CodeLens[] = [];
            for (let i = 0; i < Math.min(document.lineCount, 500); i++) {
                const line = document.lineAt(i);
                if (/[├──|└──]/.test(line.text)) {
                    const range = new vscode.Range(i, 0, i, 0);
                    lenses.push(new vscode.CodeLens(range, {
                        title: isPt ? "🌳 Criar esta estrutura" : "🌳 Create this structure",
                        command: "mktree.createStructure",
                        arguments: [document.getText()]
                    }));
                    break; 
                }
            }
            return lenses;
        }
    });

    context.subscriptions.push(createCmd, codeLensProvider);
}

async function executeCreation(text: string, root: string) {
    const lines = text.split('\n');
    let stack: { indent: number, path: string }[] = [];

    for (const line of lines) {
        const result = parseLine(line);
        if (!result) {continue;} 

        const { indent, name, isDir } = result;

        while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
            stack.pop();
        }

        const parent = stack.length > 0 ? stack[stack.length - 1].path : root;
        const currentPath = path.join(parent, name);

        if (isDir) {
            if (!fs.existsSync(currentPath)) {
                fs.mkdirSync(currentPath, { recursive: true });
            }
            stack.push({ indent, path: currentPath });
        } else {
            const dirName = path.dirname(currentPath);
            if (!fs.existsSync(dirName)) {
                fs.mkdirSync(dirName, { recursive: true });
            }
            if (!fs.existsSync(currentPath)) {
                fs.writeFileSync(currentPath, '');
            }
        }
    }
}

export function deactivate() {}