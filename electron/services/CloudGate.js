import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env.local in the root directory
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

/**
 * CloudGate Service
 * 
 * Manages outgoing requests to the Supabase Edge Function Proxy.
 * Implements a queue-based rate limiter to respect upstream limits (4 req/s).
 */
class CloudGate {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.lastRequestTime = 0;
    this.SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
    this.SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';
    
    console.log(`[CloudGate] Initialized. Target: ${this.SUPABASE_URL || 'MISSING_URL'}`);
    if (!this.SUPABASE_ANON_KEY) {
        console.error('[CloudGate] ⚠️ VITE_SUPABASE_ANON_KEY is missing! Cloud calls will fail.');
    }
  }

  /**
   * Enforces the rate limit by processing tasks from the queue sequentially.
   */
  async processQueue() {
    if (this.queue.length === 0) {
      this.isProcessing = false;
      return;
    }
    
    this.isProcessing = true;

    const now = Date.now();
    const elapsed = now - this.lastRequestTime;

    if (elapsed < 250) {
      setTimeout(() => this.processQueue(), 250 - elapsed);
      return;
    }

    const task = this.queue.shift();
    if (task) {
      this.lastRequestTime = Date.now();
      try {
        await task();
      } catch (error) {
        console.error('🔥 [CloudGate] Upstream Request Failed:', error.message);
        if (error.response) {
            console.error('[CloudGate] Status:', error.response.status, 'Data:', error.response.data);
        }
      }
      this.processQueue();
    }
  }

  /**
   * Wraps a request in a promise and adds it to the rate-limited queue.
   */
  enqueue(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      
      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  }

  /**
   * Queries IGDB via the Cloud Proxy.
   * @param {string} query Apicalypse query string.
   * @param {string} endpoint IGDB endpoint name.
   */
  async fetchIGDB(query, endpoint = 'games') {
    return this.enqueue(async () => {
      console.log(`[CloudGate] Proxying IGDB: ${endpoint}`);
      const response = await axios.post(`${this.SUPABASE_URL}/functions/v1/valis-proxy/igdb`, query, {
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
   * Fetches Steam achievements via the Cloud Proxy.
   */
  async fetchSteamAchievements(steamId, appId) {
    return this.enqueue(async () => {
      console.log(`[CloudGate] Proxying Steam Achievements: User ${steamId}, App ${appId}`);
      const response = await axios.get(`${this.SUPABASE_URL}/functions/v1/valis-proxy/steam/achievements`, {
        params: { steamId, appId },
        headers: {
          'Authorization': `Bearer ${this.SUPABASE_ANON_KEY}`,
          'apikey': this.SUPABASE_ANON_KEY
        }
      });
      return response.data;
    });
  }

  /**
   * Fetches Steam achievement definitions (schema) via the Cloud Proxy.
   */
  async fetchSteamSchema(appId) {
    return this.enqueue(async () => {
      try {
        console.log(`[CloudGate] Proxying Steam Schema: App ${appId}`);
        const response = await axios.get(`${this.SUPABASE_URL}/functions/v1/valis-proxy/steam/schema`, {
          params: { appId },
          headers: {
            'Authorization': `Bearer ${this.SUPABASE_ANON_KEY}`,
            'apikey': this.SUPABASE_ANON_KEY,
            'Content-Type': 'application/json'
          }
        });
        return response.data?.game?.availableGameStats?.achievements || [];
      } catch (error) {
        console.warn(`[CloudGate] Schema fetch failed for ${appId}:`, error.message);
        return [];
      }
    });
  }
}

export const cloudGate = new CloudGate();