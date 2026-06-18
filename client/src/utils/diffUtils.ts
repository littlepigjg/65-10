import { diffLines, Change } from 'diff';
import {
  DiffLine,
  DiffLineType,
  DiffResult,
  SideBySideDiff,
  SideBySideLine,
  LineSelection,
} from '../types';

function splitLines(text: string): string[] {
  const lines = text.split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }
  return lines;
}

function detectModifications(changes: Change[]): Change[] {
  const result: Change[] = [];
  let i = 0;

  while (i < changes.length) {
    const current = changes[i];
    const next = changes[i + 1];

    if (
      current &&
      next &&
      current.removed &&
      next.added
    ) {
      const removedLines = splitLines(current.value);
      const addedLines = splitLines(next.value);

      if (removedLines.length === addedLines.length) {
        for (let j = 0; j < removedLines.length; j++) {
          result.push({
            value: removedLines[j] + '\n',
            removed: true,
            modified: true,
          } as Change & { modified?: boolean });
          result.push({
            value: addedLines[j] + '\n',
            added: true,
            modified: true,
          } as Change & { modified?: boolean });
        }
        i += 2;
        continue;
      }
    }

    result.push(current);
    i++;
  }

  return result;
}

export function computeDiff(sourceContent: string, targetContent: string): DiffResult {
  const rawChanges = diffLines(sourceContent, targetContent);
  const changes = detectModifications(rawChanges);

  const lines: DiffLine[] = [];
  let additions = 0;
  let removals = 0;
  let modifications = 0;
  let sourceLineNumber = 1;
  let targetLineNumber = 1;

  for (let i = 0; i < changes.length; i++) {
    const change = changes[i];
    const changeLines = splitLines(change.value);
    const isModified = (change as any).modified;

    for (const lineContent of changeLines) {
      if (change.added) {
        let type: DiffLineType = 'added';
        if (isModified) {
          type = 'modified';
          modifications++;
        } else {
          additions++;
        }
        lines.push({
          type,
          content: lineContent,
          lineNumber: targetLineNumber,
        });
        targetLineNumber++;
      } else if (change.removed) {
        let type: DiffLineType = 'removed';
        if (isModified) {
          type = 'modified';
        } else {
          removals++;
        }
        lines.push({
          type,
          content: lineContent,
          lineNumber: sourceLineNumber,
        });
        sourceLineNumber++;
      } else {
        lines.push({
          type: 'unchanged',
          content: lineContent,
          lineNumber: sourceLineNumber,
        });
        sourceLineNumber++;
        targetLineNumber++;
      }
    }
  }

  return {
    additions,
    removals,
    modifications,
    lines,
  };
}

export function computeSideBySideDiff(
  sourceContent: string,
  targetContent: string
): SideBySideDiff {
  const rawChanges = diffLines(sourceContent, targetContent);
  const changes = detectModifications(rawChanges);

  const left: SideBySideLine[] = [];
  const right: SideBySideLine[] = [];
  let leftLine = 1;
  let rightLine = 1;
  let additions = 0;
  let removals = 0;
  let modifications = 0;
  let pairIndex = 0;

  for (let i = 0; i < changes.length; i++) {
    const change = changes[i];
    const changeLines = splitLines(change.value);
    const isModified = (change as any).modified;

    for (const lineContent of changeLines) {
      if (change.added) {
        let type: DiffLineType = 'added';
        if (isModified) {
          type = 'modified';
          modifications++;
        } else {
          additions++;
        }
        left.push({
          content: '',
          type: 'empty',
          lineNumber: 0,
          pairIndex,
        });
        right.push({
          content: lineContent,
          type,
          lineNumber: rightLine,
          pairIndex,
        });
        rightLine++;
        pairIndex++;
      } else if (change.removed) {
        let type: DiffLineType = 'removed';
        if (isModified) {
          type = 'modified';
        } else {
          removals++;
        }
        left.push({
          content: lineContent,
          type,
          lineNumber: leftLine,
          pairIndex,
        });
        right.push({
          content: '',
          type: 'empty',
          lineNumber: 0,
          pairIndex,
        });
        leftLine++;
        pairIndex++;
      } else {
        left.push({
          content: lineContent,
          type: 'unchanged',
          lineNumber: leftLine,
          pairIndex,
        });
        right.push({
          content: lineContent,
          type: 'unchanged',
          lineNumber: rightLine,
          pairIndex,
        });
        leftLine++;
        rightLine++;
        pairIndex++;
      }
    }
  }

  return {
    left,
    right,
    totalLines: pairIndex,
    additions,
    removals,
    modifications,
  };
}

export function buildMergedContent(
  sideBySide: SideBySideDiff,
  selection: LineSelection
): string {
  const result: string[] = [];
  const { left, right } = sideBySide;

  for (let i = 0; i < left.length; i++) {
    const leftLine = left[i];
    const rightLine = right[i];
    const sel = selection[i] ?? 'right';

    if (leftLine.type === 'unchanged' && rightLine.type === 'unchanged') {
      result.push(leftLine.content);
      continue;
    }

    if (sel === 'left') {
      if (leftLine.type !== 'empty' && leftLine.content !== undefined) {
        result.push(leftLine.content);
      }
    } else if (sel === 'right') {
      if (rightLine.type !== 'empty' && rightLine.content !== undefined) {
        result.push(rightLine.content);
      }
    } else if (sel === 'both') {
      if (leftLine.type !== 'empty' && leftLine.content !== undefined) {
        result.push(leftLine.content);
      }
      if (rightLine.type !== 'empty' && rightLine.content !== undefined) {
        result.push(rightLine.content);
      }
    }
  }

  return result.join('\n');
}

export function getDefaultSelection(sideBySide: SideBySideDiff): LineSelection {
  const selection: LineSelection = {};
  const { left, right } = sideBySide;

  for (let i = 0; i < left.length; i++) {
    const leftLine = left[i];
    const rightLine = right[i];

    if (leftLine.type === 'unchanged' && rightLine.type === 'unchanged') {
      continue;
    }

    if (leftLine.type === 'empty') {
      selection[i] = 'right';
    } else if (rightLine.type === 'empty') {
      selection[i] = 'left';
    } else {
      selection[i] = 'right';
    }
  }

  return selection;
}
