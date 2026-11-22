import { describe, it, expect, beforeEach } from "vitest";
import { checkAvailability } from "@/lib/availability";
import type { Room, Booking } from "@/types";

describe("checkAvailability", () => {
  let rooms: Room[];
  let bookings: Booking[];
  const currentTime = 540; // 09:00

  beforeEach(() => {
    // Fresh fixtures for every test
    rooms = [
      { id: "r1", name: "Room 1", building: "Main", capacity: 10, blocked: false, equipment: ["Projector", "Whiteboard"] },
      { id: "r2", name: "Room 2", building: "Main", capacity: 5, blocked: false, equipment: ["Projector"] },
    ];
    bookings = [
      // 600 = 10:00, 660 = 11:00
      { id: "b1", roomId: "r1", title: "Meeting", start: 600, end: 660 },
    ];
  });

  it("T01: available when touching after an existing booking (AC4)", () => {
    const result = checkAvailability({ start: 660, end: 720, roomId: "r1", currentTime }, rooms, bookings);
    expect(result).toEqual({ status: "available" });
  });

  it("T02: unavailable when start is exactly current time (AC1)", () => {
    const result = checkAvailability({ start: 540, end: 570, roomId: "r1", currentTime }, rooms, bookings);
    expect(result).toEqual({ 
      status: "unavailable", 
      reason: "Start time must be after the current time (09:00)." 
    });
  });

  it("T03: unavailable when duration is zero (AC1)", () => {
    const result = checkAvailability({ start: 720, end: 720, roomId: "r1", currentTime }, rooms, bookings);
    expect(result).toEqual({ 
      status: "unavailable", 
      reason: "End time must be after start time." 
    });
  });

  it("T04: unavailable when end is before start (AC1)", () => {
    const result = checkAvailability({ start: 750, end: 720, roomId: "r1", currentTime }, rooms, bookings);
    expect(result).toEqual({ 
      status: "unavailable", 
      reason: "End time must be after start time." 
    });
  });

  it("T05: unavailable when end is past 1440 (AC1)", () => {
    const result = checkAvailability({ start: 1380, end: 1441, roomId: "r1", currentTime }, rooms, bookings);
    expect(result).toEqual({ 
      status: "unavailable", 
      reason: "Time must be within 00:00–24:00." 
    });
  });

  it("T06: available when booking is exactly 120 minutes (AC2)", () => {
    const result = checkAvailability({ start: 720, end: 840, roomId: "r1", currentTime }, rooms, bookings);
    expect(result).toEqual({ status: "available" });
  });

  it("T07: unavailable when booking is over 120 minutes (AC2)", () => {
    const result = checkAvailability({ start: 720, end: 841, roomId: "r1", currentTime }, rooms, bookings);
    expect(result).toEqual({ 
      status: "unavailable", 
      reason: "Bookings cannot exceed 120 minutes. Selected: 121 min." 
    });
  });

  it("T08: available when touching before an existing booking (AC4)", () => {
    const result = checkAvailability({ start: 570, end: 600, roomId: "r1", currentTime }, rooms, bookings);
    expect(result).toEqual({ status: "available" });
  });

  it("T09: unavailable on partial overlap (AC4)", () => {
    const result = checkAvailability({ start: 630, end: 690, roomId: "r1", currentTime }, rooms, bookings);
    expect(result).toEqual({ 
      status: "unavailable", 
      reason: 'Overlaps existing booking "Meeting" (10:00–11:00).' 
    });
  });

  it("T10: unavailable when request contains booking (AC4)", () => {
    const result = checkAvailability({ start: 570, end: 690, roomId: "r1", currentTime }, rooms, bookings);
    expect(result).toEqual({ 
      status: "unavailable", 
      reason: 'Overlaps existing booking "Meeting" (10:00–11:00).' 
    });
  });

  it("T11: unavailable when request is inside booking (AC4)", () => {
    const result = checkAvailability({ start: 615, end: 645, roomId: "r1", currentTime }, rooms, bookings);
    expect(result).toEqual({ 
      status: "unavailable", 
      reason: 'Overlaps existing booking "Meeting" (10:00–11:00).' 
    });
  });

  it("T12: unavailable when identical to existing booking (AC4)", () => {
    const result = checkAvailability({ start: 600, end: 660, roomId: "r1", currentTime }, rooms, bookings);
    expect(result).toEqual({ 
      status: "unavailable", 
      reason: 'Overlaps existing booking "Meeting" (10:00–11:00).' 
    });
  });

  it("T13: unavailable when the room is blocked (AC3)", () => {
    rooms[0].blocked = true;
    const result = checkAvailability({ start: 660, end: 720, roomId: "r1", currentTime }, rooms, bookings);
    expect(result).toEqual({ 
      status: "unavailable", 
      reason: "Room 1 is currently blocked." 
    });
  });

  it("T14: available when bookings array is empty (AC4)", () => {
    const result = checkAvailability({ start: 630, end: 690, roomId: "r1", currentTime }, rooms, []);
    expect(result).toEqual({ status: "available" });
  });

  it("T15: data remains unchanged after decisions (AC5)", () => {
    const initialRoomsStr = JSON.stringify(rooms);
    const initialBookingsStr = JSON.stringify(bookings);

    checkAvailability({ start: 660, end: 720, roomId: "r1", currentTime }, rooms, bookings); // Available
    checkAvailability({ start: 600, end: 660, roomId: "r1", currentTime }, rooms, bookings); // Unavailable

    expect(JSON.stringify(rooms)).toBe(initialRoomsStr);
    expect(JSON.stringify(bookings)).toBe(initialBookingsStr);
  });

  it("T16: available when overlapping time but in a different room (AC4)", () => {
    const result = checkAvailability({ start: 600, end: 660, roomId: "r2", currentTime }, rooms, bookings);
    expect(result).toEqual({ status: "available" });
  });

  it("T17: available when ending exactly at 1440 (AC1)", () => {
    const result = checkAvailability({ start: 1380, end: 1440, roomId: "r1", currentTime }, rooms, bookings);
    expect(result).toEqual({ status: "available" });
  });

  // --- NEW TESTS: MISSING BOUNDARIES ---

  it("T18: unavailable when start is less than 0 (AC1 boundary)", () => {
    const result = checkAvailability({ start: -10, end: 60, roomId: "r1", currentTime }, rooms, bookings);
    expect(result).toEqual({ 
      status: "unavailable", 
      reason: "Time must be within 00:00–24:00." 
    });
  });

  it("T19: unavailable when start is strictly before current time (AC1 boundary)", () => {
    const result = checkAvailability({ start: 500, end: 560, roomId: "r1", currentTime }, rooms, bookings);
    expect(result).toEqual({ 
      status: "unavailable", 
      reason: "Start time must be after the current time (09:00)." 
    });
  });

  it("T20: unavailable when start or end is empty/NaN", () => {
    const result = checkAvailability({ start: NaN as number, end: NaN as number, roomId: "r1", currentTime }, rooms, bookings);
    expect(result).toEqual({ 
      status: "unavailable", 
      reason: "Start and end times are required." 
    });
  });

  it("T21: unavailable when roomId does not exist in rooms array", () => {
    const result = checkAvailability({ start: 660, end: 720, roomId: "invalid-id", currentTime }, rooms, bookings);
    expect(result).toEqual({ 
      status: "unavailable", 
      reason: "Please select a room." 
    });
  });
});