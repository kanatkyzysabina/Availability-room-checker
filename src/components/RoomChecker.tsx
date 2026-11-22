import { useMemo, useState, useRef } from "react";
import {
  CheckCircle2,
  XCircle,
  Clock,
  DoorClosed,
  Users,
  MapPin,
  Lock,
  CalendarClock,
  SearchX,
  Lightbulb,
  Loader2,
} from "lucide-react";
import type { Decision, Room } from "@/types";
import { ROOMS, BOOKINGS } from "@/data";
import { checkAvailability, minutesToLabel, overlaps } from "@/lib/availability";
import { filterRooms } from "@/lib/filterRooms";
import { timeInputToMinutes } from "@/lib/time";
import { explainAvailability, mapReasonCode, mockExplain } from "@/lib/explain";

const ALL_EQUIPMENT = Array.from(
  new Set(ROOMS.flatMap((r) => r.equipment)),
).sort();

export default function RoomChecker() {
  // Keep the displayed wall clock separate from the five-minute-rounded
  // value used by AC1. A rounded value of 1440 must not become "24:00" in
  // an HTML time input or be presented as the actual wall-clock time.
  const initialClock = useMemo(() => {
    const now = new Date();
    const actualMinutes = now.getHours() * 60 + now.getMinutes();
    return {
      actualMinutes,
      roundedMinutes: Math.ceil(actualMinutes / 5) * 5,
    };
  }, []);

  // Choose defaults only when at least five future minutes fit today.
  // HTML time inputs cannot display 24:00. Manual minute-level inputs remain
  // available when there is no suitable automatic five-minute-based slot.
  const initialDefaults = useMemo(() => {
    const current = initialClock.roundedMinutes;
    if (current + 60 <= 1439) {
      return { start: minutesToLabel(current + 30), end: minutesToLabel(current + 60) };
    }
    const preferredStart = current + 30;
    const start = preferredStart + 5 <= 1439 ? preferredStart : current + 5;
    if (start + 5 <= 1439) {
      return { start: minutesToLabel(start), end: "23:59" };
    }
    return null;
  }, [initialClock.roundedMinutes]);

  const [attendees, setAttendees] = useState<number>(0);
  const [requiredEquipment, setRequiredEquipment] = useState<string[]>([]);
  const [roomId, setRoomId] = useState<string>(ROOMS[0].id);
  const [startTime, setStartTime] = useState<string>(initialDefaults?.start ?? "");
  const [endTime, setEndTime] = useState<string>(initialDefaults?.end ?? "");
  const [currentTime, setCurrentTime] = useState<number>(initialClock.actualMinutes);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [explainLoading, setExplainLoading] = useState(false);
  const explainRequestId = useRef(0);

  const startMin = timeInputToMinutes(startTime);
  const endMin = timeInputToMinutes(endTime);

  const filteredRooms = useMemo(
    () => filterRooms(ROOMS, { attendees, requiredEquipment }),
    [attendees, requiredEquipment],
  );

  const hasMatches = filteredRooms.length > 0;

  const effectiveRoomId = hasMatches
    ? (filteredRooms.some((r) => r.id === roomId) ? roomId : filteredRooms[0].id)
    : "";

  const selectedRoom: Room | undefined = ROOMS.find((r) => r.id === effectiveRoomId);

  const roomBookings = selectedRoom
    ? BOOKINGS.filter((b) => b.roomId === selectedRoom.id)
    : [];

  function clearExplanation() {
    setExplanation(null);
    setExplainLoading(false);
    explainRequestId.current += 1;
  }

  function handleEquipmentToggle(item: string) {
    setRequiredEquipment((prev) =>
      prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item],
    );
    setDecision(null);
    clearExplanation();
  }

  function handleCheck() {
    if (!selectedRoom) return;
    // AC1 must be evaluated against the real wall-clock time at click, not the
    // value captured at mount, otherwise a start time that has since become
    // past is wrongly accepted.
    const now = new Date();
    const actualNow = now.getHours() * 60 + now.getMinutes();
    const nowMins = Math.ceil(actualNow / 5) * 5;
    setCurrentTime(actualNow);
    const result = checkAvailability(
      { start: startMin, end: endMin, roomId: selectedRoom.id, currentTime: nowMins },
      ROOMS,
      BOOKINGS,
    );
    setDecision(result);
    clearExplanation();
  }

  async function handleExplain() {
    if (!decision || !selectedRoom) return;
    const reasonCode = mapReasonCode(decision);
    const input = {
      roomLabel: selectedRoom.name,
      startTime: minutesToLabel(startMin),
      endTime: minutesToLabel(endMin),
      isAvailable: decision.status === "available",
      reasonCode,
    };
    const reqId = ++explainRequestId.current;
    setExplainLoading(true);
    setExplanation(null);
    const result = await explainAvailability(input, mockExplain, { timeoutMs: 3000 });
    if (reqId !== explainRequestId.current) return;
    setExplainLoading(false);
    setExplanation(result.explanation);
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-teal-600 flex items-center justify-center">
            <CalendarClock className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-slate-900">
              Smart Campus Room Availability
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Check whether a campus room is free for your time slot.
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 grid gap-6 lg:grid-cols-[1fr_1.15fr]">
        {/* Form */}
        <section className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
            Find a Room
          </h2>

          {/* Attendees */}
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Attendees
          </label>
          <input
            type="number"
            min={0}
            value={attendees === 0 ? "" : attendees}
            placeholder="0"
            onChange={(e) => {
              const n = e.target.value === "" ? 0 : Math.max(0, Number(e.target.value));
              setAttendees(Number.isNaN(n) ? 0 : n);
              setDecision(null);
              clearExplanation();
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent mb-4"
          />

          {/* Required equipment */}
          <div className="mb-4">
            <span className="block text-sm font-medium text-slate-700 mb-2">
              Required equipment
            </span>
            <div className="flex flex-wrap gap-2">
              {ALL_EQUIPMENT.map((item) => {
                const active = requiredEquipment.includes(item);
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => handleEquipmentToggle(item)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      active
                        ? "bg-teal-600 border-teal-600 text-white"
                        : "bg-white border-slate-300 text-slate-600 hover:border-teal-400 hover:text-teal-600"
                    }`}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Room select */}
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Room
          </label>
          {hasMatches ? (
            <select
              value={effectiveRoomId}
              onChange={(e) => {
                setRoomId(e.target.value);
                setDecision(null);
                clearExplanation();
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent mb-4"
            >
              {filteredRooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} — {r.building}
                  {r.blocked ? " (Blocked)" : ""}
                </option>
              ))}
            </select>
          ) : (
            <div className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400 mb-4">
              No rooms to select.
            </div>
          )}

          {/* Time row */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Start
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => {
                  setStartTime(e.target.value);
                  setDecision(null);
                  clearExplanation();
              }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                End
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => {
                  setEndTime(e.target.value);
                  setDecision(null);
                  clearExplanation();
              }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Current time */}
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-5 bg-slate-50 rounded-lg px-3 py-2">
            <Clock className="w-4 h-4 text-slate-400" />
            <span>
              Current time:{" "}
              <span className="font-medium text-slate-700">
                {minutesToLabel(currentTime)}
              </span>
            </span>
          </div>

          {/* Explain missing late-night defaults without preventing manual entry. */}
          {!initialDefaults && (!startTime || !endTime) && (
            <p role="status" className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
              {Math.ceil(currentTime / 5) * 5 >= 1439
                ? "No valid same-day time slot remains under the current booking rules. Please try again on another day."
                : "No suitable automatic time slot remains today. You can enter a later same-day time manually if one is available."}
            </p>
          )}

          <button
            onClick={handleCheck}
            disabled={!hasMatches}
            className="w-full bg-teal-600 hover:bg-teal-700 active:bg-teal-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium text-sm rounded-lg py-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
          >
            Check Availability
          </button>

          {/* Explain availability */}
          {decision && (
            <button
              onClick={handleExplain}
              disabled={explainLoading || !selectedRoom}
              className="w-full mt-2 bg-white hover:bg-slate-50 active:bg-slate-100 disabled:bg-slate-100 disabled:cursor-not-allowed text-slate-700 border border-slate-300 font-medium text-sm rounded-lg py-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
            >
              {explainLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating explanation…
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Lightbulb className="w-4 h-4 text-amber-500" />
                  Explain availability
                </span>
              )}
            </button>
          )}

          {/* Decision */}
          {decision && (
            <div
              className={`mt-4 rounded-lg p-4 flex items-start gap-3 transition-all ${
                decision.status === "available"
                  ? "bg-emerald-50 border border-emerald-200"
                  : "bg-rose-50 border border-rose-200"
              }`}
            >
              {decision.status === "available" ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              )}
              <div>
                <p
                  className={`font-semibold text-sm ${
                    decision.status === "available"
                      ? "text-emerald-800"
                      : "text-rose-800"
                  }`}
                >
                  {decision.status === "available" ? "Available" : "Unavailable"}
                </p>
                {decision.status === "unavailable" && (
                  <p className="text-sm text-rose-700 mt-0.5">{decision.reason}</p>
                )}
                {decision.status === "available" && selectedRoom && (
                  <p className="text-sm text-emerald-700 mt-0.5">
                    {selectedRoom.name} is free from {minutesToLabel(startMin)} to{" "}
                    {minutesToLabel(endMin)}.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Mock AI explanation — visually distinct from confirmed decision */}
          {explainLoading && (
            <div className="mt-3 rounded-lg p-4 bg-slate-100 border border-slate-200">
              <div className="flex items-start gap-3">
                <Loader2 className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5 animate-spin" />
                <div>
                  <p className="font-semibold text-sm text-slate-600">Explanation</p>
                  <p className="text-sm text-slate-500 mt-0.5">Generating explanation…</p>
                </div>
              </div>
            </div>
          )}
          {explanation && !explainLoading && (
            <div className="mt-3 rounded-lg p-4 bg-slate-100 border border-slate-200">
              <div className="flex items-start gap-3">
                <Lightbulb className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm text-slate-700">Explanation</p>
                  <p className="text-xs text-slate-400 mt-0.5 mb-1">
                    Mock AI explanation — for demonstration only.
                  </p>
                  <p className="text-sm text-slate-600">{explanation}</p>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Room detail + bookings */}
        <section className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
            Room Details
          </h2>

          {!hasMatches ? (
            <div className="flex flex-col items-center justify-center text-center py-10">
              <SearchX className="w-8 h-8 text-slate-300 mb-3" />
              <p className="text-sm font-medium text-slate-600">
                No rooms match your requirements.
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Try lowering the attendee count or removing equipment filters.
              </p>
            </div>
          ) : selectedRoom ? (
            <>
              <div className="flex items-start justify-between gap-3 mb-5">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {selectedRoom.name}
                  </h3>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500 mt-1">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" /> {selectedRoom.building}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" /> {selectedRoom.capacity} seats
                    </span>
                  </div>
                  {selectedRoom.equipment.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {selectedRoom.equipment.map((item) => (
                        <span
                          key={item}
                          className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full border ${
                            requiredEquipment.includes(item)
                              ? "bg-teal-50 border-teal-200 text-teal-700"
                              : "bg-slate-50 border-slate-200 text-slate-600"
                          }`}
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {selectedRoom.blocked ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium bg-rose-100 text-rose-700 px-2.5 py-1 rounded-full">
                    <Lock className="w-3 h-3" /> Blocked
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-medium bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full">
                    <DoorClosed className="w-3 h-3" /> Active
                  </span>
                )}
              </div>

              <h3 className="text-sm font-medium text-slate-700 mb-2">
                Existing Bookings
              </h3>
              {roomBookings.length === 0 ? (
                <p className="text-sm text-slate-400">No bookings for this room.</p>
              ) : (
                <ul className="space-y-2">
                  {roomBookings.map((b) => {
                    const isOverlapping = overlaps(
                      { start: startMin, end: endMin },
                      b,
                    );
                    return (
                      <li
                        key={b.id}
                        className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm border transition-colors ${
                          isOverlapping
                            ? "border-rose-300 bg-rose-50"
                            : "border-slate-200 bg-slate-50"
                        }`}
                      >
                        <span className="font-medium text-slate-700">{b.title}</span>
                        <span className="text-slate-500 tabular-nums">
                          {minutesToLabel(b.start)} – {minutesToLabel(b.end)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}

              <p className="text-xs text-slate-400 mt-5 leading-relaxed">
                Bookings can be at most 120 minutes. Touching endpoints (e.g. one
                booking ends at 10:00, another starts at 10:00) are allowed.
              </p>
            </>
          ) : null}
        </section>
      </main>
    </div>
  );
}
