import type { Decision } from "@/types";

export interface ExplainInput {
  roomLabel: string;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  reasonCode: string;
}

export interface ExplainResult {
  explanation: string;
}

export interface ExplainOptions {
  delayMs?: number;
  timeoutMs?: number;
  simulateFailure?: boolean;
}

export type ExplainAdapter = (
  input: ExplainInput,
  options?: ExplainOptions,
) => Promise<ExplainResult>;

export const REASON_CODES = [
  "available",
  "past_time",
  "overlap",
  "blocked",
  "too_long",
  "invalid_interval",
  "out_of_range",
  "missing_times",
  "no_room",
  "unknown",
] as const;

export type ReasonCode = (typeof REASON_CODES)[number];

const MAX_ROOM_LABEL = 200;
const MAX_TIME_LABEL = 10;
const MAX_SENTENCES = 2;

export function mapReasonCode(decision: Decision): ReasonCode {
  if (decision.status === "available") return "available";
  const r = decision.reason;
  if (r.startsWith("Start and end times are required")) return "missing_times";
  if (r.startsWith("Time must be within")) return "out_of_range";
  if (r.startsWith("End time must be after start time")) return "invalid_interval";
  if (r.startsWith("Start time must be after the current time")) return "past_time";
  if (r.startsWith("Bookings cannot exceed")) return "too_long";
  if (r.startsWith("Please select a room")) return "no_room";
  if (r.includes("currently blocked")) return "blocked";
  if (r.startsWith("Overlaps existing booking")) return "overlap";
  return "unknown";
}

export function validateExplainInput(input: unknown): ExplainInput | null {
  if (input === null || typeof input !== "object") return null;
  const obj = input as Record<string, unknown>;
  const { roomLabel, startTime, endTime, isAvailable, reasonCode } = obj;
  if (typeof roomLabel !== "string" || roomLabel.trim() === "" || roomLabel.length > MAX_ROOM_LABEL) return null;
  if (typeof startTime !== "string" || startTime.trim() === "" || startTime.length > MAX_TIME_LABEL) return null;
  if (typeof endTime !== "string" || endTime.trim() === "" || endTime.length > MAX_TIME_LABEL) return null;
  if (typeof isAvailable !== "boolean") return null;
  if (typeof reasonCode !== "string" || reasonCode.trim() === "") return null;
  if (!REASON_CODES.includes(reasonCode as ReasonCode)) return null;
  const code = reasonCode as ReasonCode;
  if (isAvailable && code !== "available") return null;
  if (!isAvailable && code === "available") return null;
  return { roomLabel, startTime, endTime, isAvailable, reasonCode: code };
}

function countSentences(text: string): number {
  const trimmed = text.trim();
  if (trimmed === "") return 0;
  const matches = trimmed.match(/[^.!?]+[.!?]+/g);
  if (!matches) return trimmed.length > 0 ? 1 : 0;
  return matches.length;
}

export function validateExplainResult(result: unknown): ExplainResult | null {
  if (result === null || typeof result !== "object") return null;
  const obj = result as Record<string, unknown>;
  const { explanation } = obj;
  if (typeof explanation !== "string" || explanation.trim() === "") return null;
  if (countSentences(explanation) > MAX_SENTENCES) return null;
  return { explanation };
}

export function safeFallbackExplanation(): string {
  return "Availability has been confirmed but an explanation is unavailable. Refer to the decision above for details.";
}

const MOCK_EXPLANATIONS: Record<ReasonCode, (i: ExplainInput) => string> = {
  available: (i) =>
    `${i.roomLabel} is free from ${i.startTime} to ${i.endTime}. No existing bookings overlap this time slot.`,
  past_time: (i) =>
    `The start time ${i.startTime} is in the past, so ${i.roomLabel} cannot be booked. Please choose a start time after the current time.`,
  overlap: (i) =>
    `${i.roomLabel} already has a booking that overlaps ${i.startTime} to ${i.endTime}. Choose a different time slot or room.`,
  blocked: (i) =>
    `${i.roomLabel} is currently blocked and cannot be booked. Please select another room.`,
  too_long: (i) =>
    `The requested booking for ${i.roomLabel} exceeds the 120-minute limit. Shorten your time slot and try again.`,
  invalid_interval: () =>
    "The end time must be after the start time. Please correct your time selection.",
  out_of_range: () =>
    "The selected time is outside the allowed 00:00 to 24:00 range. Please pick a valid time.",
  missing_times: () =>
    "Start and end times are both required. Please fill in both time fields.",
  no_room: () =>
    "No room is currently selected. Please choose a room before checking availability.",
  unknown: () =>
    "Availability could not be confirmed for the current selection. Please review your inputs and try again.",
};

export async function mockExplain(
  input: ExplainInput,
  options: ExplainOptions = {},
): Promise<ExplainResult> {
  const delay = options.delayMs ?? 50;
  if (options.simulateFailure) {
    throw new Error("Mock LLM adapter simulated failure");
  }
  await new Promise<void>((resolve) => setTimeout(resolve, delay));
  const builder = MOCK_EXPLANATIONS[input.reasonCode as ReasonCode] ?? MOCK_EXPLANATIONS.unknown;
  return { explanation: builder(input) };
}

export async function explainAvailability(
  input: unknown,
  adapter: ExplainAdapter | null,
  options: ExplainOptions = {},
): Promise<ExplainResult> {
  const valid = validateExplainInput(input);
  if (!valid) return { explanation: safeFallbackExplanation() };
  if (!adapter) return { explanation: safeFallbackExplanation() };

  const timeoutMs = options.timeoutMs ?? 3000;
  try {
    const result = await withTimeout(adapter(valid, options), timeoutMs);
    const validated = validateExplainResult(result);
    if (!validated) return { explanation: safeFallbackExplanation() };
    return validated;
  } catch {
    return { explanation: safeFallbackExplanation() };
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  if (ms <= 0) return promise;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Explanation request timed out")), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}
