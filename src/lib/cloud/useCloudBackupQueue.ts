import { useEffect, useRef, type MutableRefObject } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import type { DataChangeEvent } from '../cache/invalidation';
import { isCloudBackupSuppressed } from './cloudBackupState';

interface CloudBackupQueueOptions {
  performCloudUpload: (options?: { reason?: string; markDirty?: boolean; force?: boolean }) => Promise<void>;
}

const DEBOUNCE_MS = 1500;
const MAX_WAIT_MS = 10000;
const MAX_TOAST_FAILURES = 3;

export function useCloudBackupQueue({ performCloudUpload }: CloudBackupQueueOptions) {
  const { user } = useAuth();
  const { toast } = useToast();

  const debounceTimer = useRef<number | null>(null);
  const maxWaitTimer = useRef<number | null>(null);
  const retryTimer = useRef<number | null>(null);
  const isUploading = useRef(false);
  const pendingAfterRun = useRef(false);
  const pendingReason = useRef<string>('data-change');
  const failureCount = useRef(0);

  const clearTimer = (timer: MutableRefObject<number | null>) => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const markDirty = async () => {
    if (!window.api?.setSystemMeta) return;
    await window.api.setSystemMeta('cloud_backup_dirty', '1');
  };

  const runUpload = async () => {
    clearTimer(debounceTimer);
    clearTimer(maxWaitTimer);

    if (isCloudBackupSuppressed()) return;

    if (isUploading.current) {
      pendingAfterRun.current = true;
      return;
    }

    if (!user) return;

    isUploading.current = true;
    try {
      await performCloudUpload({
        reason: pendingReason.current,
        markDirty: true,
      });
      failureCount.current = 0;
      clearTimer(retryTimer);
    } catch (error) {
      failureCount.current += 1;
      const retryDelay = Math.min(5 * 60 * 1000, 2000 * Math.pow(2, failureCount.current - 1));

      clearTimer(retryTimer);
      retryTimer.current = window.setTimeout(() => {
        void runUpload();
      }, retryDelay);

      if (failureCount.current >= MAX_TOAST_FAILURES) {
        toast.error('Cloud backup is still pending. Valis will retry automatically.');
      }
      console.error('[CloudBackupQueue] Upload failed:', error);
    } finally {
      isUploading.current = false;
      if (pendingAfterRun.current) {
        pendingAfterRun.current = false;
        debounceTimer.current = window.setTimeout(() => {
          void runUpload();
        }, DEBOUNCE_MS);
      }
    }
  };

  const scheduleBackup = async (reason: string) => {
    pendingReason.current = reason;

    try {
      await markDirty();
    } catch (error) {
      console.warn('[CloudBackupQueue] Failed to mark DB dirty:', error);
    }

    if (!user || isCloudBackupSuppressed()) return;

    clearTimer(debounceTimer);
    debounceTimer.current = window.setTimeout(() => {
      void runUpload();
    }, DEBOUNCE_MS);

    if (maxWaitTimer.current === null) {
      maxWaitTimer.current = window.setTimeout(() => {
        void runUpload();
      }, MAX_WAIT_MS);
    }
  };

  useEffect(() => {
    if (!window.api?.onDataChanged) return;

    const remove = window.api.onDataChanged((event: DataChangeEvent) => {
      if (!event.important) return;
      if (event.type === 'restore' || event.type === 'reset') return;
      void scheduleBackup(`${event.type}:${event.source}`);
    });

    return () => remove();
  }, [user, performCloudUpload]);

  useEffect(() => {
    return () => {
      clearTimer(debounceTimer);
      clearTimer(maxWaitTimer);
      clearTimer(retryTimer);
    };
  }, []);
}
