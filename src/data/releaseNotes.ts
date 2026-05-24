export const RELEASE_NOTES = {
  version: "1.1.3",
  title: "Reliability, Cache, and Analytics Polish",
  description: "This update tightens the local-first data flow with shared caching, safer achievement sync, a sturdier analytics dashboard, and automatic cloud backup after important local changes.",
  features: [
    {
      icon: "Database",
      title: "Shared Page Cache",
      description: "Library, sessions, game details, achievements, analytics, journal, quick play, settings, tags, and milestones now use shared cache and invalidation primitives."
    },
    {
      icon: "Trophy",
      title: "Per-Game Achievement Sync",
      description: "Game Details now includes a Sync Missing action for supported Steam, PlayStation, and Xbox games, preserving local unlocks and timestamps."
    },
    {
      icon: "CloudArrowUp",
      title: "Automatic Cloud Backup Queue",
      description: "Important local writes now emit typed change events that schedule debounced, single-flight Supabase backups with dirty-state retry support."
    },
    {
      icon: "BookOpen",
      title: "Faster Journal Loading",
      description: "The Journal loads sessions in pages with scroll-to-load behavior, keeping large histories responsive without losing date filtering."
    },
    {
      icon: "LayoutDashboard",
      title: "Analytics Dashboard Stability",
      description: "Layouts are now versioned and validated before loading, with safer responsive breakpoints and new insight widgets for platforms, completion flow, and session streaks."
    },
    {
      icon: "ScrollText",
      title: "Rolling App Session Logs",
      description: "Valis now writes a text log beside the database with the last three app sessions, including startup, shutdown, main-process logs, and renderer logs."
    }
  ]
};
