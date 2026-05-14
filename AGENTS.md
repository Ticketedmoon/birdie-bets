<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Testing & Coverage

- **Always run `npm run test:coverage` before committing** to ensure all tests pass and coverage thresholds are met.
- Coverage is enforced at **90% minimum** for lines, branches, functions, and statements on `src/lib/` modules (configured in `vitest.config.ts`).
- If you add new logic in `src/lib/`, add corresponding tests in `src/__tests__/` to maintain coverage.
- Tests use Vitest with `vi.mock()` for external dependencies (Firebase, ESPN API, etc.).
