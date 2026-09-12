import { EventEmitter } from 'events';

class SessionLifecycleService extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(20);
  }

  sessionStarted(session) {
    this.emit('started', session);
  }

  sessionEnded(session) {
    this.emit('ended', session);
  }
}

export const sessionLifecycle = new SessionLifecycleService();
