# Contributing

## Before you start

- Use Node.js 22.13.0 or newer.
- Create a short-lived branch from the latest shared branch.
- Keep secrets in `.env.local`. Never commit API keys.
- Keep refactoring separate from feature changes.

## Local setup

```bash
npm ci
```

Copy `.env.example` to `.env.local` only when a task needs live providers.
The default test suite does not require provider keys.

## Development

```bash
npm run dev
```

Match the existing TypeScript and React style. Prefer small functions, explicit
types at module boundaries, and direct code over speculative abstractions.

## Verification

Run the same checks used by GitHub Actions:

```bash
npm run check
```

The command must pass before requesting review. If a live-provider path changed,
also document the manual test performed and keep credentials out of logs.

## Pull requests

- Explain the problem and the chosen solution.
- List the verification commands and results.
- Add screenshots for visible interface changes.
- Call out configuration, data, or deployment implications.
- Do not merge unrelated cleanup into the same pull request.
