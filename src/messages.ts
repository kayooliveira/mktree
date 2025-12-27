import * as nls from 'vscode-nls';

const localize = nls.config({ messageFormat: nls.MessageFormat.file })();

export const msg = {
  success: () => localize('mktree.success', 'Structure created successfully!'),
  error: (err: string) => localize('mktree.error', 'Error creating structure: {0}', err),
  invalid: () => localize('mktree.invalid', 'MkTree: Validation errors found'),
  creating: () => localize('mktree.creating', 'MkTree: Creating files...'),
  noWorkspace: () => localize('mktree.noWorkspace', 'Please open a workspace folder first.'),
  lensTitle: () => localize('mktree.lensTitle', '🌳 Create this structure'),
  duplicatePath: (line: number, name: string) => 
        localize('mktree.duplicatePath', 'Line {0}: Duplicate path -> "{1}"', line, name),
  createdPaths: () => localize('mktree.createdPaths', 'Created paths:'),
  nothingCreated: () => localize('mktree.nothingCreated', 'No files or folders were created.'),
};