export const RELEASE_NOTES = {
  version: "1.4.0",
  title: "WoW Retail, Local Backups and Reliable Sessions",
  description: "Valis 1.4.0 adds regional WoW Retail imports, seven daily SQLite backups with in-app restore, and safer session changes.",
  features: [
    {
      icon: "Link",
      title: "WoW Retail via Battle.net",
      description: "Choose your region and authorize Battle.net to import WoW Retail and confirmed achievements from your characters. Repeated or partial syncs keep earlier unlocks, and ambiguous WoW entries ask which game to update."
    },
    {
      icon: "FolderSync",
      title: "Seven Daily Local Backups",
      description: "Valis creates a complete database snapshot on startup or at 03:00 when needed. Settings lists the latest seven completed days and restores a selected file after a restart, with recovery of the previous database if the restore is interrupted."
    },
    {
      icon: "Activity",
      title: "Sessions Finish Reliably",
      description: "Starting a different game finishes the previous session without deleting it. Repeated stop events no longer duplicate session effects, and failed saves preserve the timer and draft so you can retry."
    }
  ]
};
