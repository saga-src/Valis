export const RELEASE_NOTES = {
  version: "1.3.0",
  title: "Better Integrations, Less Session Busywork",
  description: "Valis 1.3.0 focuses on the features that run in the background. Account links fail more cleanly, tracked sessions can reconcile Steam achievements, and duplicate Protocol notifications are gone.",
  features: [
    {
      icon: "RefreshCw",
      title: "Resilient Epic Sync",
      description: "Epic library sync now shows what it is doing and tells you when only part of the job succeeded. You can cancel it, it will not wait forever, and an empty or private profile no longer wipes existing data."
    },
    {
      icon: "Link",
      title: "Link a Battle.net Account",
      description: "You can now link or unlink your Battle.net identity through OAuth. This only identifies the account; it does not import Blizzard games or achievements... yet."
    },
    {
      icon: "Trophy",
      title: "Steam Achievement Sync (Optional)",
      description: "Turn this on to have Valis check Steam achievements during a tracked session and copy new unlocks into your local journal. Valis only reads from Steam; it cannot unlock or change anything there."
    },
    {
      icon: "FolderSync",
      title: "Local Achievement Files Fixed",
      description: "Goldberg and CODEX folders are watched from startup and update when you change their settings. Valis waits out partial file writes, handles mixed timestamp formats, and records the first scan without flooding you with old unlocks."
    },
    {
      icon: "Activity",
      title: "A Leaner Process Tracker",
      description: "The automatic tracker now respects its saved switch and scan interval. Scans cannot pile up, repeated database work is reduced, and games that share an executable name are no longer guessed at."
    },
    {
      icon: "Rocket",
      title: "Game Launches Wait for Confirmation",
      description: "Valis checks the executable and working folder before launch, then waits for Windows to confirm that the process started. Repeated clicks are ignored while a launch is already in progress."
    },
    {
      icon: "ChartNoAxesCombined",
      title: "Readable Analytics Overlays",
      description: "Chart tooltips and the widget menu now use the same solid, theme-aware surface. Labels stay readable in both light and dark mode."
    },
    {
      icon: "BadgeCheck",
      title: "Protocol Notification Dedupe",
      description: "Protocol Artifact notifications now depend on an atomic database insert and use shared promise and queue deduplication, so a real unlock appears once."
    }
  ]
};
