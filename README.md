<div align="center">
  <img src="public/images/logo.png" alt="Valis Logo" width="120" height="120" />
  <h1>VALIS</h1>
  <p><strong>v1.2.0 | Digital Game Journal</strong></p>
  
  <p>
    <a href="#features">Features</a> •
    <a href="#tech-stack">Tech Stack</a> •
    <a href="#getting-started">Getting Started</a> •
    <a href="#architecture">Architecture</a>
  </p>

  <p>
    <img src="https://img.shields.io/github/license/saga-src/Valis?style=flat-square" alt="License" />
     <img src="https://img.shields.io/badge/Privacy-Local--First-green?style=flat-square" alt="Local First" />
    <img src="https://img.shields.io/badge/Cloud-Opt--In-blue?style=flat-square" alt="Cloud Opt-In" />
    <img src="https://img.shields.io/badge/Built%20with-AI%20Assistance-purple?style=flat-square" alt="Built with AI Assistance" />
  </p>
</div>

---

> **Valis** (formerly SaveState) is a local-first ecosystem designed to blend offline reliability with high-fidelity social features. It treats your library as a curated collection of artifacts, not just a list of licenses.

**🔒 Privacy by Default:** Valis runs entirely on your machine. Your database (`valis.db`) is local.

**☁️ Social by Choice:** Cloud features (Leaderboards, Activity Feed, Profiles) are strictly **opt-in**. You can use Valis forever without ever signing in.

## <a id="features"></a>🚀 Features

### 1. Unified Game Library (The Vault)
The core of Valis is a cross-platform aggregator that treats your games as artifacts.
* **Universal Metadata Hub:** Powered by IGDB. Fetches high-resolution covers, backdrops, and technical details.
* **Multi-Platform Ownership:** Track a single game across multiple licenses (Steam, Epic, PS5, etc.).
* **Advanced Status Tracking:** Granular states including Backlog, Playing, Beat, Completed (100%), and Shelved.
* **Dynamic View Engine:**
    * _Museum Mode:_ High-fidelity grid with refractive glass effects.
    * _Stealth Mode:_ Privacy-first, telemetry-style terminal interface.

### 2. Precision Session Tracker
Valis tracks *how* you play, not just *if* you play.
* **Automated Process Watcher:** Background service that detects linked .exe launches to auto-log sessions.
* **Manual Control Timer:** High-precision timers for console gaming, or for users who simply prefer full manual control over the automated tracker.
* **Second-Precision Editing:** Manual sessions preserve `HH:mm:ss`, with independent Start Now and End Now controls.
* **Precise Historical Playtime:** Legacy playtime entries can be recorded and displayed down to individual seconds.
* **Contextual Logging:** Track "Mood Pulse" (emotional state), smart tags, and markdown-based journal entries.

### 3. Deep Analytics Dashboard
* **Circadian Rhythm:** Visualizes your "probability of play" across a 24-hour clock.
* **Backlog Burn-down:** Area Chart showing the gap between "Acquired" and "Beaten" titles.
* **Temporal Projection:** Algorithmic forecast predicting when you will clear your backlog.
* **Genre DNA:** Multi-dimensional radar mapping of your library's personality.

### 4. Integration Ecosystem
* **Steam Sync:** Imports full libraries and achievements.
* **PlayStation Network:** NPSSO token exchange for Trophies and history.
* **Epic Games Store:** Visual scraper to bypass API limitations.
* **Emulator Watcher:** File monitor for Goldberg/CODEX emulator files to sync "unofficial" achievements.

### 5. Gamification (Valis Protocol)
* **Archetype System:** Evolve into an *Archivist*, *Critic*, *Completionist*, or *Timekeeper*.
* **Protocol Artifacts:** Unlock 30+ secret "Marks" based on system behavior.
* **Material Badges:** Dynamic rendering with tiered materials (Copper to Obsidian).

### 6. Valis Studio (Sharing)
* **Card Generator:** Export high-res (1200x630) social cards.
* **Templates:** Editorial, Retro (CRT), Polaroid, and Immersive styles.

### 7. Community (Opt-In)
* **Direct Friend Chat:** Authenticated friends can exchange persistent private text messages with live updates, profile shortcuts, and per-contact unread indicators.
* **Social Hub:** Profiles, presence, friend requests, activity feed, and leaderboards remain optional cloud features.

## <a id="tech-stack"></a>🛠️ Tech Stack

**Core**
* **Runtime:** [Electron](https://www.electronjs.org/) (v33+)
* **Frontend:** [React](https://react.dev/) (v19) + Vite
* **Language:** TypeScript

**Data Layer**
* **Local DB:** `better-sqlite3` + `Kysely` (Type-safe SQL)
* **Cloud DB:** Supabase (PostgreSQL) - *Only used if signed in*
* **Sync:** Custom JSON/Blob sync via RLS Policies

## <a id="getting-started"></a>📦 Getting Started

### Prerequisites
* Node.js (v20+ recommended)
* npm or pnpm

### Installation

1.  **Clone the repository**
    ```bash
    git clone [https://github.com/saga-src/valis.git](https://github.com/saga-src/valis.git)
    cd valis
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Setup Environment**
    Create a `.env` file in the root:
    ```env
    VITE_SUPABASE_URL=your_supabase_url
    VITE_SUPABASE_ANON_KEY=your_anon_key
    ```

4.  **Run Development Mode**
    ```bash
    npm run desktop
    ```

## <a id="architecture"></a>🏗️ Architecture

Valis follows a **Feature-Sliced Design (FSD)** methodology:

* `electron/`: Main process, IPC handlers, and background services (Watchers).
* `src/features/`: Isolated business logic (Library, Analytics, Reviews).
* `src/lib/`: Shared infrastructure (Database client, Theme engine).
* `src/components/`: Shared UI Kit (Buttons, Modals, Inputs).


## 🤖 AI Transparency
I understand that the use of AI in creative and technical fields is a complex topic with valid concerns. However, Valis exists today because these tools helped bridge the gap between my ideas and my available time and skills. This project began as a solution to a personal need—I used to use an Excel sheet to track my sessions, but I wanted something more robust and with more features tool that didn't exist yet—and I decided to open-source it for anyone else looking for a similar alternative.

## 📄 License

This project is licensed under the **GNU GPLv3 License** - see the [LICENSE](LICENSE) file for details.
