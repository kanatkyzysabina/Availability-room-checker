import { describe, it, expect, beforeEach } from "vitest";
import { filterRooms } from "@/lib/filterRooms";
import type { Room } from "@/types";

describe("filterRooms", () => {
  let rooms: Room[];

  function makeRooms(): Room[] {
    return [
      { id: "r1", name: "Room 1", building: "Main", capacity: 10, blocked: false, equipment: ["Projector", "Whiteboard"] },
      { id: "r2", name: "Room 2", building: "Main", capacity: 5,  blocked: false, equipment: ["Projector"] },
      { id: "r3", name: "Room 3", building: "Main", capacity: 20, blocked: true,  equipment: ["Projector", "Whiteboard", "Microphone"] },
    ];
  }

  beforeEach(() => {
    rooms = makeRooms();
  });

  it("F1a: includes rooms with capacity exactly equal to attendees", () => {
    const result = filterRooms(rooms, { attendees: 10, requiredEquipment: [] });
    expect(result.map((r) => r.id)).toEqual(["r1", "r3"]);
  });

  it("F1b: excludes rooms with capacity below attendees", () => {
    const result = filterRooms(rooms, { attendees: 6, requiredEquipment: [] });
    expect(result.map((r) => r.id)).toEqual(["r1", "r3"]);
    expect(result.find((r) => r.id === "r2")).toBeUndefined();
  });

  it("F2a: includes rooms that have ALL required equipment", () => {
    const result = filterRooms(rooms, { attendees: 0, requiredEquipment: ["Projector", "Whiteboard"] });
    expect(result.map((r) => r.id)).toEqual(["r1", "r3"]);
  });

  it("F2b: excludes rooms missing one required equipment item", () => {
    const result = filterRooms(rooms, { attendees: 0, requiredEquipment: ["Projector", "Whiteboard", "Microphone"] });
    expect(result.map((r) => r.id)).toEqual(["r3"]);
    expect(result.find((r) => r.id === "r1")).toBeUndefined();
  });

  it("F2c: empty equipment requirements include all rooms", () => {
    const result = filterRooms(rooms, { attendees: 0, requiredEquipment: [] });
    expect(result.map((r) => r.id)).toEqual(["r1", "r2", "r3"]);
  });

  it("F4: returns empty array when no rooms match the filters", () => {
    const result = filterRooms(rooms, { attendees: 50, requiredEquipment: [] });
    expect(result).toEqual([]);
  });

  it("F5: does not mutate input rooms or their equipment arrays", () => {
    const before = JSON.stringify(rooms);
    const originalEquipment = rooms.map((r) => r.equipment.slice());

    filterRooms(rooms, { attendees: 5, requiredEquipment: ["Projector"] });

    expect(JSON.stringify(rooms)).toBe(before);
    expect(rooms.map((r) => r.equipment)).toEqual(originalEquipment);
  });
});
