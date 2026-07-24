import { useCallback, useRef } from 'react';
import { supabase } from '../../../lib/cloud/supabase';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { setCloudBackupSuppressed } from '../../../lib/cloud/cloudBackupState';
import { useSessionStore } from '../../session-tracker/store';

type CloudUploadOptions = {
  reason?: string;
  markDirty?: boolean;
  force?: boolean;
};

let uploadQueue: Promise<void> = Promise.resolve();

export const useAutoSync = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const isSyncing = useRef(false);

  const performCloudUpload = useCallback(async (options: CloudUploadOptions = {}) => {
    if (!user || !window.api) return;

    const upload = uploadQueue.catch(() => {}).then(async () => {
      if (options.markDirty) {
        await window.api.setSystemMeta('cloud_backup_dirty', '1');
      }

      const rawData = await window.api.getDatabaseDump();
      const blob = new Blob([JSON.stringify(rawData)], { type: 'application/json' });

      const { error } = await supabase.storage
        .from('backups')
        .upload(`${user.id}/valis_autobackup.json`, blob, { upsert: true });
      if (error) throw error;

      const syncedAt = Date.now().toString();
      await Promise.all([
        window.api.setSystemMeta('last_synced_at', syncedAt),
        window.api.setSystemMeta('owner_id', user.id),
        window.api.setSystemMeta('cloud_backup_dirty', '0'),
        window.api.setSystemMeta('last_backup_reason', options.reason || 'manual'),
      ]);
    });

    uploadQueue = upload;
    await upload;
  }, [user]);

  const downloadAndRestore = useCallback(async (path: string) => {
    setCloudBackupSuppressed(true);
    try {
      const { data, error } = await supabase.storage.from('backups').download(path);
      if (error) throw error;
      if (data) {
        const jsonText = await data.text();
        const jsonData = JSON.parse(jsonText);
        const result = await window.api.restoreBackup(jsonData.data);
        if (!result?.success) {
          throw new Error(result?.error || 'Cloud backup restore failed');
        }
        await window.api.setSystemMeta('cloud_backup_dirty', '0');
      }
    } finally {
      setCloudBackupSuppressed(false);
    }
  }, []);

  const checkSyncOnLoad = useCallback(async () => {
    if (!user || isSyncing.current) return;
    isSyncing.current = true;

    try {
      if (!window.api) return;

      const localMeta = await window.api.getSystemMeta();
      const localOwner = localMeta.owner_id || 'guest';
      const localTimestamp = parseInt(localMeta.last_synced_at || '0');

      const { data: cloudMeta } = await supabase
        .storage
        .from('backups')
        .list(user.id, { search: 'valis_autobackup.json' });

      const cloudFileExists = cloudMeta && cloudMeta.length > 0;
      const cloudTimestamp = cloudFileExists ? new Date(cloudMeta[0].updated_at).getTime() : 0;
      const cloudFile = `${user.id}/valis_autobackup.json`;

      if (localOwner !== 'guest' && localOwner !== user.id) {
        toast.info('Switching accounts...');
        setCloudBackupSuppressed(true);
        try {
          await window.api.restoreBackup({});
        } finally {
          setCloudBackupSuppressed(false);
        }

        if (cloudFileExists) {
          await downloadAndRestore(cloudFile);
          await window.api.setSystemMeta('last_synced_at', cloudTimestamp.toString());
          toast.success('Account data loaded!');
        } else {
          toast.success('New account initialized.');
        }
        await window.api.setSystemMeta('owner_id', user.id);
        await window.api.setSystemMeta('cloud_backup_dirty', '0');
      } else if (localOwner === 'guest') {
        toast.info('Syncing account...');

        if (cloudFileExists) {
          if (useSessionStore.getState().activeSession) return;
          await downloadAndRestore(cloudFile);
          await window.api.setSystemMeta('last_synced_at', cloudTimestamp.toString());
          toast.success('Cloud data restored.');
        } else {
          await performCloudUpload({ reason: 'claim-guest-data', markDirty: true, force: true });
          toast.success('Local data backed up to cloud.');
        }
        await window.api.setSystemMeta('owner_id', user.id);
      } else if (cloudFileExists && cloudTimestamp > localTimestamp) {
        const latestMeta = await window.api.getSystemMeta();
        const hasActiveSession = Boolean(useSessionStore.getState().activeSession);
        const hasUnsyncedLocalChanges = latestMeta.cloud_backup_dirty === '1';

        if (hasActiveSession) {
          return;
        } else if (hasUnsyncedLocalChanges) {
          await performCloudUpload({ reason: 'local-dirty-conflict', markDirty: true, force: true });
        } else {
          toast.info('Syncing from cloud...');
          await downloadAndRestore(cloudFile);
          await window.api.setSystemMeta('last_synced_at', cloudTimestamp.toString());
          toast.success('Cloud changes applied.');
        }
      } else if (!cloudFileExists) {
        await performCloudUpload({ reason: 'first-cloud-upload', markDirty: true, force: true });
        await window.api.setSystemMeta('owner_id', user.id);
      }

      const latestMeta = await window.api.getSystemMeta();
      if (latestMeta.cloud_backup_dirty === '1' && latestMeta.owner_id === user.id) {
        await performCloudUpload({ reason: 'startup-dirty-recovery', markDirty: true, force: true });
      }
    } catch (error) {
      console.error('Sync Error:', error);
    } finally {
      isSyncing.current = false;
    }
  }, [downloadAndRestore, performCloudUpload, toast, user]);

  return { checkSyncOnLoad, performCloudUpload };
};
