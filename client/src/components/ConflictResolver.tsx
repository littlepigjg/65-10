import { useState, useEffect } from 'react';
import { conflictsApi } from '../api';
import { ConflictDiff, LineSelection } from '../types';
import DiffViewer from './DiffViewer';

interface ConflictResolverProps {
  conflictId: string;
  onBack: () => void;
  onResolved: () => void;
}

export default function ConflictResolver({ conflictId, onBack, onResolved }: ConflictResolverProps) {
  const [diffData, setDiffData] = useState<ConflictDiff | null>(null);
  const [mergedContent, setMergedContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    loadDiff();
  }, [conflictId]);

  async function loadDiff() {
    setLoading(true);
    try {
      const data = await conflictsApi.getDiff(conflictId);
      setDiffData(data);
      setMergedContent(data.targetContent);
    } finally {
      setLoading(false);
    }
  }

  async function handleResolve(resolution: 'source' | 'target' | 'merge') {
    if (resolving) return;

    setResolving(true);
    try {
      await conflictsApi.resolve(
        conflictId,
        resolution,
        resolution === 'merge' ? mergedContent : undefined
      );
      onResolved();
    } catch (error: any) {
      alert('解决冲突失败: ' + error.message);
    } finally {
      setResolving(false);
    }
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!diffData) {
    return (
      <div className="card">
        <div className="empty-state">
          <div className="icon">❌</div>
          <h3>加载失败</h3>
          <p>无法加载冲突详情</p>
          <button className="btn btn-primary" onClick={onBack} style={{ marginTop: '16px' }}>
            ← 返回列表
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <div>
            <button
              className="btn btn-secondary"
              onClick={onBack}
              style={{ marginRight: '12px' }}
            >
              ← 返回列表
            </button>
            <span style={{ fontSize: '16px', fontWeight: '600' }}>
              📄 {diffData.conflict.filePath}
            </span>
          </div>
        </div>

        <DiffViewer
          sourceContent={diffData.sourceContent}
          targetContent={diffData.targetContent}
          onMergedContentChange={setMergedContent}
          editable={true}
        />

        <div className="resolve-actions">
          <button
            className="btn btn-danger"
            onClick={() => handleResolve('source')}
            disabled={resolving}
          >
            📂 保留源目录版本
          </button>
          <button
            className="btn btn-success"
            onClick={() => handleResolve('target')}
            disabled={resolving}
          >
            🎯 保留目标目录版本
          </button>
          <button
            className="btn btn-primary"
            onClick={() => handleResolve('merge')}
            disabled={resolving}
          >
            💾 使用合并版本
          </button>
        </div>
      </div>
    </div>
  );
}
