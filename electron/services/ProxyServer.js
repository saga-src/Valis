
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import * as db from '../db/queries.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Load Environment Variables (Fallback)
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());
app.use(express.text({ type: 'text/plain' }));

// 2. Credentials State
let accessToken = null;
let tokenExpiry = 0;

// Helper: Get Credentials (DB > Env > Defaults)
async function getCredentials() {
  let clientId = process.env.IGDB_CLIENT_ID || 'dorwhm84oj070yn9pxwf1go81t8yh4';
  let clientSecret = process.env.IGDB_CLIENT_SECRET || 'ufnhsthvtv1ou0qo5fbeo8x2kagewi';

  try {
    const dbId = await db.getSetting('igdb_client_id');
    const dbSecret = await db.getSetting('igdb_secret');

    if (dbId && dbSecret) {
      clientId = dbId;
      clientSecret = dbSecret;
      console.log('[Proxy] Using User-Provided API Keys');
    }
  } catch (e) {
    console.warn('[Proxy] Failed to load custom keys, using defaults:', e.message);
  }

  return { clientId, clientSecret };
}

// 3. Helper: Get Twitch Token
async function getAccessToken() {
  if (accessToken && Date.now() < tokenExpiry) {
    return accessToken;
  }

  const { clientId, clientSecret } = await getCredentials();

  console.log('Refreshing IGDB Access Token...');
  
  try {
    const response = await axios.post('https://id.twitch.tv/oauth2/token', null, {
      params: {
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials'
      }
    });
    
    accessToken = response.data.access_token;
    tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000;
    
    console.log('Token refreshed successfully.');
    return accessToken;
  } catch (error) {
    console.error('Error fetching access token:', error.response ? error.response.data : error.message);
    throw new Error('Failed to authenticate with Twitch/IGDB');
  }
}

// 4. API Route: Search Games
app.post('/api/search', async (req, res) => {
  try {
    const token = await getAccessToken();
    const { clientId } = await getCredentials();
    const igdbBody = typeof req.body === 'string' ? req.body : req.body?.query;

    if (!igdbBody) {
      return res.status(400).json({ error: 'Missing query body' });
    }

    const response = await axios.post('https://api.igdb.com/v4/games', igdbBody, {
      headers: {
        'Client-ID': clientId,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'text/plain'
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error('Proxy Search Error:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Failed to fetch data from IGDB' });
  }
});

// 5. API Route: Time To Beat
app.post('/api/ttb', async (req, res) => {
  try {
    const token = await getAccessToken();
    const { clientId } = await getCredentials();
    const igdbBody = typeof req.body === 'string' ? req.body : req.body?.query;

    if (!igdbBody) {
      return res.status(400).json({ error: 'Missing query body' });
    }

    const response = await axios.post('https://api.igdb.com/v4/game_time_to_beats', igdbBody, {
      headers: {
        'Client-ID': clientId,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'text/plain'
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error('Proxy TTB Error:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Failed to fetch TTB data' });
  }
});

// 6. API Route: External Games (Steam -> IGDB)
app.post('/api/external', async (req, res) => {
  try {
    const token = await getAccessToken();
    const { clientId } = await getCredentials();
    const igdbBody = typeof req.body === 'string' ? req.body : req.body?.query;

    if (!igdbBody) {
      return res.status(400).json({ error: 'Missing query body' });
    }

    const response = await axios.post('https://api.igdb.com/v4/external_games', igdbBody, {
      headers: {
        'Client-ID': clientId,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'text/plain'
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error('Proxy External Error:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Failed to fetch external data' });
  }
});

app.listen(PORT, () => {
  console.log(`Proxy server running on http://localhost:${PORT}`);
});
