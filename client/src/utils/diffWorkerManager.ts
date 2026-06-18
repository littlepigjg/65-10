import { SideBySideDiff, LineSelection } from '../types';

type DiffWorkerRequest =
  | { type: 'compute-diff'; sourceContent: string; targetContent: string }
  | { type: 'build-merged'; sideBySide: SideBySideDiff; selection: LineSelection }
  | { type: 'get-default-selection'; sideBySide: SideBySideDiff };

type DiffWorkerResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string };

class DiffWorkerManager {
  private worker: Worker | null = null;
  private pendingRequests = new Map<string, (response: DiffWorkerResponse<any>) => void>();
  private useWorker = typeof Worker !== 'undefined';

  private getWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(new URL('../workers/diff.worker.ts', import.meta.url), {
        type: 'module',
      });
      this.worker.onmessage = (event) => {
        const { id, type, data, error } = event.data;
        const resolver = this.pendingRequests.get(id);
        if (resolver) {
          if (type === 'error') {
            resolver({ success: false, error });
          } else {
            resolver({ success: true, data });
          }
          this.pendingRequests.delete(id);
        }
      };
      this.worker.onerror = (error) => {
        console.error('Diff Worker error:', error);
        this.pendingRequests.forEach((resolver) => {
          resolver({ success: false, error: error.message });
        });
        this.pendingRequests.clear();
      };
    }
    return this.worker;
  }

  private async request<T>(
    message: DiffWorkerRequest,
    fallback: () => Promise<T>
  ): Promise<T> {
    if (!this.useWorker) {
      return fallback();
    }

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        fallback().then(resolve, reject);
      }, 5000);

      this.pendingRequests.set(id, (response: DiffWorkerResponse<T>) => {
        clearTimeout(timeout);
        if (response.success) {
          resolve(response.data);
        } else {
          fallback().then(resolve, reject);
        }
      });

      try {
        this.getWorker().postMessage({ id, ...message });
      } catch {
        clearTimeout(timeout);
        this.pendingRequests.delete(id);
        fallback().then(resolve, reject);
      }
    });
  }

  async computeDiff(sourceContent: string, targetContent: string): Promise<SideBySideDiff> {
    return this.request(
      { type: 'compute-diff', sourceContent, targetContent },
      async () => {
        const { computeSideBySideDiff } = await import('../utils/diffUtils');
        return computeSideBySideDiff(sourceContent, targetContent);
      }
    );
  }

  async buildMerged(sideBySide: SideBySideDiff, selection: LineSelection): Promise<string> {
    return this.request(
      { type: 'build-merged', sideBySide, selection },
      async () => {
        const { buildMergedContent } = await import('../utils/diffUtils');
        return buildMergedContent(sideBySide, selection);
      }
    );
  }

  async getDefaultSelection(sideBySide: SideBySideDiff): Promise<LineSelection> {
    return this.request(
      { type: 'get-default-selection', sideBySide },
      async () => {
        const { getDefaultSelection } = await import('../utils/diffUtils');
        return getDefaultSelection(sideBySide);
      }
    );
  }

  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.pendingRequests.clear();
  }
}

export const diffWorkerManager = new DiffWorkerManager();
