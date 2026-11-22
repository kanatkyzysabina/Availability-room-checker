// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import RoomChecker from "@/components/RoomChecker";

afterEach(() => {
  cleanup();
});

describe("RoomChecker UI", () => {
  it("F4: shows 'No rooms match your requirements.' when attendees exceed all capacities", async () => {
    const user = userEvent.setup();
    render(<RoomChecker />);

    // The largest room in the catalog holds 60 seats, so 100 attendees matches none.
    const attendeesInput = screen.getByPlaceholderText("0");
    await user.type(attendeesInput, "100");

    expect(
      await screen.findByText("No rooms match your requirements."),
    ).toBeInTheDocument();
  });
});

describe("RoomChecker UI — stale current time (R1 regression)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects a start time that was valid when the page opened but is now past", () => {
    // Page opens at 09:00. Default start is initialCurrent + 30 = 09:30.
    vi.setSystemTime(new Date(2026, 0, 1, 9, 0));
    render(<RoomChecker />);

    // Advance the wall clock past the default 09:30 start.
    vi.setSystemTime(new Date(2026, 0, 1, 9, 45));

    fireEvent.click(screen.getByRole("button", { name: "Check Availability" }));

    expect(
      screen.getByText(/Start time must be after the current time/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Current time:/)).toHaveTextContent(
      "Current time: 09:45",
    );
  });
});

describe("RoomChecker UI — explain availability", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("U3: 'Explain availability' button appears only after checking availability", () => {
    // Default start (09:30) is after 09:00, so the check will succeed.
    vi.setSystemTime(new Date(2026, 0, 1, 9, 0));
    render(<RoomChecker />);

    // Before checking, the explain button must not be present.
    expect(
      screen.queryByRole("button", { name: /Explain availability/ }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Check Availability" }));

    // After checking, the explain button appears.
    expect(
      screen.getByRole("button", { name: /Explain availability/ }),
    ).toBeInTheDocument();
  });

  it("U4: clicking explain shows a mock AI explanation", async () => {
    vi.setSystemTime(new Date(2026, 0, 1, 9, 0));
    render(<RoomChecker />);

    fireEvent.click(screen.getByRole("button", { name: "Check Availability" }));
    fireEvent.click(screen.getByRole("button", { name: /Explain availability/ }));

    // The mock adapter resolves after a short delay — flush timers.
    await vi.advanceTimersByTimeAsync(100);

    expect(
      screen.getByText("Mock AI explanation — for demonstration only."),
    ).toBeInTheDocument();
    // The explanation paragraph is inside the mock-AI box; check for its
    // unique wording rather than the room name, which appears in multiple places.
    expect(
      screen.getByText(/already has a booking that overlaps/),
    ).toBeInTheDocument();
  });

  it("U5-stale: an outdated explanation does not appear after a new check", async () => {
    vi.setSystemTime(new Date(2026, 0, 1, 9, 0));
    render(<RoomChecker />);

    // First check — default room is Lincoln 101.
    fireEvent.click(screen.getByRole("button", { name: "Check Availability" }));
    fireEvent.click(screen.getByRole("button", { name: /Explain availability/ }));

    // While the explanation is still loading, perform a new check.
    fireEvent.click(screen.getByRole("button", { name: "Check Availability" }));

    // Flush any pending timers from the first explain request.
    await vi.advanceTimersByTimeAsync(100);

    // The stale explanation from the first request must not appear.
    expect(
      screen.queryByText("Mock AI explanation — for demonstration only."),
    ).not.toBeInTheDocument();
  });

  it("U6-f2: explain button is re-enabled after cancelling a stale request", async () => {
    vi.setSystemTime(new Date(2026, 0, 1, 9, 0));
    render(<RoomChecker />);

    // Start an availability check and an explanation request.
    fireEvent.click(screen.getByRole("button", { name: "Check Availability" }));
    fireEvent.click(screen.getByRole("button", { name: /Explain availability/ }));

    // The button should now show its loading state.
    expect(
      screen.getByRole("button", { name: /Generating explanation/ }),
    ).toBeDisabled();

    // While the explanation is loading, change the start time to invalidate it.
    const startInput = screen.getByDisplayValue("09:30");
    fireEvent.change(startInput, { target: { value: "10:30" } });

    // Perform a new availability check for the changed time.
    fireEvent.click(screen.getByRole("button", { name: "Check Availability" }));

    // Flush any pending timers from the old explain request.
    await vi.advanceTimersByTimeAsync(100);

    // The explain button must be enabled again (not stuck loading).
    const explainButton = screen.getByRole("button", { name: /Explain availability/ });
    expect(explainButton).not.toBeDisabled();

    // The outdated explanation from the first request must not appear.
    expect(
      screen.queryByText("Mock AI explanation — for demonstration only."),
    ).not.toBeInTheDocument();
  });
});


describe("RoomChecker UI — late-night default times (R2)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function timeInputs(): [HTMLInputElement, HTMLInputElement] {
    const inputs = document.querySelectorAll<HTMLInputElement>('input[type="time"]');
    expect(inputs).toHaveLength(2);
    return [inputs[0], inputs[1]];
  }

  it("R2-23:00: provides a valid same-day default instead of 24:00", () => {
    vi.setSystemTime(new Date(2026, 0, 1, 23, 0));
    render(<RoomChecker />);
    const [start, end] = timeInputs();
    expect(start.value).toBe("23:30");
    expect(end.value).toBe("23:59");
    fireEvent.click(screen.getByRole("button", { name: "Check Availability" }));
    expect(screen.getByText(/Lincoln 101 is free from 23:30 to 23:59/)).toBeInTheDocument();
  });

  it("R2-23:30: chooses a shorter future same-day default", () => {
    vi.setSystemTime(new Date(2026, 0, 1, 23, 30));
    render(<RoomChecker />);
    const [start, end] = timeInputs();
    expect(start.value).toBe("23:35");
    expect(end.value).toBe("23:59");
    fireEvent.click(screen.getByRole("button", { name: "Check Availability" }));
    expect(screen.getByText(/Lincoln 101 is free from 23:35 to 23:59/)).toBeInTheDocument();
  });

  it("R2-23:55: shows no automatic default, but permits a valid manual minute-level slot", () => {
    vi.setSystemTime(new Date(2026, 0, 1, 23, 55));
    render(<RoomChecker />);
    const [start, end] = timeInputs();
    expect(start.value).toBe("");
    expect(end.value).toBe("");
    expect(screen.getByRole("status")).toHaveTextContent(/No suitable automatic time slot/);
    fireEvent.change(start, { target: { value: "23:56" } });
    fireEvent.change(end, { target: { value: "23:59" } });
    fireEvent.click(screen.getByRole("button", { name: "Check Availability" }));
    expect(screen.getByText(/Lincoln 101 is free from 23:56 to 23:59/)).toBeInTheDocument();
  });

  it("R2-23:58: does not invent valid defaults when the rounded clock reaches 24:00", () => {
    vi.setSystemTime(new Date(2026, 0, 1, 23, 58));
    render(<RoomChecker />);
    const [start, end] = timeInputs();
    expect(start.value).toBe("");
    expect(end.value).toBe("");
    expect(screen.getByText(/Current time:/)).toHaveTextContent("Current time: 23:58");
    expect(screen.getByRole("status")).toHaveTextContent(/No valid same-day time slot remains/);
    fireEvent.change(start, { target: { value: "23:58" } });
    fireEvent.change(end, { target: { value: "23:59" } });
    fireEvent.click(screen.getByRole("button", { name: "Check Availability" }));
    expect(screen.getByText(/Start time must be after the current time/)).toBeInTheDocument();
  });

  it("R2-open-23:30-check-23:58: rejects the now-past default using the live click clock", () => {
    vi.setSystemTime(new Date(2026, 0, 1, 23, 30));
    render(<RoomChecker />);
    const [start, end] = timeInputs();
    expect(start.value).toBe("23:35");
    expect(end.value).toBe("23:59");
    vi.setSystemTime(new Date(2026, 0, 1, 23, 58));
    fireEvent.click(screen.getByRole("button", { name: "Check Availability" }));
    expect(screen.getByText(/Start time must be after the current time/)).toBeInTheDocument();
    expect(screen.getByText(/Current time:/)).toHaveTextContent("Current time: 23:58");
  });
});
