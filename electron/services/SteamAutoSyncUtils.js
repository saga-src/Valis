export function retryDelayMs(attempt, baseMs = 30_000, maximumMs = 15 * 60 * 1000) {
  return Math.min(maximumMs, baseMs * (2 ** Math.max(0, attempt - 1)));
}

export class KeyedTaskCoordinator {
  constructor() {
    this.tasks = new Map();
  }

  run(key, factory) {
    if (this.tasks.has(key)) return this.tasks.get(key);
    const task = Promise.resolve().then(factory).finally(() => this.tasks.delete(key));
    this.tasks.set(key, task);
    return task;
  }
}
