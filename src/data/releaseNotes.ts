export const RELEASE_NOTES = {
  version: "1.2.0",
  title: "Direct Chat and Second-Precision Time",
  description: "This update adds persistent real-time messaging between authenticated friends and preserves exact seconds across manual sessions and historical playtime.",
  features: [
    {
      icon: "MessageCircle",
      title: "Direct Friend Chat",
      description: "Authenticated friends can load history, open chats from profiles, exchange live messages, and see local unread indicators by contact."
    },
    {
      icon: "Clock3",
      title: "Exact Manual Sessions",
      description: "Manual session Start, End, and Duration values retain HH:mm:ss precision, with independent Start Now and End Now controls."
    },
    {
      icon: "History",
      title: "Precise Historical Playtime",
      description: "Historical entries now accept seconds-only values and display their full hour, minute, and second duration without rounding."
    },
    {
      icon: "ShieldCheck",
      title: "Session Finalization Stability",
      description: "Quick Play finalization and cloud-sync safeguards remain intact so completed session times are not replaced by stale backup data."
    }
  ]
};
