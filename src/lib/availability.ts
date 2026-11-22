import type { Booking, Decision, IntervalInput, Room } from "@/types";
import { minutesToLabel } from "@/lib/time";

export { minutesToLabel };

const MAX_DURATION = 120; // minutes

export function overlaps(
  a: { start: number; end: number },
  b: { start: number; end: number },
): boolean {
  // Touching endpoints are allowed, so strict inequality.
  return a.start < b.end && b.start < a.end;
}

export function checkAvailability(
  input: IntervalInput,
  rooms: Room[],
  bookings: Booking[],
): Decision {
  const { start, end, roomId, currentTime } = input;

  if (Number.isNaN(start) || Number.isNaN(end)) {
    return {
      status: "unavailable",
      reason: "Start and end times are required.",
    };
  }

  // AC1: 0 ≤ start < end ≤ 1440 and start > currentTime
  if (start < 0 || end > 1440) {
    return {
      status: "unavailable",
      reason: "Time must be within 00:00–24:00.",
    };
  }

  if (start >= end) {
    return {
      status: "unavailable",
      reason: "End time must be after start time.",
    };
  }

  if (start <= currentTime) {
    return {
      status: "unavailable",
      reason: `Start time must be after the current time (${minutesToLabel(currentTime)}).`,
    };
  }

  // AC2: reject bookings longer than 120 minutes
  if (end - start > MAX_DURATION) {
    return {
      status: "unavailable",
      reason: `Bookings cannot exceed ${MAX_DURATION} minutes. Selected: ${end - start} min.`,
    };
  }

  // AC3: reject when room is blocked
  const room = rooms.find((r) => r.id === roomId);

  if (!room) {
    return {
      status: "unavailable",
      reason: "Please select a room.",
    };
  }

  if (room.blocked) {
    return {
      status: "unavailable",
      reason: `${room.name} is currently blocked.`,
    };
  }

  // AC4: reject overlapping intervals
  const conflicting = bookings.filter(
    (b) => b.roomId === roomId && overlaps({ start, end }, b),
  );

  if (conflicting.length > 0) {
    const c = conflicting[0];

    return {
      status: "unavailable",
      reason: `Overlaps existing booking "${c.title}" (${minutesToLabel(c.start)}–${minutesToLabel(c.end)}).`,
    };
  }

  // AC5: available — no booking data modified
  return { status: "available" };
}