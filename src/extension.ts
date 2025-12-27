import * as vscode from "vscode";
import * as path from "path";
import { parseLine, validateStructure } from "./parser";
import { msg } from "./messages";

export function activate(context: vscode.ExtensionContext) {
  const outputChannel = vscode.window.createOutputChannel("MkTree");

  const createCmd = vscode.commands.registerCommand(
    "mktree.createStructure",
    async (textArg?: string) => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }

      const rawText =
        textArg ||
        (editor.selection.isEmpty
          ? getSmartBlock(editor)
          : editor.document.getText(editor.selection));

      let rootPath: string | undefined;
      if (editor.document.uri.scheme === "file") {
        rootPath = path.dirname(editor.document.uri.fsPath);
      } else if (vscode.workspace.workspaceFolders?.[0]) {
        rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
      }

      if (!rawText || !rootPath) {
        if (!rootPath) {
          vscode.window.showErrorMessage(msg.noWorkspace());
        }
        return;
      }

      const treeText = extractTreeBlock(rawText);

      if (!treeText.trim()) {
        vscode.window.showWarningMessage("No valid file structure found.");
        return;
      }

      const validation = validateStructure(treeText, rootPath);
      if (!validation.valid) {
        outputChannel.clear();
        outputChannel.appendLine(`${msg.invalid()}:`);
        validation.errors.forEach((err) =>
          outputChannel.appendLine(`- ${err}`)
        );
        outputChannel.show();
        vscode.window.showErrorMessage(msg.invalid());
        return;
      }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: msg.creating(),
        },
        async () => {
          try {
            const created = await executeCreationAsync(treeText, rootPath!);

            outputChannel.clear();
            if (created.length > 0) {
              outputChannel.appendLine(msg.success());
              created.forEach((p) => outputChannel.appendLine(`+ ${p}`));
              vscode.window.showInformationMessage(msg.success());
            } else {
              outputChannel.appendLine("No new files created.");
            }
            outputChannel.show();
          } catch (err: any) {
            vscode.window.showErrorMessage(msg.error(err.message));
          }
        }
      );
    }
  );

  const codeLensProvider = vscode.languages.registerCodeLensProvider(
    { scheme: "file" },
    {
      provideCodeLenses(document: vscode.TextDocument) {
        const lenses: vscode.CodeLens[] = [];
        const limit = Math.min(document.lineCount, 2500);

        let i = 0;
        while (i < limit) {
          const line = document.lineAt(i);
          const text = line.text;

          if (isTreeLine(text) || isPotentialRoot(text)) {
            if (hasTreeContext(document, i)) {
              const range = new vscode.Range(i, 0, i, 0);
              lenses.push(
                new vscode.CodeLens(range, {
                  title: msg.lensTitle(),
                  command: "mktree.createStructure",
                  arguments: [undefined],
                })
              );

              while (
                i < limit &&
                (isTreeLine(document.lineAt(i).text) ||
                  isPotentialRoot(document.lineAt(i).text) ||
                  document.lineAt(i).text.trim() === "")
              ) {
                i++;
              }
              continue;
            }
          }
          i++;
        }
        return lenses;
      },
    }
  );

  const treeDecorationType = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    backgroundColor: "rgba(100, 100, 100, 0.05)",
    borderStyle: "none none none solid",
    borderWidth: "0 0 0 3px",
    borderColor: new vscode.ThemeColor("editorLineNumber.activeForeground"),
  });

  function updateDecorations() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    const ranges: vscode.Range[] = [];

    for (let i = 0; i < Math.min(editor.document.lineCount, 2500); i++) {
      if (hasTreeContext(editor.document, i)) {
        const start = i;
        let end = i;
        while (
          end < editor.document.lineCount &&
          (isTreeLine(editor.document.lineAt(end).text) ||
            isPotentialRoot(editor.document.lineAt(end).text))
        ) {
          end++;
        }
        ranges.push(new vscode.Range(start, 0, end - 1, 0));
        i = end;
      }
    }
    editor.setDecorations(treeDecorationType, ranges);
  }

  vscode.window.onDidChangeActiveTextEditor(
    updateDecorations,
    null,
    context.subscriptions
  );
  vscode.workspace.onDidChangeTextDocument(
    (e) => {
      if (vscode.window.activeTextEditor?.document === e.document) {
        updateDecorations();
      }
    },
    null,
    context.subscriptions
  );

  context.subscriptions.push(createCmd, codeLensProvider, treeDecorationType);
  updateDecorations();
}

function cleanLine(line: string): string {
  return line.replace(/^[\s\t]*(\/\*+|\*+|\/\/|\*\/)?[\s\t]*/, "").trimEnd();
}

function isTreeLine(rawLine: string): boolean {
  const clean = cleanLine(rawLine);
  return /^([│├└─]|\+\-\-|\|\s|\|\-)/.test(clean);
}

function isPotentialRoot(rawLine: string): boolean {
  const clean = cleanLine(rawLine);
  if (!clean) {
    return false;
  }

  if (/[:;=,'"]/.test(clean)) {
    return false;
  }
  if (
    /^(import|export|const|var|let|class|interface|type|return)/.test(clean)
  ) {
    return false;
  }

  const isPathLike = /^[\w.\-/]+$/.test(clean) || clean.endsWith("/");

  if (clean.includes(" ") && !clean.endsWith("/")) {
    return false;
  }

  return !isTreeLine(rawLine) && isPathLike;
}

function hasTreeContext(doc: vscode.TextDocument, lineIndex: number): boolean {
  const currentLine = doc.lineAt(lineIndex).text;

  if (isTreeLine(currentLine)) {
    return true;
  }

  if (isPotentialRoot(currentLine)) {
    const limit = Math.min(doc.lineCount, lineIndex + 6);
    for (let j = lineIndex + 1; j < limit; j++) {
      const nextLine = doc.lineAt(j).text;
      if (isTreeLine(nextLine)) {
        return true;
      }
      if (
        nextLine.trim() === "" ||
        /^(import|export|const|var|class|interface|type)/.test(nextLine.trim())
      ) {
        return false;
      }
    }
  }
  return false;
}

function extractTreeBlock(text: string): string {
  return text
    .split("\n")
    .map((l) => {
      const cleaned = cleanLine(l);

      if (/^([│├└─]|\+\-\-|\|\s|\|\-)/.test(cleaned)) {
        return cleaned;
      }

      if (/[:;=,'"]/.test(cleaned)) {
        return null;
      }
      if (cleaned.includes(" ") && !cleaned.endsWith("/")) {
        return null;
      }
      if (
        /^(import|export|from|return|interface|type|const|let|var)/.test(
          cleaned
        )
      ) {
        return null;
      }
      if (/^[\w.\-/]+$/.test(cleaned)) {
        return cleaned;
      }

      return null;
    })
    .filter((l) => l !== null)
    .join("\n");
}

function getSmartBlock(editor: vscode.TextEditor): string {
  const doc = editor.document;
  const curr = editor.selection.active.line;

  let start = curr;
  let end = curr;

  while (
    start > 0 &&
    (isTreeLine(doc.lineAt(start - 1).text) ||
      isPotentialRoot(doc.lineAt(start - 1).text))
  ) {
    start--;
  }
  while (
    end < doc.lineCount - 1 &&
    (isTreeLine(doc.lineAt(end + 1).text) ||
      isPotentialRoot(doc.lineAt(end + 1).text))
  ) {
    end++;
  }

  return doc.getText(
    new vscode.Range(start, 0, end, doc.lineAt(end).text.length)
  );
}

async function executeCreationAsync(
  text: string,
  root: string
): Promise<string[]> {
  const lines = text.split("\n");
  const createdPaths: string[] = [];
  const stack: { indent: number; path: string }[] = [];

  for (const rawLine of lines) {
    const result = parseLine(rawLine);
    if (!result) {
      continue;
    }

    const { indent, name, isDir } = result;
    while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    const parent = stack.length > 0 ? stack[stack.length - 1].path : root;
    const currentPath = path.join(parent, name);
    const uri = vscode.Uri.file(currentPath);

    try {
      if (isDir) {
        try {
          await vscode.workspace.fs.createDirectory(uri);
          createdPaths.push(name + "/");
        } catch {}
        stack.push({ indent, path: currentPath });
      } else {
        try {
          await vscode.workspace.fs.stat(uri);
        } catch {
          await vscode.workspace.fs.writeFile(uri, new Uint8Array());
          createdPaths.push(name);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }
  return createdPaths;
}

export function deactivate() {}
