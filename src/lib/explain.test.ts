import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { checkAvailability } from "@/lib/availability";
import { ROOMS } from "@/data";
import type { IntervalInput } from "@/types";
import {
  mapReasonCode,
  validateExplainInput,
  validateExplainResult,
  safeFallbackExplanation,
  mockExplain,
  explainAvailability,
  type ExplainInput,
} from "@/lib/explain";

const validInput: ExplainInput = {
  roomLabel: "Lincoln 101",
  startTime: "09:30",
  endTime: "10:30",
  isAvailable: true,
  reasonCode: "available",
};

describe("mapReasonCode", () => {
  it("E11: maps available decision", () => {
    expect(mapReasonCode({ status: "available" })).toBe("available");
  });

  it("E12: maps overlap decision", () => {
    expect(
      mapReasonCode({
        status: "unavailable",
        reason: 'Overlaps existing booking "Meeting" (10:00–11:00).',
      }),
    ).toBe("overlap");
  });

  it("E12b: maps blocked decision", () => {
    expect(
      mapReasonCode({ status: "unavailable", reason: "Lincoln 101 is currently blocked." }),
    ).toBe("blocked");
  });

  it("E12c: maps unknown reason to 'unknown'", () => {
    expect(
      mapReasonCode({ status: "unavailable", reason: "Something unexpected happened." }),
    ).toBe("unknown");
  });
});


// Integration checks use real Decision objects from the booking validator.
// If availability.ts changes an English reason, these catch mapping drift.
describe("mapReasonCode — real checkAvailability decisions (R1)", () => {
  const base: IntervalInput = { start: 600, end: 660, roomId: "r1", currentTime: 540 };
  const scenarios: Array<{ title: string; input: IntervalInput; code: string }> = [
    { title: "missing_times", input: { ...base, start: NaN }, code: "missing_times" },
    { title: "out_of_range", input: { ...base, end: 1441 }, code: "out_of_range" },
    { title: "invalid_interval", input: { ...base, start: 660, end: 600 }, code: "invalid_interval" },
    { title: "past_time", input: { ...base, start: 540 }, code: "past_time" },
    { title: "too_long", input: { ...base, end: 721 }, code: "too_long" },
    { title: "no_room", input: { ...base, roomId: "missing-room" }, code: "no_room" },
  ];

  it.each(scenarios)("R1: maps actual $title decision", ({ input, code }) => {
    const decision = checkAvailability(input, ROOMS, []);
    expect(decision.status).toBe("unavailable");
    expect(mapReasonCode(decision)).toBe(code);
  });
});

describe("validateExplainInput", () => {
  it("E6: rejects empty roomLabel", () => {
    expect(validateExplainInput({ ...validInput, roomLabel: "" })).toBeNull();
  });

  it("E7: rejects overly long roomLabel", () => {
    expect(
      validateExplainInput({ ...validInput, roomLabel: "x".repeat(201) }),
    ).toBeNull();
  });

  it("E6b: rejects missing fields", () => {
    expect(validateExplainInput({ roomLabel: "Test" })).toBeNull();
  });

  it("E6c: rejects wrong type for isAvailable", () => {
    expect(
      validateExplainInput({ ...validInput, isAvailable: "yes" as unknown as boolean }),
    ).toBeNull();
  });

  it("E6d: rejects unsupported reasonCode", () => {
    expect(
      validateExplainInput({ ...validInput, reasonCode: "fake_reason" }),
    ).toBeNull();
  });

  it("E-consistency-1: rejects isAvailable=true with non-available code", () => {
    expect(
      validateExplainInput({ ...validInput, isAvailable: true, reasonCode: "overlap" }),
    ).toBeNull();
  });

  it("E-consistency-2: rejects isAvailable=false with 'available' code", () => {
    expect(
      validateExplainInput({ ...validInput, isAvailable: false, reasonCode: "available" }),
    ).toBeNull();
  });

  it("E-valid: accepts valid input", () => {
    expect(validateExplainInput(validInput)).not.toBeNull();
  });
});

describe("validateExplainResult", () => {
  it("accepts valid 2-sentence result", () => {
    expect(
      validateExplainResult({ explanation: "Sentence one. Sentence two." }),
    ).not.toBeNull();
  });

  it("rejects empty explanation", () => {
    expect(validateExplainResult({ explanation: "" })).toBeNull();
  });

  it("E-output-long: rejects result with more than 2 sentences", () => {
    expect(
      validateExplainResult({ explanation: "One. Two. Three." }),
    ).toBeNull();
  });

  it("rejects non-object result", () => {
    expect(validateExplainResult(null)).toBeNull();
    expect(validateExplainResult("text")).toBeNull();
  });
});

describe("safeFallbackExplanation", () => {
  it("returns a non-empty 2-sentence fallback", () => {
    const fb = safeFallbackExplanation();
    expect(fb.trim().length).toBeGreaterThan(0);
    expect(fb.includes("unavailable")).toBe(true);
  });
});

describe("mockExplain", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("E1: produces explanation for available room", async () => {
    const promise = mockExplain(validInput, { delayMs: 0 });
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result.explanation).toContain("Lincoln 101");
    expect(result.explanation).toContain("free");
    // F1 regression: the explanation must not claim a booking was created
    // or can be completed, since this app does not create bookings.
    expect(result.explanation).not.toContain("proceed with your booking");
    expect(result.explanation).not.toMatch(/your booking/i);
    expect(result.explanation).toContain("No existing bookings overlap");
  });

  it("E2: produces explanation for overlap", async () => {
    const input: ExplainInput = {
      roomLabel: "Lincoln 101",
      startTime: "10:00",
      endTime: "11:00",
      isAvailable: false,
      reasonCode: "overlap",
    };
    const promise = mockExplain(input, { delayMs: 0 });
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result.explanation.toLowerCase()).toContain("overlap");
  });

  it("E3: produces explanation for blocked room", async () => {
    const input: ExplainInput = {
      roomLabel: "Tesla Lab B",
      startTime: "10:00",
      endTime: "11:00",
      isAvailable: false,
      reasonCode: "blocked",
    };
    const promise = mockExplain(input, { delayMs: 0 });
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result.explanation.toLowerCase()).toContain("blocked");
  });

  it("E4: produces explanation for invalid interval", async () => {
    const input: ExplainInput = {
      roomLabel: "Lincoln 101",
      startTime: "11:00",
      endTime: "10:00",
      isAvailable: false,
      reasonCode: "invalid_interval",
    };
    const promise = mockExplain(input, { delayMs: 0 });
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result.explanation.toLowerCase()).toContain("after the start");
  });

  it("E5: produces explanation for past time", async () => {
    const input: ExplainInput = {
      roomLabel: "Lincoln 101",
      startTime: "08:00",
      endTime: "09:00",
      isAvailable: false,
      reasonCode: "past_time",
    };
    const promise = mockExplain(input, { delayMs: 0 });
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result.explanation.toLowerCase()).toContain("past");
  });
});

describe("explainAvailability", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("E6-fallback: invalid input returns fallback without calling adapter", async () => {
    const adapter = vi.fn();
    const promise = explainAvailability({ roomLabel: "" }, adapter as never, { timeoutMs: 1000 });
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result.explanation).toBe(safeFallbackExplanation());
    expect(adapter).not.toHaveBeenCalled();
  });

  it("E7-fallback: overly long input returns fallback", async () => {
    const adapter = vi.fn();
    const promise = explainAvailability(
      { ...validInput, roomLabel: "x".repeat(201) },
      adapter as never,
      { timeoutMs: 1000 },
    );
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result.explanation).toBe(safeFallbackExplanation());
    expect(adapter).not.toHaveBeenCalled();
  });

  it("E8: timeout returns fallback", async () => {
    const slowAdapter = vi.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ explanation: "hi" }), 5000)),
    );
    const promise = explainAvailability(validInput, slowAdapter as never, {
      timeoutMs: 100,
      delayMs: 5000,
    });
    await vi.advanceTimersByTimeAsync(200);
    const result = await promise;
    expect(result.explanation).toBe(safeFallbackExplanation());
  });

  it("E9: simulated API failure returns fallback", async () => {
    const failAdapter = vi.fn().mockRejectedValue(new Error("API down"));
    const promise = explainAvailability(validInput, failAdapter as never, { timeoutMs: 1000 });
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result.explanation).toBe(safeFallbackExplanation());
  });

  it("E10: unavailable adapter (null) returns fallback", async () => {
    const promise = explainAvailability(validInput, null, { timeoutMs: 1000 });
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result.explanation).toBe(safeFallbackExplanation());
  });

  it("E-output-invalid: invalid adapter output returns fallback", async () => {
    const badAdapter = vi.fn().mockResolvedValue({ explanation: "One. Two. Three. Four." });
    const promise = explainAvailability(validInput, badAdapter as never, { timeoutMs: 1000 });
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result.explanation).toBe(safeFallbackExplanation());
  });

  it("E-success: returns valid adapter output when all checks pass", async () => {
    const goodAdapter = vi.fn().mockResolvedValue({ explanation: "Room is free. Proceed." });
    const promise = explainAvailability(validInput, goodAdapter as never, { timeoutMs: 1000 });
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result.explanation).toBe("Room is free. Proceed.");
    expect(goodAdapter).toHaveBeenCalledWith(validInput, expect.any(Object));
  });
});
