import * as vscode from "vscode";
import { spawn } from "child_process";
import { getTextEdits } from "./edits";
import { ProposedExtensionAPI } from "./types";
import { once } from "events";

const SUPPORTED_DOCUMENT_SELECTOR: vscode.DocumentSelector = [
  "django-html",
  "jinja",
];
const DJHTML_MODULE = "djhtml";

export async function activate(context: vscode.ExtensionContext) {
  const pythonExtension = vscode.extensions.getExtension("ms-python.python");
  if (pythonExtension) {
    if (!pythonExtension.isActive) {
      await pythonExtension.activate();
    }
  } else {
    vscode.window.showErrorMessage(
      "Failed to activate ms-python.python extension"
    );
    return;
  }

  const pythonApi: ProposedExtensionAPI =
    pythonExtension.exports as ProposedExtensionAPI;

  vscode.languages.registerDocumentFormattingEditProvider(
    SUPPORTED_DOCUMENT_SELECTOR,
    {
      async provideDocumentFormattingEdits(
        document: vscode.TextDocument
      ): Promise<vscode.TextEdit[]> {
        const environmentPath = pythonApi.environment.getActiveEnvironmentPath();
        const environment = await pythonApi.environment.resolveEnvironment(environmentPath);

        if (environment && environment.path) {
          let stdout = "";
          let edits: vscode.TextEdit[] = [];
          const process = spawn(environment.path, [
            "-m",
            DJHTML_MODULE,
            document.uri.fsPath,
          ]);

          process.stderr.on("data", (data: String) => {
            if (data.includes(`No module named ${DJHTML_MODULE}`)) {
              vscode.window.showErrorMessage(
                `djhtml is not installed in the current Python environment`
              );
            } else {
              vscode.window.showErrorMessage(
                `djhtml failed with error: ${data}`
              );
            }
          });

          process.stdout.on("data", (data: String) => {
            stdout += data;
          });

          process.on("close", (code) => {
            if (code === 0) {
              edits = getTextEdits(document.getText(), stdout);
            }
          });

          await once(process, "close");
          return edits;
        } else {
          vscode.window.showErrorMessage("No Python environment selected");
        }
        return [];
      },
    }
  );
}
