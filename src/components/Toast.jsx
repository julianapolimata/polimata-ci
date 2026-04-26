import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

// Toast component for individual toast display
function ToastItem({ id, type, message, duration, onDismiss }) {
  const [isExiting, setIsExiting] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onDismiss(id), 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [id, duration, onDismiss]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => onDismiss(id), 300);
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M16.667 5L7.5 14.167L3.333 10"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        );
      case 'error':
        return (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M15 5L5 15M5 5L15 15"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        );
      case 'warning':
        return (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M10 6.5V10M10 13.5H10.01M10 2L2 17h16L10 2Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        );
      case 'info':
        return (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M10 6.5H10.01M10 10V14.5M10 2C5.58 2 2 5.58 2 10s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className={`toast toast--${type} ${isExiting ? 'toast--exiting' : ''}`}
      role="alert"
      aria-live="polite"
    >
      <div className="toast__content">
        <div className="toast__icon">{getIcon()}</div>
        <span className="toast__message">{message}</span>
      </div>
      <button
        className="toast__close"
        onClick={handleDismiss}
        aria-label="Dismiss notification"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M12 4L4 12M4 4L12 12"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
      <div className="toast__progress"></div>
    </div>
  );
}

// Toast Portal Component
function ToastPortal({ toasts, onDismiss }) {
  return (
    <div className="toast-container">
      <style>{`
        .toast-container {
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 9999;
          pointer-events: none;
          max-width: 400px;
        }

        .toast {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          margin-bottom: 12px;
          border-radius: var(--radius-sm);
          background: var(--lt-card);
          border: 1px solid var(--lt-border);
          box-shadow: var(--lt-shadow);
          pointer-events: auto;
          animation: toastSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          overflow: hidden;
        }

        .toast--exiting {
          animation: toastSlideOut 0.3s cubic-bezier(0.7, 0, 0.84, 0) forwards;
        }

        @keyframes toastSlideIn {
          from {
            opacity: 0;
            transform: translateX(400px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes toastSlideOut {
          from {
            opacity: 1;
            transform: translateX(0);
          }
          to {
            opacity: 0;
            transform: translateX(400px);
          }
        }

        .toast__content {
          display: flex;
          align-items: center;
          gap: 12px;
          flex: 1;
        }

        .toast__icon {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          width: 20px;
          height: 20px;
        }

        .toast--success .toast__icon {
          color: #22D4A0;
        }

        .toast--error .toast__icon {
          color: #EF4444;
        }

        .toast--warning .toast__icon {
          color: #F97316;
        }

        .toast--info .toast__icon {
          color: #5B8FF9;
        }

        .toast__message {
          font-family: 'Montserrat', sans-serif;
          font-size: 14px;
          font-weight: 500;
          color: var(--lt-text);
          line-height: 1.4;
        }

        .toast__close {
          flex-shrink: 0;
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
          margin-left: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--lt-text3);
          transition: color 0.2s ease;
        }

        .toast__close:hover {
          color: var(--lt-text);
        }

        .toast__progress {
          position: absolute;
          bottom: 0;
          left: 0;
          height: 3px;
          background: linear-gradient(90deg, var(--copper) 0%, var(--copper-soft) 100%);
          animation: toastProgress linear forwards;
        }

        .toast--success .toast__progress {
          background: #22D4A0;
        }

        .toast--error .toast__progress {
          background: #EF4444;
        }

        .toast--warning .toast__progress {
          background: #F97316;
        }

        .toast--info .toast__progress {
          background: #5B8FF9;
        }

        @keyframes toastProgress {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }

        @media (max-width: 640px) {
          .toast-container {
            top: 16px;
            right: 16px;
            left: 16px;
            max-width: none;
          }

          .toast {
            margin-bottom: 10px;
            padding: 12px 12px;
          }

          .toast__message {
            font-size: 13px;
          }
        }
      `}</style>
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          id={toast.id}
          type={toast.type}
          message={toast.message}
          duration={toast.duration}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  );
}

// Toast Provider Component
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback(
    ({ type = 'info', message = '', duration = null }) => {
      const id = Date.now();
      const defaultDurations = {
        success: 4000,
        info: 4000,
        warning: 6000,
        error: 6000,
      };
      const finalDuration = duration ?? defaultDurations[type] ?? 4000;

      setToasts((prev) => {
        const updated = [...prev, { id, type, message, duration: finalDuration }];
        // Keep only last 3 toasts
        return updated.slice(-3);
      });

      return id;
    },
    []
  );

  const onDismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <ToastPortal toasts={toasts} onDismiss={onDismiss} />
    </ToastContext.Provider>
  );
}

// Hook to use toast
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}
