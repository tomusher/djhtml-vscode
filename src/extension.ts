import * as vscode from "vscode";
import { spawn } from "child_process";
import { resolveSoa } from "dns";

export function activate(context: vscode.ExtensionContext) {
  vscode.languages.registerDocumentFormattingEditProvider("django-html", {
    provideDocumentFormattingEdits(
      document: vscode.TextDocument
    ): Promise<vscode.TextEdit[]> {
      return new Promise<vscode.TextEdit[]>((resolve, _) => {
        let stdout = "";

        const process = spawn("djhtml", [document.uri.fsPath]);

        process.stderr.on("data", (data: String) => {
          vscode.window.showErrorMessage(`djhtml failed with error: ${data}`);
          resolve([]);
        });

        process.stdout.on("data", (data: String) => {
          stdout += data;
        });

        process.on("close", (code) => {
          if (code == 0) {
            const firstLine = document.lineAt(0);
            const lastLine = document.lineAt(document.lineCount - 1);
            const range = new vscode.Range(
              firstLine.range.start,
              lastLine.range.end
            );
            resolve([vscode.TextEdit.replace(range, stdout)]);
          } else {
            resolve([]);
          }
        });
      });
    },
  });
}
