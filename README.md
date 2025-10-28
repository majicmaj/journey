<div align="center">

# Journey

Habit tracker & activity logger with powerful visualizations.

</div>

Journey helps you build habits and understand your time. Log the little things every day, then explore trends with fast, friendly charts. Your data stays on your device — no accounts, no servers.

## Why Journey?

- **Privacy-first**: Everything is stored locally in your browser (IndexedDB via Dexie). No cloud, no tracking.
- **Approachable**: Clean daily view for quick logging — numeric values and checkoffs.
- **Insightful**: Heatmaps, timelines, and charts reveal streaks and patterns at a glance.

## Features

- **Daily logging**: Track habits and activities; support for values and notes.
- **Streaks & summaries**: See streaks and progress right in the day view.
- **Trends**:
  - Calendar heatmaps and streak timelines
  - Line, stacked bar, and time‑block visualizations
  - Clock heatmap for time‑of‑day patterns
  - Pan/zoom and fullscreen for deeper dives
- **Customization**: Theme presets, dark mode, pixel art styling.
- **Keyboard & mobile friendly**: Works great on desktop and phones.

## Quick start

Prerequisites: Node 18+ (Node 20+ recommended) and [pnpm](https://pnpm.io/).

```bash
git clone https://github.com/yourname/journey.git
cd journey
pnpm install
pnpm dev
```

Open the printed local URL (typically `http://localhost:5173`).

## Data & privacy

Journey stores your data in your browser using **IndexedDB** via [Dexie](https://dexie.org/). Data never leaves your device unless you export or sync it yourself. Clearing site data or using private/incognito windows may remove your entries. To keep your data, use the same browser/profile and avoid clearing site storage for this app.

## Tech stack

- **React 19**, **TypeScript**, **Vite**
- State/data: **@tanstack/react-query**
- Local DB: **Dexie** (IndexedDB)
- Dates/times: **Luxon**
- UI: **Radix UI**, **Tailwind CSS**, **Lucide** and pixel icons, **sonner** toasts

## Build & deploy

Create a production build and deploy the static `dist/` folder to any static host (Netlify, Vercel, GitHub Pages, etc.).

```bash
pnpm build
```

Hints:
- Netlify: drop `dist/` or connect the repo (build: `pnpm build`, publish: `dist/`).
- Vercel: import repo, framework “Vite”, output `dist/`.

## Contributing

Contributions are welcome! Feel free to open issues and pull requests.

```bash
pnpm lint
pnpm test
pnpm dev
```

Please favor clear TypeScript, small focused PRs, and accessible UI.

## Screenshots

Screenshots live in `docs/screenshots/` (coming soon):

![Day view](docs/screenshots/day-view.png)
![Trends heatmap](docs/screenshots/trends-heatmap.png)
![Line & stacked charts](docs/screenshots/trends-line.png)
![Settings](docs/screenshots/settings.png)

## License

MIT — see [LICENSE](./LICENSE).

## Acknowledgements

This project stands on the shoulders of excellent open source:

- [React](https://react.dev), [Vite](https://vite.dev), [TypeScript](https://www.typescriptlang.org/)
- [Dexie](https://dexie.org), [Luxon](https://moment.github.io/luxon/), [@tanstack/react-query](https://tanstack.com/query/latest)
- [Radix UI](https://www.radix-ui.com/), [Tailwind CSS](https://tailwindcss.com/), [Lucide](https://lucide.dev), [sonner](https://sonner.emilkowal.ski/)
