import { useState, useCallback, useImperativeHandle } from 'react';

let toastId = 0;

export function useToast() {
  const [toasts, setToasts] = useState([]);

  const show = useCallback((msg, type = 'success', duration = 3000) => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, hiding: true } : t));
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 280);
    }, duration);
  }, []);

  return { toasts, show };
}

export function ToastContainer({ toasts }) {
  const icon = { success: '✓', warn: '📶', error: '✗' };
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}${t.hiding ? ' hiding' : ''}`}>
          <span>{icon[t.type] || '✓'}</span>
          <span>{t.msg}</span>
        </div>
      ))}
    </div>
  );
}
