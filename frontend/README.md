# GlacierWatch frontend

React 18, TypeScript, Vite, Tailwind 4, Mapbox GL (react-map-gl), Recharts.

```bash
cp .env.example .env     # add your Mapbox token
npm install
npm run dev
```

The app expects the API from `../backend` on `VITE_API_URL`. See the root README for the full setup.

## Layout

- `src/detective/`: the guided explorer (pick a lake, pick a variable, read the verdict) and the two case studies
- `src/components/ActionCard.tsx`: temperature slider, risk gauge, arrival times, recommended action
- `src/components/`: shared pieces (trend table, gauge, modals) and the map viewer (`MapView`, `Scrubber`)
- `src/lib/api.ts`: every call to the backend and the GeoJSON loaders
- `src/lib/stats.ts`: rebuilds the Theil-Sen line and its band for the chart
