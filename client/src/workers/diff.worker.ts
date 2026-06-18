import { computeSideBySideDiff, buildMergedContent, getDefaultSelection } from '../utils/diffUtils';
import { SideBySideDiff, LineSelection } from '../types';

type WorkerRequest =
  | {
      id: string;
      type: 'compute-diff';
      sourceContent: string;
      targetContent: string;
    }
  | {
      id: string;
      type: 'build-merged';
      sideBySide: SideBySideDiff;
      selection: LineSelection;
    }
  | {
      id: string;
      type: 'get-default-selection';
      sideBySide: SideBySideDiff;
    };

type WorkerResponse =
  | {
      id: string;
      type: 'compute-diff-result';
      data: SideBySideDiff;
    }
  | {
      id: string;
      type: 'build-merged-result';
      data: string;
    }
  | {
      id: string;
      type: 'get-default-selection-result';
      data: LineSelection;
    }
  | {
      id: string;
      type: 'error';
      error: string;
    };

const ctx: Worker = self as unknown as Worker;

ctx.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;

  try {
    switch (request.type) {
      case 'compute-diff': {
        const result = computeSideBySideDiff(request.sourceContent, request.targetContent);
        const response: WorkerResponse = {
          id: request.id,
          type: 'compute-diff-result',
          data: result,
        };
        ctx.postMessage(response);
        break;
      }
      case 'build-merged': {
        const result = buildMergedContent(request.sideBySide, request.selection);
        const response: WorkerResponse = {
          id: request.id,
          type: 'build-merged-result',
          data: result,
        };
        ctx.postMessage(response);
        break;
      }
      case 'get-default-selection': {
        const result = getDefaultSelection(request.sideBySide);
        const response: WorkerResponse = {
          id: request.id,
          type: 'get-default-selection-result',
          data: result,
        };
        ctx.postMessage(response);
        break;
      }
      default:
        throw new Error(`Unknown request type: ${(request as any).type}`);
    }
  } catch (error: any) {
    const response: WorkerResponse = {
      id: request.id,
      type: 'error',
      error: error.message || String(error),
    };
    ctx.postMessage(response);
  }
});

export {};
