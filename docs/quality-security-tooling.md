# Quality and security tooling

HVAC Plan Studio keeps product behavior and release safety separate. These checks protect the existing drawing workflow without changing geometry, reducers, or plan data.

## Pull request gates

- `npm run typecheck` keeps strict TypeScript at zero errors.
- `npm run lint` rejects ESLint errors while the documented warning backlog remains visible.
- `npm test` builds the production artifact, validates the packaged Worker, runs all unit tests, and exercises the loaded-plan browser suite.
- `npm run test:lighthouse` audits performance, accessibility, best practices, and SEO with measured baseline thresholds.
- The browser suite includes axe-core. Critical accessibility findings fail the build; serious findings are attached to the test report for planned remediation.

## Repository automation

- CodeQL runs JavaScript and TypeScript security analysis on pull requests, pushes to `main`, and a weekly schedule.
- OSV-Scanner checks the dependency tree on pull requests, pushes, merge queues, and a weekly schedule.
- Renovate is configured for reviewed dependency updates. Major upgrades require explicit dashboard approval and no dependency is auto-merged.

The Renovate GitHub App still has to be enabled for this repository before `renovate.json` can create pull requests.

## Monitoring

`@sentry/react` is installed but intentionally inactive. No DSN is configured and no application data is transmitted. Enable it only after the production project, privacy notice, data-scrubbing rules, and release environment are approved.

## Dependency audit baseline

The lockfile has no known high or critical npm advisories. Four moderate advisories remain in `drizzle-kit`'s legacy development-only esbuild loader. npm's suggested remediation downgrades `drizzle-kit` to `0.18.1`, so it is not applied automatically; OSV and Renovate keep this visible until an upstream-compatible fix is available.
