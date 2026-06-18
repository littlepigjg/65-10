import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { VirtualList } from './VirtualList';
import { diffWorkerManager } from '../utils/diffWorkerManager';
import {
  SideBySideDiff,
  SideBySideLine,
  LineSelection,
  DiffViewerProps,
} from '../types';

const LINE_HEIGHT = 24;
const LARGE_FILE_THRESHOLD = 1000;

export default function DiffViewer({
  sourceContent,
  targetContent,
  onSelectionChange,
  onMergedContentChange,
  editable = true,
  className,
}: DiffViewerProps) {
  const [sideBySide, setSideBySide] = useState<SideBySideDiff | null>(null);
  const [selection, setSelection] = useState<LineSelection>({});
  const [loading, setLoading] = useState(true);
  const [leftScrollTop, setLeftScrollTop] = useState(0);
  const [rightScrollTop, setRightScrollTop] = useState(0);
  const [mergedContent, setMergedContent] = useState('');
  const [mergeMode, setMergeMode] = useState<'select' | 'edit'>('select');
  const [isSyncingScroll, setIsSyncingScroll] = useState(false);
  const isLargeFile = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const diff = await diffWorkerManager.computeDiff(sourceContent, targetContent);
        if (cancelled) return;
        isLargeFile.current = diff.totalLines > LARGE_FILE_THRESHOLD;
        setSideBySide(diff);
        const defaultSel = await diffWorkerManager.getDefaultSelection(diff);
        if (cancelled) return;
        setSelection(defaultSel);
        const merged = await diffWorkerManager.buildMerged(diff, defaultSel);
        if (cancelled) return;
        setMergedContent(merged);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [sourceContent, targetContent]);

  useEffect(() => {
    if (sideBySide) {
      diffWorkerManager.buildMerged(sideBySide, selection).then((content) => {
        setMergedContent(content);
        onMergedContentChange?.(content);
      });
    }
  }, [selection, sideBySide, onMergedContentChange]);

  useEffect(() => {
    onSelectionChange?.(selection);
  }, [selection, onSelectionChange]);

  const toggleLineSelection = useCallback(
    (pairIndex: number, side: 'left' | 'right') => {
      if (!editable) return;
      setSelection((prev) => {
        const current = prev[pairIndex];
        const leftLine = sideBySide?.left[pairIndex];
        const rightLine = sideBySide?.right[pairIndex];
        const hasLeft = leftLine && leftLine.type !== 'empty';
        const hasRight = rightLine && rightLine.type !== 'empty';

        let next: 'left' | 'right' | 'both';
        if (current === side) {
          if (side === 'left' && hasRight) {
            next = 'right';
          } else if (side === 'right' && hasLeft) {
            next = 'left';
          } else if (hasLeft && hasRight) {
            next = 'both';
          } else {
            next = side;
          }
        } else if (current === 'both') {
          next = side;
        } else {
          next = 'both';
        }

        return { ...prev, [pairIndex]: next };
      });
    },
    [editable, sideBySide]
  );

  const handleLeftScroll = useCallback((scrollTop: number) => {
    if (isSyncingScroll) return;
    setIsSyncingScroll(true);
    setLeftScrollTop(scrollTop);
    setRightScrollTop(scrollTop);
    requestAnimationFrame(() => setIsSyncingScroll(false));
  }, [isSyncingScroll]);

  const handleRightScroll = useCallback((scrollTop: number) => {
    if (isSyncingScroll) return;
    setIsSyncingScroll(true);
    setRightScrollTop(scrollTop);
    setLeftScrollTop(scrollTop);
    requestAnimationFrame(() => setIsSyncingScroll(false));
  }, [isSyncingScroll]);

  const stats = useMemo(() => {
    if (!sideBySide) return { additions: 0, removals: 0, modifications: 0 };
    return {
      additions: sideBySide.additions,
      removals: sideBySide.removals,
      modifications: sideBySide.modifications,
    };
  }, [sideBySide]);

  const renderLine = useCallback(
    (
      line: SideBySideLine,
      index: number,
      side: 'left' | 'right'
    ) => {
      const pairIndex = line.pairIndex ?? index;
      const isSelected = selection[pairIndex] === side || selection[pairIndex] === 'both';
      const isConflict =
        line.type === 'added' ||
        line.type === 'removed' ||
        line.type === 'modified';
      const isClickable = editable && isConflict;

      const lineClasses = [
        'dv-line',
        `dv-line-${line.type}`,
        isSelected && isConflict ? 'dv-line-selected' : '',
        isClickable ? 'dv-line-clickable' : '',
      ]
        .filter(Boolean)
        .join(' ');

      return (
        <div
          className={lineClasses}
          onClick={isClickable ? () => toggleLineSelection(pairIndex, side) : undefined}
          title={
            isClickable
              ? `点击保留${side === 'left' ? '源' : '目标'}版本，再次点击切换或选择两者`
              : undefined
          }
        >
          <span className="dv-line-number">{line.lineNumber || ''}</span>
          {isConflict && editable && (
            <span className="dv-line-action">
              {isSelected ? '✓' : ''}
            </span>
          )}
          <span className="dv-line-content">{line.content || '\u00A0'}</span>
        </div>
      );
    },
    [selection, editable, toggleLineSelection]
  );

  const renderLeftLine = useCallback(
    (item: SideBySideLine, index: number) => renderLine(item, index, 'left'),
    [renderLine]
  );

  const renderRightLine = useCallback(
    (item: SideBySideLine, index: number) => renderLine(item, index, 'right'),
    [renderLine]
  );

  if (loading) {
    return (
      <div className={`dv-loading ${className || ''}`}>
        <div className="spinner"></div>
        <span>正在分析差异...</span>
      </div>
    );
  }

  if (!sideBySide) {
    return (
      <div className={`dv-empty ${className || ''}`}>
        无法加载差异数据
      </div>
    );
  }

  return (
    <div className={`dv-container ${className || ''}`}>
      <div className="dv-toolbar">
        <div className="dv-stats">
          <span className="dv-stat dv-stat-added">
            <span className="dv-stat-icon">+</span>
            <span className="dv-stat-value">{stats.additions}</span>
            <span className="dv-stat-label">新增</span>
          </span>
          <span className="dv-stat dv-stat-removed">
            <span className="dv-stat-icon">−</span>
            <span className="dv-stat-value">{stats.removals}</span>
            <span className="dv-stat-label">删除</span>
          </span>
          <span className="dv-stat dv-stat-modified">
            <span className="dv-stat-icon">~</span>
            <span className="dv-stat-value">{stats.modifications}</span>
            <span className="dv-stat-label">修改</span>
          </span>
          <span className="dv-stat dv-stat-total">
            <span className="dv-stat-value">{sideBySide.totalLines}</span>
            <span className="dv-stat-label">总行</span>
          </span>
        </div>
        {editable && (
          <div className="dv-mode-switch">
            <button
              className={mergeMode === 'select' ? 'active' : ''}
              onClick={() => setMergeMode('select')}
            >
              🎯 行选择
            </button>
            <button
              className={mergeMode === 'edit' ? 'active' : ''}
              onClick={() => setMergeMode('edit')}
            >
              ✏️ 手动编辑
            </button>
          </div>
        )}
      </div>

      {mergeMode === 'select' ? (
        <div className="dv-panes">
          <div className="dv-pane dv-pane-left">
            <div className="dv-pane-header dv-pane-header-source">
              <span>📂 源目录版本</span>
              <span className="dv-pane-line-count">
                {sideBySide.left.filter((l) => l.lineNumber > 0).length} 行
              </span>
            </div>
            <div className="dv-pane-body">
              <VirtualList
                items={sideBySide.left}
                itemHeight={LINE_HEIGHT}
                renderItem={renderLeftLine}
                scrollTop={leftScrollTop}
                onScroll={handleLeftScroll}
                overscan={isLargeFile.current ? 20 : 10}
                getKey={(_, i) => `l-${i}`}
                className="dv-virtual-list"
              />
            </div>
          </div>

          <div className="dv-pane-divider" />

          <div className="dv-pane dv-pane-right">
            <div className="dv-pane-header dv-pane-header-target">
              <span>🎯 目标目录版本</span>
              <span className="dv-pane-line-count">
                {sideBySide.right.filter((l) => l.lineNumber > 0).length} 行
              </span>
            </div>
            <div className="dv-pane-body">
              <VirtualList
                items={sideBySide.right}
                itemHeight={LINE_HEIGHT}
                renderItem={renderRightLine}
                scrollTop={rightScrollTop}
                onScroll={handleRightScroll}
                overscan={isLargeFile.current ? 20 : 10}
                getKey={(_, i) => `r-${i}`}
                className="dv-virtual-list"
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="dv-merge-editor">
          <div className="dv-merge-editor-header">
            <label>✏️ 合并后的内容</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setMergedContent(sourceContent)}
              >
                📂 使用源版本
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setMergedContent(targetContent)}
              >
                🎯 使用目标版本
              </button>
            </div>
          </div>
          <textarea
            className="dv-merge-textarea"
            value={mergedContent}
            onChange={(e) => {
              setMergedContent(e.target.value);
              onMergedContentChange?.(e.target.value);
            }}
            placeholder="在此编辑合并后的内容..."
            spellCheck={false}
          />
        </div>
      )}

      {mergeMode === 'select' && editable && (
        <div className="dv-preview">
          <div className="dv-preview-header">
            <span>📄 合并预览 ({mergedContent.split('\n').length} 行)</span>
          </div>
          <pre className="dv-preview-content">{mergedContent}</pre>
        </div>
      )}
    </div>
  );
}
