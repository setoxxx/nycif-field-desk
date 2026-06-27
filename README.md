# NYCIF Field Desk PWA

Standalone PWA version of the NYC In Focus event radar.

## What it does

- Full-screen mobile field map.
- Loads the lightweight major assignment feed first.
- Uses the full feed only when you tap "Load all events".
- Includes GPS / "show my location".
- Includes Layers filters, photo-pick mode, NYPD-only mode, and an assignment drawer.
- Runs outside WordPress, so no theme/shortcode/plugin conflict.

## Feeds

Default major feed:
https://raw.githubusercontent.com/setoxxx/nycif-live-feeds/main/nycif_major_radar_map_events.json

Optional full feed:
https://raw.githubusercontent.com/setoxxx/nycif-live-feeds/main/nycif_all_radar_map_events.json

## Local test

From this folder:

```bash
python3 -m http.server 8080
```

Open:

```text
http://localhost:8080
```

## Deploy options

Best quick option:
- Create a new GitHub repo named `nycif-field-desk`.
- Push these files.
- Turn on GitHub Pages from the repo settings.

Better production option:
- Deploy to Cloudflare Pages, Netlify, or Vercel.
- Point `events.nycinfocus.com` or `fielddesk.nycinfocus.com` to it.

## iPhone app-like install

Open the deployed URL in Safari:
Share > Add to Home Screen
