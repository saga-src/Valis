
import { db } from '../client.js';

export async function eraseLibraryData() {
    console.log('[FactoryReset] Erasing Library...');
    // Delete dependent tables first to avoid foreign key constraints (if enforced)
    await db.deleteFrom('achievement_progress').execute();
    await db.deleteFrom('achievements').execute();
    await db.deleteFrom('sessions').execute();
    await db.deleteFrom('game_tags').execute();
    await db.deleteFrom('library_platforms').execute();
    await db.deleteFrom('library').execute();
    await db.deleteFrom('games').execute();
    return true;
}

export async function eraseSettingsData() {
    console.log('[FactoryReset] Erasing Settings...');
    await db.deleteFrom('settings').execute();
    await db.deleteFrom('watch_paths').execute();
    return true;
}

export async function eraseAccountData() {
    console.log('[FactoryReset] Unlinking Accounts...');
    await db.deleteFrom('linked_accounts').execute();
    return true;
}
