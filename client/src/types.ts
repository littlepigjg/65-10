export interface SyncConfig {
  sourceDir: string;
  targetDir: string;
  syncInterval: number;
  ignoredPatterns: string[];
  autoResolve: boolean;
  conflictStrategy: 'latest' | 'source' | 'target' | 'manual';
}

export interface FileState {
  path: string;
  hash: string;
  size: number;
  mtime: number;
  source: 'source' | 'target';
}

export interface SyncRecord {
  id: string;
  timestamp: number;
  action: 'copy' | 'delete' | 'update' | 'conflict';
  filePath: string;
  source: 'source' | 'target';
  status: 'success' | 'failed' | 'pending';
  message?: string;
}

export interface ConflictFile {
  id: string;
  filePath: string;
  sourceVersion: FileState;
  targetVersion: FileState;
  detectedAt: number;
  resolved: boolean;
  resolution?: 'source' | 'target' | 'merge';
  resolvedAt?: number;
}

export type DiffLineType = 'added' | 'removed' | 'unchanged' | 'modified' | 'empty';

export interface DiffLine {
  type: DiffLineType;
  content: string;
  lineNumber: number;
}

export interface DiffResult {
  additions: number;
  removals: number;
  modifications: number;
  lines: DiffLine[];
}

export interface SideBySideLine {
  content: string;
  type: DiffLineType;
  lineNumber: number;
  pairIndex?: number;
}

export interface SideBySideDiff {
  left: SideBySideLine[];
  right: SideBySideLine[];
  totalLines: number;
  additions: number;
  removals: number;
  modifications: number;
}

export interface LineSelection {
  [pairIndex: number]: 'left' | 'right' | 'both';
}

export interface DiffViewerProps {
  sourceContent: string;
  targetContent: string;
  onSelectionChange?: (selection: LineSelection) => void;
  onMergedContentChange?: (content: string) => void;
  editable?: boolean;
  className?: string;
}

export interface ConflictDiff {
  conflict: ConflictFile;
  sourceContent: string;
  targetContent: string;
  diff: DiffResult;
  sideBySide: {
    left: SideBySideLine[];
    right: SideBySideLine[];
  };
}

export interface SyncStatus {
  isRunning: boolean;
  sourceDir: string;
  targetDir: string;
  lastSyncTime: number;
  pendingSyncCount: number;
  conflictCount: number;
  totalFiles: number;
  recentRecords: SyncRecord[];
}
