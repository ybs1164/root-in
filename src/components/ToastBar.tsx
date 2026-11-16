import type { Toast } from '../hooks/useToast';

/** The toast at the bottom of the screen (hooks/useToast), with 되돌리기 when what it tells of can be undone. */
export default function ToastBar({ toast, onDismiss }: { toast: Toast | null; onDismiss: () => void }) {
  return (
    <div className={`toast ${toast ? 'toast--on' : ''} ${toast?.undo ? 'toast--action' : ''}`} role="status" aria-live="polite">
      {toast?.text}
      {toast?.undo && (
        <button
          className="toast__undo"
          onClick={() => {
            toast.undo?.();
            onDismiss();
          }}
        >
          되돌리기
        </button>
      )}
    </div>
  );
}
