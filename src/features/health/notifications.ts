
const ALERT_SOUND_URL = '../../../public/sounds/touch_grass.mp3';

export const triggerHealthAlert = (soundEnabled: boolean, toastEnabled: boolean, minutesPlayed: number) => {
  const hours = (minutesPlayed / 60).toFixed(1);
  const message = `You've been playing for ${hours} hours. Time to stretch and hydrate!`;

  // 1. Play Sound
  if (soundEnabled) {
    try {
      const audio = new Audio(ALERT_SOUND_URL);
      audio.volume = 0.5;
      audio.play().catch(e => console.warn("Audio play failed (interaction needed?):", e));
    } catch (e) {
      console.error("Audio error", e);
    }
  }

  // 2. Show Browser Notification
  if (toastEnabled) {
    if (!("Notification" in window)) {
        console.log("This browser does not support desktop notification");
    } else if (Notification.permission === "granted") {
        new Notification("🌱 Touch Grass!", {
            body: message,
            icon: '/vite.svg',
            silent: true // We handle sound manually if enabled
        });
    } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then((permission) => {
            if (permission === "granted") {
                new Notification("🌱 Touch Grass!", {
                    body: message,
                    icon: '/vite.svg',
                    silent: true
                });
            }
        });
    }
  }
};
