# Field Desk service-worker pre-retirement QA

Status: PLAN ONLY — no production execution

Verified current worker authority:
- root runtime registers `./service-worker.js`;
- cache name: `nycif-rc-public-map-v12`;
- application shell is pre-cached;
- activate removes other cache names;
- `skipWaiting()` and `clients.claim()` take control promptly;
- `raw.githubusercontent.com` is treated as network-first and cacheable.

## Preconditions before any retirement execution

All must be true:
1. Certified MapLibre runtime is ready.
2. Reader-safe hosted endpoint passes anonymous GET and browser CORS.
3. Anonymous browser network audit passes with zero Field Desk/raw-source/private-host requests.
4. WordPress `/map/` replacement rehearsal passes on desktop, mobile and rollback.
5. No public navigation requires the Field Desk root runtime.
6. Rollback package and worker source are archived.

## Rehearsal matrix

### A. Fresh profile, no worker
- Confirm zero registrations under the Field Desk Pages origin.
- Open canonical `https://nycinfocus.com/map/`.
- Confirm MapLibre runtime loads without Field Desk requests.
- Expected: no Field Desk service-worker control.

### B. Existing profile controlled by legacy worker
- Record `navigator.serviceWorker.getRegistrations()` before any action.
- Record active/waiting/installing worker URLs and scopes.
- Enumerate Cache Storage names and verify whether `nycif-rc-public-map-v12` exists.
- Open the old Field Desk root and confirm control state.
- Navigate to canonical `/map/` and capture all network requests.
- Expected before retirement: legacy Field Desk origin may remain controlled; canonical map must not require it.

### C. Offline behavior
- With old cache present, set browser offline.
- Open the old Field Desk root and record whether cached shell renders.
- Open canonical `/map/` in a profile where its certified runtime was previously loaded.
- Record behavior; do not infer success from a cached Field Desk shell.

### D. Network restored
- Restore network.
- Reload canonical `/map/` with cache disabled once and capture requests.
- Require zero requests to raw GitHub, Field Desk runtime, localhost, private hosts, private source endpoints or credential-bearing URLs.

### E. Future controlled unregister rehearsal
Do not execute until production approval.
Expected procedure:
1. Enumerate registrations for the Field Desk origin.
2. Match only the exact legacy Field Desk registration/scope.
3. Call `unregister()` only on the matched registration.
4. Verify result is `true`.
5. Close/reopen controlled clients and verify no registration reappears.
6. Delete only the exact legacy cache name after registration removal is proven.
7. Verify other origin caches are untouched.
8. Reload old Field Desk route and canonical `/map/`.
9. Confirm canonical `/map/` remains healthy and no old worker controls a client.

### F. Rollback rehearsal
Before retirement, preserve:
- `service-worker.js` exact source;
- root `index.html` registration code;
- cache-name inventory;
- Field Desk main/head commit reference;
- recovery/archive manifest.

If cutover validation fails, restore the prior public runtime by the approved rollback route. Do not recreate worker state ad hoc from memory.

## Pass gate for retirement

Retirement may be proposed only when:
- PUBLIC_RUNTIME can truthfully change from 2 toward 0 because the root runtime and worker are no longer required;
- anonymous hosted proof PASS;
- WordPress `/map/` rehearsal PASS;
- rollback evidence complete;
- no public consumer/import/link/workflow requires Field Desk.

Actual unregister/cache deletion remains a production action and is not authorized by this document.
