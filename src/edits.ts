import { EOL } from "os";
import { Position, Range, TextEdit } from "vscode";

// Utilities taken from https://github.com/microsoft/vscode-python/blob/main/src/client/common/editor.ts

enum EditAction {
  Delete,
  Insert,
  Replace,
}

const NEW_LINE_LENGTH = EOL.length;

class Edit {
  public action: EditAction;
  public start: Position;
  public end!: Position;
  public text: string;

  constructor(action: number, start: Position) {
    this.action = action;
    this.start = start;
    this.text = "";
  }

  public apply(): TextEdit {
    switch (this.action) {
      case EditAction.Insert:
        return TextEdit.insert(this.start, this.text);
      case EditAction.Delete:
        return TextEdit.delete(new Range(this.start, this.end));
      case EditAction.Replace:
        return TextEdit.replace(new Range(this.start, this.end), this.text);
      default:
        return new TextEdit(
          new Range(new Position(0, 0), new Position(0, 0)),
          ""
        );
    }
  }
}

export function getTextEdits(before: string, after: string): TextEdit[] {
  // tslint:disable-next-line:no-require-imports
  const dmp = require("diff-match-patch") as typeof import("diff-match-patch");
  const d = new dmp.diff_match_patch();
  const diffs = d.diff_main(before, after);
  return getTextEditsInternal(before, diffs).map((edit) => edit.apply());
}
function getTextEditsInternal(
  before: string,
  diffs: [number, string][],
  startLine: number = 0
): Edit[] {
  let line = startLine;
  let character = 0;
  const beforeLines = before.split(/\r?\n/g);
  if (line > 0) {
    beforeLines
      .filter((_l, i) => i < line)
      .forEach((l) => (character += l.length + NEW_LINE_LENGTH));
  }
  const edits: Edit[] = [];
  let edit: Edit | null = null;
  let end: Position;

  // tslint:disable-next-line:prefer-for-of
  for (let i = 0; i < diffs.length; i += 1) {
    let start = new Position(line, character);
    // Compute the line/character after the diff is applied.
    // tslint:disable-next-line:prefer-for-of
    for (let curr = 0; curr < diffs[i][1].length; curr += 1) {
      if (diffs[i][1][curr] !== "\n") {
        character += 1;
      } else {
        character = 0;
        line += 1;
      }
    }

    // tslint:disable-next-line:no-require-imports
    const dmp =
      require("diff-match-patch") as typeof import("diff-match-patch");
    // tslint:disable-next-line:switch-default
    switch (diffs[i][0]) {
      case dmp.DIFF_DELETE:
        if (
          beforeLines[line - 1].length === 0 &&
          beforeLines[start.line - 1] &&
          beforeLines[start.line - 1].length === 0
        ) {
          // We're asked to delete an empty line which only contains `/\r?\n/g`. The last line is also empty.
          // Delete the `\n` from the last line instead of deleting `\n` from the current line
          // This change ensures that the last line in the file, which won't contain `\n` is deleted
          start = new Position(start.line - 1, 0);
          end = new Position(line - 1, 0);
        } else {
          end = new Position(line, character);
        }
        if (edit === null) {
          edit = new Edit(EditAction.Delete, start);
        } else if (edit.action !== EditAction.Delete) {
          throw new Error("cannot format due to an internal error.");
        }
        edit.end = end;
        break;

      case dmp.DIFF_INSERT:
        if (edit === null) {
          edit = new Edit(EditAction.Insert, start);
        } else if (edit.action === EditAction.Delete) {
          edit.action = EditAction.Replace;
        }
        // insert and replace edits are all relative to the original state
        // of the document, so inserts should reset the current line/character
        // position to the start.
        line = start.line;
        character = start.character;
        edit.text += diffs[i][1];
        break;

      case dmp.DIFF_EQUAL:
        if (edit !== null) {
          edits.push(edit);
          edit = null;
        }
        break;
    }
  }

  if (edit !== null) {
    edits.push(edit);
  }

  return edits;
}
