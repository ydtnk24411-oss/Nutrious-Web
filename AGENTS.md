# Repository Guide

## Project layout
- `src/` is the Angular 19 storefront and admin UI. App routes are standalone, lazy-loaded components in `src/app/app.routes.ts`; shared services, guards, interceptors, and models live under `src/app/shared/`.
- `server/` is the Express and Mongoose API. Routes, models, and middleware are directly under `server/routes/`, `server/models/`, and `server/middleware/` (there is no `server/src/` directory).
- `server/index.js` mounts API routers under `/api` and installs the shared error handler.

## Working conventions
- Keep changes within the owning page/component, shared service, API route, model, or middleware. Reuse existing patterns before introducing new abstractions or dependencies.
- For frontend navigation, update the Angular routes and preserve lazy loading. Keep component styles and templates alongside their component TypeScript files.
- For API endpoints, follow the existing Express router and Mongoose model patterns. Apply `protect` and `adminOnly` where required, and pass async errors to the centralized error handler.
- Add or update nearby Angular specs for behavior changes. Do not assume a backend test command exists; `server/package.json` currently defines only `start`, `dev`, and `seed`.
- Never commit secrets or local environment files. Backend configuration comes from `server/.env`.

## Commands
Run frontend commands from the repository root:
- `npm run dev` starts Angular at `http://localhost:4200`.
- `npm run build` creates a production build.
- `npm run typecheck` runs an Angular development build.
- `npm test` runs the Angular tests.

Run backend commands from `server/` after installing its dependencies and configuring MongoDB:
- `npm run dev` starts the API with Nodemon.
- `npm start` starts the API without Nodemon.
- `npm run seed` seeds the configured database; use only when intended.
