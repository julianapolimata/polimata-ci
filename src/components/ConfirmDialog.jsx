import React, { createContext, useContext, useState } from 'react';

const ConfirmContext = createContext(null);

// Confirm Dialog Component
function ConfirmDialogContent({
  title,
  message,
  confirmText,
  cancelText,
  variant,
  onConfirm,
  onCancel,
}) {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onConfirm();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  React.useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onConfirm, onCancel]);

  return (
    <>
      <style>{`
        .confirm-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 32, 62, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          animation: confirmOverlayFadeIn 0.2s ease-out forwards;
        }

        @keyframes confirmOverlayFadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .confirm-dialog {
          background: var(--lt-card);
          border: 1px solid var(--lt-border);
          border-radius: var(--radius);
          box-shadow: var(--lt-shadow-lg);
          max-width: 500px;
          width: 90%;
          max-height: 80vh;
          padding: 32px;
          display: flex;
          flex-direction: column;
          gap: 24px;
          animation: confirmDialogSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes confirmDialogSlideIn {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(-20px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        .confirm-header {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .confirm-title {
          font-family: 'Raleway', sans-serif;
          font-size: 20px;
          font-weight: 600;
          color: var(--lt-text);
          margin: 0;
        }

        .confirm-message {
          font-family: 'Montserrat', sans-serif;
          font-size: 14px;
          color: var(--lt-text2);
          line-height: 1.6;
          margin: 0;
        }

        .confirm-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }

        .confirm-button {
          font-family: 'Montserrat', sans-serif;
          font-size: 14px;
          font-weight: 600;
          padding: 10px 20px;
          border-radius: var(--radius-sm);
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
          min-width: 100px;
          text-align: center;
        }

        .confirm-button:hover {
          transform: translateY(-1px);
        }

        .confirm-button:active {
          transform: translateY(0);
        }

        .confirm-cancel {
          background: var(--lt-elevated);
          color: var(--lt-text);
          border: 1px solid var(--lt-border);
        }

        .confirm-cancel:hover {
          background: var(--lt-hover);
        }

        .confirm-confirm {
          background: var(--copper);
          color: white;
          font-weight: 700;
        }

        .confirm-confirm:hover {
          background: var(--copper-soft);
        }

        .confirm-confirm.danger {
          background: #EF4444;
        }

        .confirm-confirm.danger:hover {
          background: #DC2626;
        }

        @media (max-width: 640px) {
          .confirm-dialog {
            width: 95%;
            padding: 24px;
            gap: 20px;
          }

          .confirm-title {
            font-size: 18px;
          }

          .confirm-actions {
            flex-direction: column-reverse;
          }

          .confirm-button {
            min-width: auto;
            flex: 1;
          }
        }
      `}</style>
      <div className="confirm-overlay" onClick={onCancel}>
        <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
          <div className="confirm-header">
            {title && <h2 className="confirm-title">{title}</h2>}
            {message && <p className="confirm-message">{message}</p>}
          </div>
          <div className="confirm-actions">
            <button className="confirm-button confirm-cancel" onClick={onCancel}>
              {cancelText || 'Cancel'}
            </button>
            <button
              className={`confirm-button confirm-confirm ${variant === 'danger' ? 'danger' : ''}`}
              onClick={onConfirm}
            >
              {confirmText || 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// Confirm Provider Component
export function ConfirmProvider({ children }) {
  const [pendingConfirm, setPendingConfirm] = useState(null);

  const confirm = (options) => {
    return new Promise((resolve) => {
      setPendingConfirm({
        ...options,
        onConfirm: () => {
          setPendingConfirm(null);
          resolve(true);
        },
        onCancel: () => {
          setPendingConfirm(null);
          resolve(false);
        },
      });
    });
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {pendingConfirm && (
        <ConfirmDialogContent
          title={pendingConfirm.title}
          message={pendingConfirm.message}
          confirmText={pendingConfirm.confirmText}
          cancelText={pendingConfirm.cancelText}
          variant={pendingConfirm.variant}
          onConfirm={pendingConfirm.onConfirm}
          onCancel={pendingConfirm.onCancel}
        />
      )}
    </ConfirmContext.Provider>
  );
}

// Hook to use confirm dialog
export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within ConfirmProvider');
  }
  return context;
}
