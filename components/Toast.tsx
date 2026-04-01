'use client';

import { useApp } from '@/lib/store';
import styles from './Toast.module.css';

export default function ToastContainer() {
  const { toasts } = useApp();

  if (toasts.length === 0) return null;

  return (
    <div className={styles.container}>
      {toasts.map((toast) => (
        <div key={toast.id} className={`${styles.toast} ${styles[toast.type]}`}>
          <div className={styles.title}>{toast.title}</div>
          <div className={styles.message}>{toast.message}</div>
        </div>
      ))}
    </div>
  );
}
