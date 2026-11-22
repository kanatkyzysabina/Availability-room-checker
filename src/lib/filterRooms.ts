import type { Room, RoomFilter } from "@/types";

/**
 * Pure, non-mutating filter for F1 (capacity >= attendees) and
 * F2 (room contains ALL required equipment items).
 */
export function filterRooms(rooms: Room[], filters: RoomFilter): Room[] {
  const { attendees, requiredEquipment } = filters;

  const needsCapacity = attendees > 0;
  const needsEquipment = requiredEquipment.length > 0;

  if (!needsCapacity && !needsEquipment) {
    return rooms.slice();
  }

  return rooms.filter((room) => {
    if (needsCapacity && room.capacity < attendees) {
      return false;
    }

    if (needsEquipment) {
      const hasAll = requiredEquipment.every((item) =>
        room.equipment.includes(item),
      );
      if (!hasAll) {
        return false;
      }
    }

    return true;
  });
}
