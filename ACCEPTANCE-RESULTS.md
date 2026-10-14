# Targeted acceptance results

Verified locally on 2026-10-14 against the production build, which runs obfuscated JavaScript.

| Requirement | Result |
| --- | --- |
| Real backup round trip | PASS. Downloaded an actual JSON file from the UI with holdings, buying prices, price timestamps, contribution IDs, catch-up allocations, decisions, preferences and portfolio snapshots. Imported into a separate clean Chromium context. Compared the complete persisted state, snapshots and active tab with the source, then reloaded and imported the same file again. Exact equality; no duplicate records or snapshots. |
| Failed restore preserves data | PASS. Malformed JSON leaves storage unchanged. A simulated snapshot-storage failure after the plan write rolls back all keys, verified again after reload. Unit checks also fail each of the three transaction writes with both empty and populated storage. |
| User-controlled annual increase | PASS. UI startup preserves saved 0%, 10% and 7.5%. Schedule tests confirm month 12 remains PKR 20,000 and month 13 becomes PKR 20,000 / 22,000 / 21,500 respectively. 10% is only a test example. |
| Field-specific negatives | PASS. Negative quantities, share prices, buying prices, market values and contributions are rejected. A valid -5% return assumption and negative snapshot P&L survive the actual export/import/reload. Existing negative-return downside-scenario tests still pass. |
| Catch-up does not create another debt | PASS. Reapplying, replacing, cancelling and missing a catch-up commitment leave the original debt calculation unchanged. Missing January's PKR 20,000 and February's PKR 20,000 produces a PKR 40,000 gap, including when February had an extra PKR 20,000 catch-up target. Paying PKR 25,000 reduces the gap to PKR 15,000. |
| Catch-up horizon | PASS. Allocation is bounded to the journey's final month. PKR 20,001 across the last two available months becomes 10,001 + 10,000. The modal discloses shortened availability and blocks allocation when no future month remains. |
| Future schedule edits preserve past commitments | PENDING. There is no effective-dated journey schedule editor. Editing plan inputs does not update the active journey schedule; its original fields remain fixed. |
| Updated projection / original baseline | Calculation checks PASS: past actual deposits replace past scheduled deposits, opening capital is counted once, negative growth stays negative, and the supplied original schedule is not mutated. PENDING: the updated-projection function is not wired into the UI, and there is no displayed original-versus-updated baseline comparison. |
| Prior regression coverage | PASS. All existing suites retained. PSX has 26 passing tests; no tests were removed or consolidated. There is no Git history in the supplied folder, so earlier claims of 9/14 tests cannot be reconciled. Both portfolio suites ran. |
| Narrow screens | PASS. Production app checked at 320×844, 390×844 and 1280×844. Fixed chart overflow and stacked the narrow-screen heading/action. Captured and visually reviewed full-page screenshots. |
| Storage help | Fixed to: “Clearing this site's data removes saved progress.” |

## Commands and evidence

```sh
npm ci
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:browser
```

`test:browser` runs `node scripts/test-acceptance-playwright.mjs`, starts a production preview on 127.0.0.1:4173, and closes its browser and server afterward. CI installs Chromium system dependencies as well. The browser suite checks for JavaScript runtime errors and page-level horizontal overflow.

- Existing suites: acceptance, finance (17), journey (55 assertions), portfolio (3), portfolioAcceptance (4), PSX (26), scenarios (5).
- Added `journeyAcceptance.test.ts` for the targeted accounting, preservation and failure checks.
- Corrected a stale hardcoded “27” summary in the existing journey suite; it actually executes 55 assertions.
- [320px screenshot](tests/screenshots/acceptance/journey-320.png)
- [390px screenshot](tests/screenshots/acceptance/journey-390.png)
- [Desktop screenshot](tests/screenshots/acceptance/journey-1280.png)
- [Downloaded test backup](tests/screenshots/acceptance/round-trip.json) contains synthetic test data only.

## Files changed

- `src/utils/backup.ts`: validate holding fields; preserve restore timestamps; detect failed snapshot persistence; roll back all three keys.
- `src/utils/storage.ts`: avoid changing timestamps on unchanged saves/reloads, regardless of object-key order.
- `src/utils/psxService.ts`: preserve buying price, purchase date and quote error when loading holdings.
- `src/utils/journey.ts`: exclude catch-up from cumulative debt; bound catch-up distributions; preserve negative projection growth; injectable projection date for deterministic checks.
- `src/components/CatchUpModal.tsx`: respect the remaining horizon and use the actual next-month regular amount.
- `src/components/JourneyView.tsx`: preserve saved zero values; repair narrow-screen layout and chart scrolling.
- `src/components/Header.tsx`: corrected storage wording.
- `src/tests/journeyAcceptance.test.ts`, `src/tests/journey.test.ts`, `scripts/run-tests.mjs`, `scripts/test-acceptance-playwright.mjs`: targeted checks, retained regression coverage and reproducible browser evidence.
- `vite.config.ts`, `package.json`, `package-lock.json`, `.github/workflows/pages.yml`: Pages paths, compatible esbuild dependency, reproducible installation, production obfuscation and deployment workflow.

## Deployment and remaining limitations

Prepared the [GitHub Pages workflow](.github/workflows/pages.yml) using GitHub's [custom workflow guidance](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages). It runs type checking, all regression suites, production build and browser acceptance before deploying `dist` on pushes to `main`. Relative asset paths support project repository URLs. Select **GitHub Actions** as the repository's Pages source.

The build uses [javascript-obfuscator](https://github.com/javascript-obfuscator/javascript-obfuscator) and emits no source maps. The browser executes the resulting obfuscated code; the obfuscation library runs during the build. This raises the effort required to read the bundle but cannot make client-side logic secret. A public source repository would also expose the original source. The bundle is about 513 KB before gzip, and Vite reports its usual >500 KB chunk warning.

Deployment target: `mughal41/Horizon`, branch `main`. The GitHub Actions run is the authoritative record of publishing status.

Browser-local storage and backup-based device transfers remain unchanged. Live quotes still depend on the external quote provider; live provider availability/CORS from the eventual GitHub Pages origin has not been verified. If the browser refuses both restore writes and rollback writes, the app reports rollback failure; localStorage cannot guarantee an atomic transaction across several keys under permanent storage failure or a browser crash.
