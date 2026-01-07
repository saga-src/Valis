import axios from 'axios';

/**
 * CloudGate Service
 * 
 * Manages outgoing requests to the Supabase Edge Function Proxy.
 * Implements a queue-based rate limiter to respect the 4 req/s upstream limit (250ms gap).
 */
class CloudGate {
  private queue: Array<() => Promise<void>> = [];
  private isProcessing: boolean = false;
  private lastRequestTime: number = 0;
  
  // Use environment variables for configuration
  private readonly SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
  private readonly SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

  constructor() {}

  /**
   * Enforces the rate limit by processing tasks from the queue sequentially
   * with a mandatory delay between them.
   */
  private async processQueue() {
    // If queue is empty, stop processing
    if (this.queue.length === 0) {
      this.isProcessing = false;
      return;
    }
    
    this.isProcessing = true;

    const now = Date.now();
    const elapsed = now - this.lastRequestTime;

    // If elapsed < 250ms (1000ms / 4 requests), wait and retry
    if (elapsed < 250) {
      setTimeout(() => this.processQueue(), 250 - elapsed);
      return;
    }

    // Shift the next request
    const task = this.queue.shift();
    if (task) {
      // Update lastRequestTime before executing to start the timer for the next gap
      this.lastRequestTime = Date.now();
      
      try {
        await task();
      } catch (error) {
        console.error('[CloudGate] Request task execution failed:', error);
      }
      
      // Call processQueue() again immediately to handle the next item
      this.processQueue();
    }
  }

  /**
   * Helper to wrap a request function in a promise and add it to the queue.
   */
  private async enqueueRequest<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      
      // Initiate processing if not already active
      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  }

  /**
   * Queries IGDB via the Supabase Proxy.
   * @param apicalypseQuery The raw IGDB query string.
   * @param endpoint The IGDB endpoint name (defaults to 'games').
   */
  async fetchIGDB(apicalypseQuery: string, endpoint: string = 'games'): Promise<any> {
    const url = `${this.SUPABASE_URL}/functions/v1/valis-proxy/igdb`;
    
    return this.enqueueRequest(async () => {
      const response = await axios.post(url, apicalypseQuery, {
        headers: {
          'Content-Type': 'text/plain',
          'Authorization': `Bearer ${this.SUPABASE_ANON_KEY}`,
          'apikey': this.SUPABASE_ANON_KEY,
          'igdb-endpoint': endpoint
        }
      });
      return response.data;
    });
  }

  /**
   * Fetches Steam achievements via the Supabase Proxy.
   * @param steamId The user's 64-bit Steam ID.
   * @param appId The Steam App ID of the game.
   */
  async fetchSteamAchievements(steamId: string, appId: string): Promise<any> {
    const url = `${this.SUPABASE_URL}/functions/v1/valis-proxy/steam/achievements`;
    
    return this.enqueueRequest(async () => {
      const response = await axios.get(url, {
        params: { steamId, appId },
        headers: {
          'Authorization': `Bearer ${this.SUPABASE_ANON_KEY}`,
          'apikey': this.SUPABASE_ANON_KEY
        }
      });
      return response.data;
    });
  }
}

// Export singleton instance
export const cloudGate = new CloudGate();