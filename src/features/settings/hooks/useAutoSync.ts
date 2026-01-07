
import { useEffect, useRef } from 'react';
import { supabase } from '../../../lib/cloud/supabase';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';

export const useAutoSync = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const isSyncing = useRef(false);

  // 1. THE STARTUP CHECK
  const checkSyncOnLoad = async () => {
    if (!user || isSyncing.current) return;
    isSyncing.current = true;

    try {
      if (!window.api) return;

      // A. Get Local Metadata
      const localMeta = await window.api.getSystemMeta(); 
      const localOwner = localMeta.owner_id || 'guest';
      const localTimestamp = parseInt(localMeta.last_synced_at || '0');

      // B. Get Cloud Metadata (Head request to check file exists & time)
      const cloudFile = `${user.id}/valis_autobackup.json`;
      const { data: cloudMeta, error: cloudError } = await supabase
        .storage
        .from('backups')
        .list(user.id, { search: 'valis_autobackup.json' });

      const cloudFileExists = cloudMeta && cloudMeta.length > 0;
      // Get the timestamp from the meta object. Note: Supabase metadata format
      const cloudTimestamp = cloudFileExists ? new Date(cloudMeta[0].updated_at).getTime() : 0;

      // === SCENARIO 1: WRONG OWNER (Previous user was someone else) ===
      if (localOwner !== 'guest' && localOwner !== user.id) {
        toast.info("Switching accounts...");
        
        // Strict Wipe to remove previous user's data
        await window.api.restoreBackup({}); 
        
        if (cloudFileExists) {
          // Download & Replace
          await downloadAndRestore(cloudFile);
          await window.api.setSystemMeta('last_synced_at', cloudTimestamp.toString());
          toast.success("Account data loaded!");
        } else {
          toast.success("New account initialized.");
        }
        // Update Owner
        await window.api.setSystemMeta('owner_id', user.id);
      } 
      
      // === SCENARIO 1b: GUEST CLAIMING (Transition from Guest to User) ===
      else if (localOwner === 'guest') {
         toast.info("Syncing account...");
         
         if (cloudFileExists) {
             // Conflict! Cloud has data, Local is guest.
             // Cloud wins to prevent overwriting account history with potentially empty guest data.
             await downloadAndRestore(cloudFile);
             await window.api.setSystemMeta('last_synced_at', cloudTimestamp.toString());
             toast.success("Cloud data restored.");
         } else {
             // Cloud Empty: Upload Guest Data to Cloud to claim it
             await performCloudUpload();
             toast.success("Local data backed up to cloud.");
         }
         // Claim ownership
         await window.api.setSystemMeta('owner_id', user.id);
      }

      // === SCENARIO 2: SAME OWNER - CLOUD IS NEWER ===
      else if (cloudFileExists && cloudTimestamp > localTimestamp) {
        toast.info("Syncing from cloud...");
        await downloadAndRestore(cloudFile);
        await window.api.setSystemMeta('last_synced_at', cloudTimestamp.toString());
        toast.success("Cloud changes applied.");
      }

      // === SCENARIO 3: SAME OWNER - NO CLOUD DATA (First Upload or Re-upload) ===
      else if (!cloudFileExists) {
         // Upload current data
         await performCloudUpload();
         // Ensure owner matches (redundant but safe)
         await window.api.setSystemMeta('owner_id', user.id);
      }

    } catch (error) {
      console.error("Sync Error:", error);
    } finally {
      isSyncing.current = false;
    }
  };

  // Helper: Download
  const downloadAndRestore = async (path: string) => {
    const { data } = await supabase.storage.from('backups').download(path);
    if (data) {
      const jsonText = await data.text();
      const jsonData = JSON.parse(jsonText);
      await window.api.restoreBackup(jsonData.data);
    }
  };

  // Helper: Upload
  const performCloudUpload = async () => {
    if (!user) return;
    const rawData = await window.api.getDatabaseDump();
    const blob = new Blob([JSON.stringify(rawData)], { type: 'application/json' });
    
    await supabase.storage
      .from('backups')
      .upload(`${user.id}/valis_autobackup.json`, blob, { upsert: true });
      
    // Update local timestamp so we don't re-download immediately
    await window.api.setSystemMeta('last_synced_at', Date.now().toString());
  };

  return { checkSyncOnLoad, performCloudUpload };
};
