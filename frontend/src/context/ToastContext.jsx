import React, { createContext, useState, useContext } from 'react';
import { CheckCircle, AlertCircle, Info } from 'lucide-react';

const ToastContext = createContext();

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = (type, message) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, type, message }]);
    
    // Auto dismiss after 4 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const success = (msg) => addToast('success', msg);
  const error = (msg) => addToast('error', msg);
  const info = (msg) => addToast('info', msg);

  const getIcon = (type) => {
    if (type === 'success') return <CheckCircle size={18} style={{ color: 'var(--success)' }} />;
    if (type === 'error') return <AlertCircle size={18} style={{ color: 'var(--danger)' }} />;
    return <Info size={18} style={{ color: 'var(--primary)' }} />;
  };

  return (
    <ToastContext.Provider value={{ success, error, info }}>
      {children}
      
      {/* Premium custom toast container */}
      <div className="custom-toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`custom-toast ${t.type}`}>
            {getIcon(t.type)}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};
