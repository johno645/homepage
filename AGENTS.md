# Repository Guidelines

## Project Structure & Module Organization

This is a Next.js 16 homepage using React 19, TypeScript, and Tailwind CSS 4. `app/` contains the page, layout, global styles, and API routes. `app/api/config/route.ts` serves link configuration; `app/api/k8s/ingresses/route.ts` discovers Kubernetes Ingress and Gateway API HTTPRoute resources. Reusable UI lives in `components/`, and shared configuration interfaces live in `types/config.ts`.

`links.config.json` supplies default links. `helm/homepage/` contains the Helm chart; `k8s/` contains legacy manifests and discovery fixtures. Deployment instructions are in `DEPLOYMENT.md` and `helm/README.md`. Automated tests live in `tests/`; there is currently no static asset directory.

## Build, Test, and Development Commands

- `npm ci`: install dependencies from `package-lock.json`.
- `npm run dev`: start development at `http://localhost:3000`.
- `npm run lint`: run ESLint with Next.js Core Web Vitals and TypeScript rules.
- `npm test`: run Node's built-in tests for configuration and Kubernetes route helpers.
- `npm run build`: create the production build with standalone output.
- `podman build --file Containerfile --tag homepage:local .`: build the OCI image locally.
- `npm start`: serve the production build locally.
- `helm lint ./helm/homepage`: validate chart changes.
- `helm template homepage ./helm/homepage`: inspect rendered Kubernetes resources before deployment.

## Coding Style & Naming Conventions

Use two-space indentation, semicolons, and explicit TypeScript interfaces for shared data. Follow the surrounding file's quote style. Name components and their files in PascalCase, such as `LinkCard.tsx`; use camelCase for functions and variables. Preserve Next.js conventions such as `page.tsx`, `layout.tsx`, and `route.ts`. Use the `@/` alias for root-relative imports. Prefer Tailwind utilities for component styling. TypeScript strict mode is enabled; no separate formatter is configured.

## Testing Guidelines

Tests use Node's built-in runner and `*.test.mjs` names. Run `npm test`, `npm run lint`, and `npm run build` before submitting changes. Manually check link rendering, responsive layouts, dark mode, and `/api/config`. For discovery changes, verify `/api/k8s/ingresses` with and without cluster access; use `k8s/test-*.yaml` fixtures only in a development cluster. Document checks and any failures in the PR.

## Commit & Pull Request Guidelines

Existing commits use short descriptive subjects, such as `dockerify it all`; no enforced commit format is evident. Use concise, action-oriented subjects. PRs should explain the behavior change, link relevant issues, list validation, and include screenshots for UI changes. Describe deployment or configuration impacts when applicable.

## Security & Configuration

`HOMEPAGE_LINKS` overrides the JSON defaults and accepts `links` or Helm's `items`. Keep credentials and kubeconfig files out of Git. Development can use local kubeconfig; production uses in-cluster credentials. Preserve narrowly scoped read permissions in Kubernetes RBAC.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
