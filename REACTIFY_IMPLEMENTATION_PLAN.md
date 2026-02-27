# The Quisling: Reactify Implementation Plan (Frontend-Only)

## 1. Purpose
Convert the current mostly static React UI into a functional frontend app with:

- Local-only account creation/login/logout (browser storage; no backend yet)
- Functional game loop on the `GamePage` (room code, timer, clickable buildings, phase/status updates, buttons wired)
- Persisted user profile data scaffolded for easy future backend migration
- Functional `ResultsPage` based on completed game data

This plan is written as execution instructions for an AI coding agent to implement step-by-step.

## 2. Scope and Constraints

- Keep existing visual styling and page structure as much as possible.
- Use current stack: Vite + React + React Router + Tailwind.
- No server, no WebSocket yet.
- Persist all state in `localStorage` with versioned keys.
- Treat credential storage as temporary/insecure dev behavior (explicitly documented in code comments and README updates).
- Do not remove existing routes/pages; enhance them.

## 3. Current Baseline (Confirmed)

- Routes exist for `/`, `/game`, `/profile`, `/results`, `/credits`, `/404`.
- `HomePage`, `GamePage`, `ProfilePage`, `ResultsPage` are mostly static placeholders.
- `GamePage` includes static room code (`ABCD`), placeholder timer bar, map image, help dialog.
- `ProfilePage` has login/create account form but no behavior.
- `ResultsPage` renders static mock results.

## 4. Target Architecture

Implement with lightweight feature modules + context/state hooks.

### 4.1 Recommended directories/files to add

Create these folders/files:

- `src/context/AuthContext.jsx`
- `src/context/GameContext.jsx`
- `src/components/ProtectedRoute.jsx`
- `src/components/RequireGameSession.jsx`
- `src/lib/storage.js`
- `src/lib/roomCode.js`
- `src/lib/time.js`
- `src/lib/gameEngine.js`
- `src/lib/gameConfig.js`
- `src/hooks/useLocalStorageState.js`
- `src/hooks/useGameTimer.js`
- `src/constants/storageKeys.js`
- `src/constants/buildings.js`
- `src/constants/gamePhases.js`

Optional UI components if needed for clarity/reuse:

- `src/components/game/MapBuildingButton.jsx`
- `src/components/game/GameStatusPanel.jsx`
- `src/components/game/GameTimer.jsx`
- `src/components/auth/AuthForm.jsx`

### 4.2 Storage keys (versioned)

Use these keys:

- `quisling.users.v1`
- `quisling.session.v1`
- `quisling.games.v1`
- `quisling.gameSession.v1`
- `quisling.results.v1`

### 4.3 Core entities (shape contracts)

Implement these JS object shapes consistently:

```js
// User
{
  id: "usr_xxx",
  email: "user@example.com",
  password: "plaintext-for-now", // TEMP ONLY, frontend mock
  displayName: "Player Name",
  createdAt: "ISO date",
  stats: {
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    totalScore: 0,
    bestScore: 0
  },
  friends: [],
  history: [] // array of result IDs or compact summary objects
}
```

```js
// Active auth session
{
  userId: "usr_xxx",
  email: "user@example.com",
  displayName: "Player Name",
  loggedInAt: "ISO date"
}
```

```js
// Current local game session
{
  id: "game_xxx",
  roomCode: "ABCD",
  userId: "usr_xxx",
  playerName: "Player Name",
  role: "Infiltrator" | "Lookout" | "Saboteur" | "Engineer",
  phase: "planning" | "action" | "resolution" | "complete",
  startedAt: "ISO date",
  durationSeconds: 180,
  remainingSeconds: 180,
  selectedBuildingId: null,
  actionLog: [],
  score: 0,
  objectiveProgress: 0,
  penalties: 0
}
```

```js
// Saved result record
{
  id: "result_xxx",
  gameId: "game_xxx",
  userId: "usr_xxx",
  roomCode: "ABCD",
  outcome: "win" | "loss",
  score: 0,
  summary: {
    buildingsHit: [],
    turnsPlayed: 0,
    timeRemaining: 0
  },
  completedAt: "ISO date"
}
```

## 5. Routing and Access Rules

### 5.1 Route behavior

- `/profile`: always accessible.
- `/`: accessible, but if unauthenticated and user tries join/create, redirect to `/profile` with message.
- `/game`: requires authenticated user and valid game session; otherwise redirect to `/` or `/profile`.
- `/results`: requires most recent completed result for user; if missing, redirect to `/`.

### 5.2 Route wrappers

- `ProtectedRoute`: ensures auth session exists.
- `RequireGameSession`: ensures active game exists before `GamePage`.

Integrate wrappers in `src/App.jsx`.

## 6. Game Model (Frontend Simulation)

### 6.1 Building definitions

Create `src/constants/buildings.js` with fixed building metadata:

- `id`, `label`, map position (`xPct`, `yPct`)
- `difficulty`
- `rewardPoints`
- `penaltyPoints`
- optional `cooldownTurns`

Use 5-8 buildings to match game UI complexity.

### 6.2 Room code requirements

- 4 uppercase letters only (`A-Z`).
- On create: generate code and avoid collisions against recent local sessions.
- On join: normalize input to uppercase; validate format and existence in local game/session records.

### 6.3 Timer behavior

- `durationSeconds` default: 180 (configurable constant).
- Starts on game start.
- Ticks every second via `useGameTimer`.
- Pauses when help modal open (optional but recommended).
- On `remainingSeconds <= 0`: force game end, compute result, navigate `/results`.

### 6.4 Phase behavior

Phases:

- `planning`: choose building (map click), prep action
- `action`: commit action for selected building
- `resolution`: apply score/penalty, log outcome, check win/loss condition
- `complete`: lock controls, persist result

Each primary button must be phase-aware and disabled when invalid.

## 7. Step-by-Step Implementation Plan

## Step 0: Create feature branch and verify baseline

Tasks:

- Create branch: `feature/reactify-frontend-flow`
- Run app and verify existing pages load.

Done when:

- Project runs with no baseline build errors.

## Step 1: Add typed-like contracts and storage utilities

Tasks:

- Add `storageKeys.js` constants.
- Add `storage.js` helpers:
  - `readJSON(key, fallback)`
  - `writeJSON(key, value)`
  - `updateJSON(key, updaterFn)`
  - safe parsing + fallback on malformed data
- Add ID helper and timestamp helper in `time.js` or `storage.js`.

Done when:

- All later state modules import from one storage abstraction.

## Step 2: Implement auth state layer

Tasks:

- Create `AuthContext` with:
  - `user`
  - `isAuthenticated`
  - `login(email, password)`
  - `register({ email, password, displayName })`
  - `logout()`
  - `updateProfile(partialUserData)`
- Persist users and session in localStorage.
- On app mount, hydrate session from `quisling.session.v1`.
- Add inline validation:
  - valid email format
  - password minimum length (e.g. 8)
  - unique email on registration
- Add clear error messages returned by context methods.

Done when:

- Refreshing page keeps logged-in user session.
- Invalid credentials produce deterministic errors.

## Step 3: Wire global providers in app root

Tasks:

- Wrap `App` with `AuthProvider` in `src/main.jsx`.
- Add `GameProvider` placeholder with minimal state and setters.

Done when:

- App still renders all routes with providers active.

## Step 4: Build routing guards

Tasks:

- Add `ProtectedRoute` and `RequireGameSession`.
- Update `App.jsx` route definitions:
  - Guard `/game`
  - Guard `/results` if no result exists
- Use router state/query to pass redirect reason messages.

Done when:

- Direct navigation to restricted routes redirects correctly.

## Step 5: Reactify Profile page (Auth + user data)

Tasks:

- Convert `ProfilePage` to mode-based UI:
  - logged out: register/login form
  - logged in: account summary, editable display name, logout button
- Split submit intent:
  - Login button triggers login
  - Create Account button triggers register
- Render dynamic stats and history from stored user data.
- Keep “Friends” section as scaffold with clearly marked mock data.

Done when:

- User can create account, log in, log out, and see persisted profile data.

## Step 6: Reactify Home page (join/create room flow)

Tasks:

- Gate join/create behind auth check.
- Prefill `name` from logged-in profile display name.
- Create room:
  - generate unique 4-letter room code
  - create new game session object
  - navigate to `/game`
- Join room:
  - validate room code format
  - load existing game seed/session (or create local simulated join state)
  - navigate to `/game`
- Show inline form errors for invalid/missing room codes.

Done when:

- Both buttons perform deterministic actions and persist session context.

## Step 7: Implement game state engine + timer hook

Tasks:

- Add `gamePhases.js`, `gameConfig.js`, `gameEngine.js`.
- Implement pure functions:
  - `startGame(session)`
  - `selectBuilding(session, buildingId)`
  - `commitAction(session)`
  - `resolveTurn(session)`
  - `computeOutcome(session)`
- Add `useGameTimer` hook with start/pause/reset/expire callbacks.
- Persist game session after every state transition.

Done when:

- Game logic can run independently of UI with predictable transitions.

## Step 8: Reactify Game page UI interactions

Tasks:

- Replace static values with live state:
  - room code
  - player name/role
  - phase hint text
  - timer display and progress bar
- Overlay clickable building buttons on the map:
  - keyboard accessible buttons
  - selected/disabled visual states
- Wire primary game controls:
  - select building
  - perform action
  - end turn/next phase
  - leave room (with confirmation)
- Keep help dialog functional without breaking timer state.
- Add action log panel showing recent events.

Done when:

- Every interactive control changes state and UI in a visible, testable way.

## Step 9: Implement result generation and persistence

Tasks:

- On game complete (objective met, failure threshold hit, or timer expiry):
  - compute result object
  - store in `quisling.results.v1`
  - update user stats/history
  - clear active game session or mark ended
- Navigate to `/results`.

Done when:

- Completed game reliably produces persisted results and updated profile stats.

## Step 10: Reactify Results page

Tasks:

- Load latest result for logged-in user (or selected result by ID).
- Replace static mock content with dynamic values:
  - outcome
  - score
  - turn breakdown / action log summary
  - room code and completion timestamp
- Add actions:
  - Play again (new game in same room or create new)
  - Back to lobby
  - View profile

Done when:

- Results page fully reflects actual last completed game state.

## Step 11: Profile stats integration

Tasks:

- Ensure user stats are derived and persisted after each game:
  - `gamesPlayed`, `wins`, `losses`, `winRate`, `totalScore`, `bestScore`
- Render recent game history (e.g., last 5 results) in `ProfilePage`.

Done when:

- Profile displays real saved data and updates after each game cycle.

## Step 12: QA pass and guardrails

Tasks:

- Add defensive empty/loading/fallback states on all pages.
- Handle corrupted localStorage gracefully (reset with warning).
- Validate mobile layout still works with map controls and timer.
- Run lint/build and fix errors.

Done when:

- `npm run build` passes and manual user flows succeed.

## 8. Required Manual Test Checklist

Execute and verify:

1. Register new user -> login persists on refresh.
2. Duplicate email registration rejected.
3. Wrong password login rejected.
4. Unauthenticated user cannot access `/game`.
5. Create room generates valid 4-letter uppercase code.
6. Join room rejects invalid codes (`abc`, `1234`, empty).
7. Timer counts down and triggers game completion at 0.
8. Building click changes selection and updates phase action availability.
9. Completing game navigates to results with real data.
10. Profile stats update after win/loss.
11. Logout clears session and protected routes redirect.
12. Reloading app restores latest persisted user/game/result state safely.

## 9. Migration Hooks for Future Backend

Design now so backend swap is minimal:

- Keep auth/game actions behind context methods (single replacement seam).
- Keep storage access centralized (`storage.js`) so API calls can replace internals.
- Keep pure game logic in `gameEngine.js` to share with server validation later.
- Keep data shapes stable and versioned.

## 10. Definition of Done

The “Reactify” phase is complete when:

- Login/register/logout works fully on frontend with persistent local session.
- Home/game/results/profile pages are functionally connected end-to-end.
- Game page controls (timer, building interactions, phase buttons, leave flow) all work.
- Results and profile stats are generated from actual gameplay state.
- Route guards prevent invalid access paths.
- Build succeeds and manual checklist passes.

## 11. Implementation Notes for the Coding Agent

- Reuse existing page/component files; avoid large rewrites unless needed.
- Favor small pure utility functions over large page-level handlers.
- Keep behavior deterministic; avoid random scoring unless intentionally configured.
- Add brief comments only where logic is non-obvious.
- Preserve current Tailwind classes and visual style unless interaction states require additions.
- If introducing test tooling later, do so in separate PR/step to reduce risk in this implementation pass.
