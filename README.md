# Local Activity Tracker

A Windows-first, local-only activity tracker inspired by Marvel Cerebro. It records the active app/window, focus sessions, idle transitions, clipboard changes, and changes in folders you choose. A built-in dashboard reads the trace from MySQL.

## What is captured

| Source | What is saved | Default |
| --- | --- | --- |
| Foreground window | Application, title, process ID, start/end duration | On |
| Idle state | Start/end transition and elapsed idle time | On |
| Clipboard | Text type, length, and SHA-256 fingerprint | Metadata only |
| File activity | Create/modify/delete path and extension inside selected folders | Off until configured |

No screenshots or raw keystrokes are collected. Clipboard text is also not saved unless you explicitly set `CLIPBOARD_CAPTURE=text`. Excluded apps (password managers by default) never persist their titles or clipboard data.

## 1. Zero Setup Database

This application uses a local **SQLite** database (`activity_tracker.db`) to store all events securely on your machine. You do not need to install or configure MySQL.

## 2. Start the Tracker

Install the application dependencies and start the tracker:

```powershell
npm install
Update .env file accordingly 
```

Run the application:
```powershell
npm start
```

Open [http://127.0.0.1:3210](http://127.0.0.1:3210). The server starts the tracker and automatically creates the local database schema.

## Configure folder tracking

Set `WATCH_PATHS` in `.env` to a semicolon-separated list of folders, for example:

```dotenv
WATCH_PATHS=C:\\Users\\you\\Documents;C:\\Users\\you\\Desktop
```

Restart the tracker after configuration changes. Folder tracking records only file-event metadata, never the file contents.

## Verify

```powershell
npm test
```

When the tracker is running, switch between two applications, wait a few seconds, and refresh the dashboard. You should see `window_focus` events immediately; focus durations appear once a window is left or the application stops.

## Data model

`activity_events` is the immutable timeline. `window_sessions` stores completed focus intervals, which powers the time-spent dashboard. Both use indexed timestamps and are created automatically on startup.
