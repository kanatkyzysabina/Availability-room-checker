# Smart Campus Room Availability Checker

A small web application that helps students check whether a campus room is free for a requested time slot. Users set an attendee count, required equipment, a room, and a start/end time, then click **Check Availability** to see whether the room can be booked.

## Technology stack

- React 18
- TypeScript 5
- Vite 5 (dev server and production build)
- Tailwind CSS 3 (styling)
- Vitest 2 (unit and component tests) with React Testing Library

## Requirements

- Node.js 18 or newer
- npm (bundled with Node.js)

## Installation and development

```bash
npm install
npm run dev
```

`npm run dev` starts the Vite dev server. `npm run preview` serves the production build locally for review.

## Commands

| Command | Description |
| --- | --- |
| `npm install` | Install dependencies. |
| `npm run dev` | Start the development server. |
| `npm run test` | Run the full Vitest test suite once. |
| `npm run typecheck` | Type-check the project with `tsc` (no output emitted). |
| `npm run lint` | Run ESLint over the project. |
| `npm run build` | Build the production bundle into `dist/`. |
| `npm run preview` | Preview the production build locally. |

## Project structure

```
index.html
src/
  main.tsx            Application entry point
  App.tsx             Root component
  index.css           Global styles (Tailwind directives)
  types.ts            Shared TypeScript types
  data.ts             Fictional sample rooms and bookings
  components/
    RoomChecker.tsx        Room availability form and result UI
    RoomChecker.test.tsx   Component tests (React Testing Library)
  lib/
    availability.ts        Booking validation and availability rules (AC1-AC5)
    availability.test.ts   Tests for booking rules
    filterRooms.ts         Capacity and equipment filtering (F1-F2)
    filterRooms.test.ts    Tests for room filtering
    time.ts                Time conversion helpers
```

## Acceptance criteria (AC1-AC6)

- **AC1**: Reject invalid intervals and booking start times that are in the past.
- **AC2**: Reject bookings longer than 120 minutes.
- **AC3**: Reject blocked rooms.
- **AC4**: Reject overlapping bookings, but allow touching endpoints (one booking ends at 10:00, another starts at 10:00).
- **AC5**: Return a clear decision without changing existing booking data.
- **AC6**: Keep clear feedback on both desktop and mobile screens.

## Room filtering features (F1-F5)

- **F1**: Rooms must have capacity greater than or equal to the requested attendees.
- **F2**: Rooms must contain all selected required equipment items.
- **F3**: A blocked room is never reported as available.
- **F4**: Show a clear message when no rooms match the filters.
- **F5**: Changing the selected room refreshes the availability result.

## Sample data

All rooms and bookings use **fictional sample data** defined in `src/data.ts`. No real campus rooms, people, or scheduling systems are involved.

## Current limitations

- No backend or database: data lives only in memory and resets on reload.
- No login or user accounts.
- No real booking creation: checking availability does not save or modify any booking.
