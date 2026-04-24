# Repository Guidelines

## Project Structure & Module Organization
`src/` contains the application. Core gameplay logic lives in `src/game/` (`engine.ts`, `ThreeRenderer.ts`, `types.ts`), the Three.js host component is `src/components/KarateGame.tsx`, and route entry points live in `src/pages/`. Shared helpers are under `src/lib/` and `src/hooks/`. Tests live in `src/test/`. Static files belong in `public/`. Build output goes to `dist/` and should not be edited manually.

## Build, Test, and Development Commands
- `npm install`: install dependencies. Although `bun.lock` files exist, the current local workflow is `npm`.
- `npm run dev`: start Vite on `http://localhost:8080`.
- `npm run build`: create the production bundle in `dist/`.
- `npm run build:dev`: build with development mode settings.
- `npm run preview`: serve the built app locally.
- `npm run lint`: run ESLint across `ts` and `tsx` files.
- `npm test`: run the Vitest suite once.
- `npm run test:watch`: run Vitest in watch mode during development.

## Coding Style & Naming Conventions
Use TypeScript and React function components. Follow the existing file style: double quotes in most app files, semicolons enabled, and 2-space indentation. Use the `@/` alias for imports from `src/`. Name React components in `PascalCase`, hooks as `useSomething`, and keep game-domain helpers descriptive (`getScoreAward`, `updateGame`). Prefer small pure functions in `src/game/` for rules and state updates.

## Testing Guidelines
Vitest runs in `jsdom` and includes `src/**/*.{test,spec}.{ts,tsx}`. Keep tests near `src/test/` unless a feature benefits from colocated coverage. Name files by behavior, for example `scoring.test.ts` or `ai.test.ts`. Add or update tests whenever gameplay rules, scoring, AI, or input handling change. No coverage gate is enforced now, so reviewers will expect targeted assertions for touched behavior.

## Commit & Pull Request Guidelines
Prefer clear conventional-style commits such as `feat: refine parry timing` or `chore: update docs`. The recent history already uses `feat:` and `chore:`; avoid vague messages like `Changes`. PRs should include a short summary, test commands run, and screenshots or a GIF for visible UI or Three.js scene changes. Link the related issue when one exists.
