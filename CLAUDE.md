# mustachebash.com

## Overview
Public-facing Astro website for Mustache Bash events. Handles ticket sales (Braintree Web Drop-in), event info, gallery, ticket lookup, and city-specific pages. Dev server on port 4321.

## Tech Stack
- **Framework**: Astro 5 + React 19 (islands)
- **Build**: Vite
- **Payments**: braintree-web (client-side drop-in)
- **Utilities**: date-fns, classnames, qrcode, swiper

## Project Structure
```
src/
├── pages/              # Astro file-based routing
│   ├── index.astro     # Homepage
│   ├── info/           # Event info pages
│   ├── gallery/        # Photo gallery
│   ├── my-tickets/     # Ticket lookup
│   ├── privacy-policy/
│   ├── san-diego/      # City pages
│   ├── san-francisco/
│   └── tradition/
├── components/         # Shared Astro/React components
├── layouts/            # Page layouts
├── styles/             # Global styles
└── img/                # Static images
public/                 # Static assets (copied as-is)
```

## Commands
```bash
npm start         # astro dev (used in Docker)
npm run build     # astro check + astro build → dist/
npm run preview   # astro preview
npm test          # astro check + tsc --noEmit
npm run format    # prettier --write
npm run lint      # prettier check + eslint
```

## Environment Variables
Configured via Astro's typed env schema (`astro.config.mjs`):
- `API_HOST` — public, client-side, string (URL of the API)
- `BRAINTREE_TOKEN` — public, client-side, string (Braintree client token)

In dev these come from `.env`. Production build requires `.env.production`.

## Config Notes
- `trailingSlash: 'never'` — no trailing slashes on URLs
- `site: 'https://mustachebash.com'`
- Assets output to `/assets/`
- Source maps enabled in production (mapped to `https://mustachebash.com/assets/`)
- React integration enabled for interactive islands

## Production Build
Multi-stage Docker build → nginx serving static files via `mustachebash.conf`.
Also serves Apple Pay domain association file at the nginx level.
