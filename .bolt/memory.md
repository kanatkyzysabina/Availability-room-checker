# Project memory

## Product intent & audience

- Room availability checker app: users select a start time and check whether rooms are available, with validation that start time must be after the current time.
- Production-quality, fully-featured web app (not a demo).

## Brand personality & voice

- Precise, engineering-focused; UI labels are plain ("Current time", "Check Availability").

## Visual design & UX direction

- React + Tailwind CSS + lucide-react icons (per `.bolt/prompt`).
- RoomChecker component displays a "Current time" label and a "Check Availability" button; default start time appears to be 09:30.
- Time values are displayed and rounded to five-minute increments.

## Decisions, constraints & rationale

- Stack: Vite + React + TypeScript; Vitest for tests; @testing-library/react for DOM.
- **Vitest `globals` are NOT enabled**: Testing Library's auto-cleanup does not run. Test files need an explicit file-level `afterEach(cleanup)` to prevent DOM leakage between tests.
- **`userEvent` hangs under fake timers** (it awaits timer-driven microtasks that never flush). Use `fireEvent` for synchronous, timer-independent clicks when fake timers are active; `userEvent` is fine under real timers.
- Path alias `@/` → `src/` (per `.bolt/prompt`); no deep relative paths.
- RoomChecker.tsx recomputes wall-clock time inside `handleCheck` at click time (five-minute rounding), updates `currentTime` state, and passes the fresh value to `checkAvailability`.
- `availability.ts`, `overlaps`, `filterRooms`, room data, and equipment filters are stable and should not be modified unless explicitly requested.
- Pre-existing Browserslist warning (`npx update-browserslist-db@latest`) is informational; not a build failure.

## Open questions & assumptions

- Test counts at last run: 30 total (21 availability + 7 filterRooms + 2 UI). May change as tests are added.
- Project may expand beyond the single RoomChecker view; no router observed yet.