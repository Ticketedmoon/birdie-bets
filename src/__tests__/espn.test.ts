import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { calculateEffectiveScore, formatScoreToPar, fetchLeaderboard, fetchTournamentSnapshot, fetchTournamentStatus, fetchFirstTeeTime, fetchCurrentTournaments, fetchPlayersFromLeaderboard, fetchTournamentSchedule, fetchDynamicGroups, fetchCurrentRound } from "@/lib/espn";
import type { PlayerScore } from "@/types";

function makePlayerScore(overrides: Partial<PlayerScore> = {}): PlayerScore {
  return {
    playerId: "1",
    playerName: "Test Player",
    scoreToPar: 0,
    displayScore: "E",
    status: "playing",
    ...overrides,
  };
}

function makeESPNCompetitor(overrides: Record<string, unknown> = {}) {
  return {
    athlete: {
      id: "123",
      displayName: "Test Player",
      shortName: "T. Player",
      lastName: "Player",
      amateur: false,
      headshot: { href: "https://example.com/headshot.png" },
      flag: { href: "https://example.com/flag.png", alt: "USA" },
    },
    status: {
      type: { name: "STATUS_FINISH", state: "post" },
      position: { displayName: "T1" },
    },
    score: { displayValue: "-5" },
    statistics: [{ name: "scoreToPar", value: -5 }],
    linescores: [{ displayValue: "68", period: 1, teeTime: "2025-06-01T07:00:00Z" }],
    ...overrides,
  };
}

function makeESPNEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "evt1",
    name: "Test Tournament",
    date: "2025-06-01",
    endDate: "2025-06-04",
    status: { type: { state: "in", completed: false } },
    tournament: { displayName: "The Test Open", major: true },
    courses: [{ name: "Test Course" }],
    competitions: [{ competitors: [makeESPNCompetitor()] }],
    displayPurse: "$10,000,000",
    ...overrides,
  };
}

function mockFetchResponse(data: unknown, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(data),
  });
}

describe("calculateEffectiveScore", () => {
  it("returns unpenalised score for playing status", () => {
    const result = calculateEffectiveScore(makePlayerScore({ scoreToPar: -3, status: "playing" }));
    expect(result.effectiveScore).toBe(-3);
    expect(result.penalty).toBe(0);
  });

  it("returns unpenalised score for finished status", () => {
    const result = calculateEffectiveScore(makePlayerScore({ scoreToPar: 2, status: "finished" }));
    expect(result.effectiveScore).toBe(2);
    expect(result.penalty).toBe(0);
  });

  it("caps cut player at cutLine + 1 when cutLine is provided", () => {
    const result = calculateEffectiveScore(makePlayerScore({ scoreToPar: 7, status: "cut" }), 4);
    expect(result.effectiveScore).toBe(5);
    expect(result.penalty).toBe(-2);
  });

  it("caps cut player at cutLine + 1 even when their score equals the cutLine", () => {
    const result = calculateEffectiveScore(makePlayerScore({ scoreToPar: 4, status: "cut" }), 4);
    expect(result.effectiveScore).toBe(5);
    expect(result.penalty).toBe(1);
  });

  it("caps cut player at cutLine + 1 when cutLine is zero (even par)", () => {
    const result = calculateEffectiveScore(makePlayerScore({ scoreToPar: 3, status: "cut" }), 0);
    expect(result.effectiveScore).toBe(1);
    expect(result.penalty).toBe(-2);
  });

  it("caps cut player at cutLine + 1 when cutLine is negative (under par)", () => {
    const result = calculateEffectiveScore(makePlayerScore({ scoreToPar: 0, status: "cut" }), -1);
    expect(result.effectiveScore).toBe(0);
    expect(result.penalty).toBe(0);
  });

  it("falls back to +1 penalty for cut player when cutLine is null", () => {
    const result = calculateEffectiveScore(makePlayerScore({ scoreToPar: 5, status: "cut" }), null);
    expect(result.effectiveScore).toBe(6);
    expect(result.penalty).toBe(1);
  });

  it("falls back to +1 penalty for cut player when cutLine is undefined", () => {
    const result = calculateEffectiveScore(makePlayerScore({ scoreToPar: 5, status: "cut" }));
    expect(result.effectiveScore).toBe(6);
    expect(result.penalty).toBe(1);
  });

  it("adds +1 penalty for wd status (unaffected by cutLine)", () => {
    const result = calculateEffectiveScore(makePlayerScore({ scoreToPar: 1, status: "wd" }), 4);
    expect(result.effectiveScore).toBe(2);
    expect(result.penalty).toBe(1);
  });

  it("adds +1 penalty for dq status (unaffected by cutLine)", () => {
    const result = calculateEffectiveScore(makePlayerScore({ scoreToPar: 0, status: "dq" }), 4);
    expect(result.effectiveScore).toBe(1);
    expect(result.penalty).toBe(1);
  });

  it("does not penalise playing status even with cutLine", () => {
    const result = calculateEffectiveScore(makePlayerScore({ scoreToPar: 6, status: "playing" }), 4);
    expect(result.effectiveScore).toBe(6);
    expect(result.penalty).toBe(0);
  });
});

describe("formatScoreToPar", () => {
  it("returns 'E' for even par (0)", () => {
    expect(formatScoreToPar(0)).toBe("E");
  });

  it("returns '+N' for over par", () => {
    expect(formatScoreToPar(1)).toBe("+1");
    expect(formatScoreToPar(5)).toBe("+5");
    expect(formatScoreToPar(12)).toBe("+12");
  });

  it("returns '-N' for under par", () => {
    expect(formatScoreToPar(-1)).toBe("-1");
    expect(formatScoreToPar(-5)).toBe("-5");
    expect(formatScoreToPar(-18)).toBe("-18");
  });
});

describe("fetchLeaderboard", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns mapped player scores from ESPN data", async () => {
    global.fetch = mockFetchResponse({
      events: [makeESPNEvent()],
    });

    const result = await fetchLeaderboard("evt1");

    expect(result.scores).toHaveLength(1);
    expect(result.scores[0].playerId).toBe("123");
    expect(result.scores[0].playerName).toBe("Test Player");
    expect(result.scores[0].scoreToPar).toBe(-5);
    expect(result.scores[0].status).toBe("finished");
    expect(result.scores[0].position).toBe("T1");
  });

  it("maps STATUS_CUT to cut status", async () => {
    const comp = makeESPNCompetitor({
      status: { type: { name: "STATUS_CUT", state: "post" }, position: { displayName: "CUT" } },
    });
    global.fetch = mockFetchResponse({
      events: [makeESPNEvent({ competitions: [{ competitors: [comp] }] })],
    });

    const result = await fetchLeaderboard("evt1");
    expect(result.scores[0].status).toBe("cut");
  });

  it("maps STATUS_WD to wd status", async () => {
    const comp = makeESPNCompetitor({
      status: { type: { name: "STATUS_WD", state: "post" }, position: { displayName: "WD" } },
    });
    global.fetch = mockFetchResponse({
      events: [makeESPNEvent({ competitions: [{ competitors: [comp] }] })],
    });

    const result = await fetchLeaderboard("evt1");
    expect(result.scores[0].status).toBe("wd");
  });

  it("maps STATUS_DQ to dq status", async () => {
    const comp = makeESPNCompetitor({
      status: { type: { name: "STATUS_DQ", state: "post" }, position: { displayName: "DQ" } },
    });
    global.fetch = mockFetchResponse({
      events: [makeESPNEvent({ competitions: [{ competitors: [comp] }] })],
    });

    const result = await fetchLeaderboard("evt1");
    expect(result.scores[0].status).toBe("dq");
  });

  it("defaults to playing status for unknown status names", async () => {
    const comp = makeESPNCompetitor({
      status: { type: { name: "STATUS_ACTIVE", state: "in" }, position: { displayName: "5" } },
    });
    global.fetch = mockFetchResponse({
      events: [makeESPNEvent({ competitions: [{ competitors: [comp] }] })],
    });

    const result = await fetchLeaderboard("evt1");
    expect(result.scores[0].status).toBe("playing");
  });

  it("defaults scoreToPar to 0 when stat is missing", async () => {
    const comp = makeESPNCompetitor({ statistics: [] });
    global.fetch = mockFetchResponse({
      events: [makeESPNEvent({ competitions: [{ competitors: [comp] }] })],
    });

    const result = await fetchLeaderboard("evt1");
    expect(result.scores[0].scoreToPar).toBe(0);
  });

  it("returns empty scores when no events", async () => {
    global.fetch = mockFetchResponse({ events: [] });
    const result = await fetchLeaderboard("evt1");
    expect(result).toEqual({ scores: [], cutLine: null, cutRound: null });
  });

  it("returns empty scores when no competitions", async () => {
    global.fetch = mockFetchResponse({
      events: [makeESPNEvent({ competitions: [] })],
    });
    const result = await fetchLeaderboard("evt1");
    expect(result).toEqual({ scores: [], cutLine: null, cutRound: null });
  });

  it("returns cutLine from tournament.cutScore", async () => {
    global.fetch = mockFetchResponse({
      events: [makeESPNEvent({ tournament: { displayName: "PGA Championship", major: true, cutScore: 4, cutRound: 2 } })],
    });
    const result = await fetchLeaderboard("evt1");
    expect(result.cutLine).toBe(4);
    expect(result.cutRound).toBe(2);
  });

  it("returns null cutLine when tournament has no cutScore", async () => {
    global.fetch = mockFetchResponse({
      events: [makeESPNEvent()],
    });
    const result = await fetchLeaderboard("evt1");
    expect(result.cutLine).toBeNull();
    expect(result.cutRound).toBeNull();
  });

  it("returns cutRound 0 for no-cut tournaments", async () => {
    global.fetch = mockFetchResponse({
      events: [makeESPNEvent({ tournament: { displayName: "The Sentry", major: false, cutRound: 0 } })],
    });
    const result = await fetchLeaderboard("evt1");
    expect(result.cutRound).toBe(0);
    expect(result.cutLine).toBeNull();
  });

  it("throws on API error", async () => {
    global.fetch = mockFetchResponse({}, false);
    await expect(fetchLeaderboard("evt1")).rejects.toThrow("ESPN API error");
  });
});

describe("fetchTournamentSnapshot", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns status and first tee time", async () => {
    global.fetch = mockFetchResponse({
      events: [makeESPNEvent()],
    });

    const result = await fetchTournamentSnapshot("evt1");
    expect(result.status).toBe("in");
    expect(result.firstTeeTime).toBe("2025-06-01T07:00:00Z");
  });

  it("returns pre status and null tee time on API error", async () => {
    global.fetch = mockFetchResponse({}, false);

    const result = await fetchTournamentSnapshot("evt1");
    expect(result.status).toBe("pre");
    expect(result.firstTeeTime).toBeNull();
  });

  it("returns pre status when no events", async () => {
    global.fetch = mockFetchResponse({ events: [] });

    const result = await fetchTournamentSnapshot("evt1");
    expect(result.status).toBe("pre");
    expect(result.firstTeeTime).toBeNull();
  });

  it("returns null tee time when no valid tee times exist", async () => {
    const comp = makeESPNCompetitor({
      linescores: [{ displayValue: "68", period: 1 }], // no teeTime
      status: { type: { name: "STATUS_FINISH", state: "post" } },
    });
    global.fetch = mockFetchResponse({
      events: [makeESPNEvent({ competitions: [{ competitors: [comp] }] })],
    });

    const result = await fetchTournamentSnapshot("evt1");
    expect(result.firstTeeTime).toBeNull();
  });

  it("picks the earliest tee time from competitors", async () => {
    const comp1 = makeESPNCompetitor({
      linescores: [{ displayValue: "70", period: 1, teeTime: "2025-06-01T09:00:00Z" }],
    });
    const comp2 = makeESPNCompetitor({
      linescores: [{ displayValue: "68", period: 1, teeTime: "2025-06-01T07:30:00Z" }],
    });
    global.fetch = mockFetchResponse({
      events: [makeESPNEvent({ competitions: [{ competitors: [comp1, comp2] }] })],
    });

    const result = await fetchTournamentSnapshot("evt1");
    expect(result.firstTeeTime).toBe("2025-06-01T07:30:00Z");
  });

  it("falls back to status.teeTime if linescores has no tee time", async () => {
    const comp = makeESPNCompetitor({
      linescores: [{ displayValue: "68", period: 1 }],
      status: {
        type: { name: "STATUS_ACTIVE", state: "pre" },
        teeTime: "2025-06-01T08:00:00Z",
      },
    });
    global.fetch = mockFetchResponse({
      events: [makeESPNEvent({ competitions: [{ competitors: [comp] }] })],
    });

    const result = await fetchTournamentSnapshot("evt1");
    expect(result.firstTeeTime).toBe("2025-06-01T08:00:00Z");
  });
});

describe("fetchTournamentStatus", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns the tournament status", async () => {
    global.fetch = mockFetchResponse({
      events: [makeESPNEvent({ status: { type: { state: "post", completed: true } } })],
    });

    const result = await fetchTournamentStatus("evt1");
    expect(result).toBe("post");
  });
});

describe("fetchFirstTeeTime", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns the first tee time", async () => {
    global.fetch = mockFetchResponse({
      events: [makeESPNEvent()],
    });

    const result = await fetchFirstTeeTime("evt1");
    expect(result).toBe("2025-06-01T07:00:00Z");
  });

  it("returns null when no tee times available", async () => {
    global.fetch = mockFetchResponse({ events: [] });
    const result = await fetchFirstTeeTime("evt1");
    expect(result).toBeNull();
  });
});

describe("fetchPlayersFromLeaderboard", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns mapped players from ESPN data", async () => {
    global.fetch = mockFetchResponse({
      events: [makeESPNEvent()],
    });

    const result = await fetchPlayersFromLeaderboard("evt1");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("123");
    expect(result[0].displayName).toBe("Test Player");
    expect(result[0].shortName).toBe("T. Player");
    expect(result[0].amateur).toBe(false);
  });

  it("returns empty array when no events", async () => {
    global.fetch = mockFetchResponse({ events: [] });
    const result = await fetchPlayersFromLeaderboard("evt1");
    expect(result).toEqual([]);
  });

  it("returns empty array when no competitions", async () => {
    global.fetch = mockFetchResponse({
      events: [makeESPNEvent({ competitions: [] })],
    });
    const result = await fetchPlayersFromLeaderboard("evt1");
    expect(result).toEqual([]);
  });

  it("throws on API error", async () => {
    global.fetch = mockFetchResponse({}, false);
    await expect(fetchPlayersFromLeaderboard("evt1")).rejects.toThrow("ESPN API error");
  });

  it("falls back to recent tournament when no competitors", async () => {
    // First call (specific event) returns 0 competitors
    // Second call (leaderboard fallback) returns competitors
    const callCount = { n: 0 };
    global.fetch = vi.fn().mockImplementation(() => {
      callCount.n++;
      if (callCount.n === 1) {
        // First call: event with no competitors
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            events: [makeESPNEvent({ competitions: [{ competitors: [] }] })],
          }),
        });
      }
      // Second call: fallback leaderboard
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          events: [makeESPNEvent()],
        }),
      });
    });

    const result = await fetchPlayersFromLeaderboard("evt1");
    expect(result).toHaveLength(1);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});

describe("fetchCurrentTournaments", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns merged and deduplicated tournaments", async () => {
    const event1 = makeESPNEvent({ id: "1", status: { type: { state: "in", completed: false } } });
    const event2 = makeESPNEvent({ id: "2", date: "2025-07-01", status: { type: { state: "pre", completed: false } } });

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ events: [event1] }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ events: [event2] }) });

    const result = await fetchCurrentTournaments();
    expect(result).toHaveLength(2);
  });

  it("deduplicates events by ID", async () => {
    const event = makeESPNEvent({ id: "same", status: { type: { state: "in", completed: false } } });

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ events: [event] }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ events: [event] }) });

    const result = await fetchCurrentTournaments();
    expect(result).toHaveLength(1);
  });

  it("filters out completed tournaments", async () => {
    const activeEvent = makeESPNEvent({ id: "1", status: { type: { state: "in", completed: false } } });
    const completedEvent = makeESPNEvent({ id: "2", status: { type: { state: "post", completed: true } } });

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ events: [activeEvent, completedEvent] }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ events: [] }) });

    const result = await fetchCurrentTournaments();
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("in");
  });

  it("sorts tournaments by start date", async () => {
    const later = makeESPNEvent({ id: "1", date: "2025-08-01", status: { type: { state: "pre", completed: false } } });
    const earlier = makeESPNEvent({ id: "2", date: "2025-06-01", status: { type: { state: "pre", completed: false } } });

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ events: [later, earlier] }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ events: [] }) });

    const result = await fetchCurrentTournaments();
    expect(result[0].startDate).toBe("2025-06-01");
    expect(result[1].startDate).toBe("2025-08-01");
  });

  it("handles API errors gracefully", async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, json: () => Promise.resolve({}) })
      .mockResolvedValueOnce({ ok: false, json: () => Promise.resolve({}) });

    const result = await fetchCurrentTournaments();
    expect(result).toEqual([]);
  });

  it("maps tournament fields correctly", async () => {
    const event = makeESPNEvent({
      status: { type: { state: "in", completed: false } },
    });

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ events: [event] }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ events: [] }) });

    const result = await fetchCurrentTournaments();
    expect(result[0]).toEqual({
      id: "evt1",
      name: "The Test Open",
      startDate: "2025-06-01",
      endDate: "2025-06-04",
      courseName: "Test Course",
      purse: "$10,000,000",
      status: "in",
      isMajor: true,
    });
  });
});

describe("fetchTournamentSchedule", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns mapped tournaments from scoreboard data", async () => {
    const event = makeESPNEvent();
    global.fetch = mockFetchResponse({ events: [event] });

    const result = await fetchTournamentSchedule(2025);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("The Test Open");
  });

  it("falls back to fetchCurrentTournaments on API error", async () => {
    // First call (scoreboard) fails, then two calls from fetchCurrentTournaments
    const event = makeESPNEvent({ status: { type: { state: "in", completed: false } } });
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: false }) // scoreboard fails
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ events: [event] }) }) // leaderboard
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ events: [] }) }); // scoreboard fallback

    const result = await fetchTournamentSchedule(2025);
    expect(result).toHaveLength(1);
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it("returns empty array when no events", async () => {
    global.fetch = mockFetchResponse({ events: [] });
    const result = await fetchTournamentSchedule(2025);
    expect(result).toEqual([]);
  });
});

describe("fetchDynamicGroups", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns groups from rankings API with eventId", async () => {
    const mockGroups = { A: [], B: [], C: [], D: [] };
    global.fetch = mockFetchResponse({
      groups: mockGroups,
      wildcards: [],
      fieldAvailable: true,
    });

    const result = await fetchDynamicGroups("evt1");
    expect(result.groups).toEqual(mockGroups);
    expect(result.fieldAvailable).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith("/api/rankings?eventId=evt1");
  });

  it("returns groups from rankings API without eventId", async () => {
    global.fetch = mockFetchResponse({
      groups: { A: [], B: [], C: [], D: [] },
      wildcards: [],
    });

    const result = await fetchDynamicGroups();
    expect(result.fieldAvailable).toBe(false); // defaults to false via ??
    expect(global.fetch).toHaveBeenCalledWith("/api/rankings");
  });

  it("falls back to hardcoded groups on API error", async () => {
    // Rankings API fails, then fallback fetches recent tournament
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: false }) // rankings fail
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ events: [makeESPNEvent()] }),
      }); // recent tournament fallback

    const result = await fetchDynamicGroups("evt1");
    expect(result.fieldAvailable).toBe(false);
    expect(result.groups).toBeDefined();
    expect(Object.keys(result.groups)).toEqual(["A", "B", "C", "D"]);
  });

  it("falls back when fetch throws", async () => {
    global.fetch = vi.fn()
      .mockRejectedValueOnce(new Error("Network error")) // rankings throw
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ events: [makeESPNEvent()] }),
      }); // recent tournament fallback

    const result = await fetchDynamicGroups();
    expect(result.fieldAvailable).toBe(false);
    expect(result.groups).toBeDefined();
  });
});

describe("ESPN mapping edge cases", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("handles missing tournament displayName", async () => {
    const event = makeESPNEvent({
      tournament: undefined,
    });
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ events: [event] }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ events: [] }) });

    const result = await fetchCurrentTournaments();
    // Should fall back to event.name
    expect(result[0].name).toBe("Test Tournament");
  });

  it("handles missing courses", async () => {
    const event = makeESPNEvent({
      courses: undefined,
      status: { type: { state: "in", completed: false } },
    });
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ events: [event] }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ events: [] }) });

    const result = await fetchCurrentTournaments();
    expect(result[0].courseName).toBe("TBD");
  });

  it("handles missing major flag", async () => {
    const event = makeESPNEvent({
      tournament: { displayName: "Test", major: undefined },
      status: { type: { state: "in", completed: false } },
    });
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ events: [event] }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ events: [] }) });

    const result = await fetchCurrentTournaments();
    expect(result[0].isMajor).toBeFalsy();
  });

  it("handles missing headshot and flag on player", async () => {
    const comp = makeESPNCompetitor({
      athlete: {
        id: "999",
        displayName: "No Photo Player",
        shortName: "N. Player",
        lastName: "Player",
        amateur: true,
      },
    });
    global.fetch = mockFetchResponse({
      events: [makeESPNEvent({ competitions: [{ competitors: [comp] }] })],
    });

    const result = await fetchPlayersFromLeaderboard("evt1");
    expect(result[0].headshot).toBeUndefined();
    expect(result[0].flagUrl).toBeUndefined();
  });

  it("handles missing linescores and position on competitor", async () => {
    const comp = makeESPNCompetitor({
      linescores: undefined,
      status: { type: { name: "STATUS_FINISH", state: "post" } },
    });
    global.fetch = mockFetchResponse({
      events: [makeESPNEvent({ competitions: [{ competitors: [comp] }] })],
    });

    const result = await fetchLeaderboard("evt1");
    expect(result.scores[0].roundScores).toBeUndefined();
    expect(result.scores[0].position).toBeUndefined();
  });

  it("fetchPlayersFromRecentTournament returns empty when fallback has no events with competitors", async () => {
    // Event with no competitors and fallback leaderboard also empty
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          events: [makeESPNEvent({ competitions: [{ competitors: [] }] })],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ events: [] }),
      });

    const result = await fetchPlayersFromLeaderboard("evt1");
    expect(result).toEqual([]);
  });
});

describe("fetchLeaderboard — thru/displayThru mapping", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("maps thru and displayThru from competitor status", async () => {
    const comp = makeESPNCompetitor({
      status: {
        type: { name: "STATUS_ACTIVE", state: "in" },
        position: { displayName: "5" },
        thru: 12,
        displayThru: "12",
      },
    });
    global.fetch = mockFetchResponse({
      events: [makeESPNEvent({ competitions: [{ competitors: [comp] }] })],
    });

    const result = await fetchLeaderboard("evt1");
    expect(result.scores[0].thru).toBe(12);
    expect(result.scores[0].displayThru).toBe("12");
  });

  it("maps displayThru as 'F' for finished players", async () => {
    const comp = makeESPNCompetitor({
      status: {
        type: { name: "STATUS_FINISH", state: "post" },
        position: { displayName: "T1" },
        thru: 18,
        displayThru: "F",
      },
    });
    global.fetch = mockFetchResponse({
      events: [makeESPNEvent({ competitions: [{ competitors: [comp] }] })],
    });

    const result = await fetchLeaderboard("evt1");
    expect(result.scores[0].thru).toBe(18);
    expect(result.scores[0].displayThru).toBe("F");
    expect(result.scores[0].status).toBe("finished");
  });

  it("leaves thru/displayThru undefined when not present", async () => {
    const comp = makeESPNCompetitor({
      status: {
        type: { name: "STATUS_ACTIVE", state: "in" },
        position: { displayName: "10" },
      },
    });
    global.fetch = mockFetchResponse({
      events: [makeESPNEvent({ competitions: [{ competitors: [comp] }] })],
    });

    const result = await fetchLeaderboard("evt1");
    expect(result.scores[0].thru).toBeUndefined();
    expect(result.scores[0].displayThru).toBeUndefined();
  });
});

describe("fetchCurrentRound", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns current round from competitor linescores", async () => {
    const comp1 = makeESPNCompetitor({
      linescores: [
        { displayValue: "70", period: 1 },
        { displayValue: "68", period: 2 },
      ],
    });
    const comp2 = makeESPNCompetitor({
      linescores: [
        { displayValue: "72", period: 1 },
      ],
    });
    global.fetch = mockFetchResponse({
      events: [makeESPNEvent({ competitions: [{ competitors: [comp1, comp2] }] })],
    });

    const result = await fetchCurrentRound("evt1");
    // All STATUS_FINISH → displayRound = maxPeriod + 1 = 3
    expect(result).toEqual({ currentRound: 2, displayRound: 3, totalRounds: 4, nextRoundTeeTime: null });
  });

  it("returns round 4 of 4 for final round", async () => {
    const comp = makeESPNCompetitor({
      linescores: [
        { displayValue: "70", period: 1 },
        { displayValue: "68", period: 2 },
        { displayValue: "71", period: 3 },
        { displayValue: "69", period: 4 },
      ],
    });
    global.fetch = mockFetchResponse({
      events: [makeESPNEvent({ competitions: [{ competitors: [comp] }] })],
    });

    const result = await fetchCurrentRound("evt1");
    // Round 4 of 4 finished — displayRound capped at 4, no next tee time
    expect(result).toEqual({ currentRound: 4, displayRound: 4, totalRounds: 4, nextRoundTeeTime: null });
  });

  it("returns null on API error", async () => {
    global.fetch = mockFetchResponse({}, false);
    const result = await fetchCurrentRound("evt1");
    expect(result).toBeNull();
  });

  it("returns null when no events", async () => {
    global.fetch = mockFetchResponse({ events: [] });
    const result = await fetchCurrentRound("evt1");
    expect(result).toBeNull();
  });

  it("returns null when no competitors", async () => {
    global.fetch = mockFetchResponse({
      events: [makeESPNEvent({ competitions: [{ competitors: [] }] })],
    });
    const result = await fetchCurrentRound("evt1");
    expect(result).toBeNull();
  });

  it("returns null when no linescores on any competitor", async () => {
    const comp = makeESPNCompetitor({ linescores: undefined });
    global.fetch = mockFetchResponse({
      events: [makeESPNEvent({ competitions: [{ competitors: [comp] }] })],
    });
    const result = await fetchCurrentRound("evt1");
    expect(result).toBeNull();
  });

  it("handles playoff round (period > 4)", async () => {
    const comp = makeESPNCompetitor({
      linescores: [
        { displayValue: "70", period: 1 },
        { displayValue: "68", period: 2 },
        { displayValue: "71", period: 3 },
        { displayValue: "69", period: 4 },
        { displayValue: "68", period: 5 },
      ],
    });
    global.fetch = mockFetchResponse({
      events: [makeESPNEvent({ competitions: [{ competitors: [comp] }] })],
    });

    const result = await fetchCurrentRound("evt1");
    expect(result).toEqual({ currentRound: 5, displayRound: 5, totalRounds: 5, nextRoundTeeTime: null });
  });

  it("ignores linescores with empty or dash displayValue (ESPN pre-populates future rounds)", async () => {
    // Mirrors real ESPN data on Day 1: period 2 exists but has empty/dash displayValue
    const comp1 = makeESPNCompetitor({
      linescores: [
        { displayValue: "-1", period: 1 },
        { displayValue: "", period: 2 },
      ],
    });
    const comp2 = makeESPNCompetitor({
      linescores: [
        { displayValue: "-", period: 1 },
        { displayValue: "", period: 2 },
      ],
    });
    global.fetch = mockFetchResponse({
      events: [makeESPNEvent({ competitions: [{ competitors: [comp1, comp2] }] })],
    });

    const result = await fetchCurrentRound("evt1");
    // Only comp1 has a real score in period 1 ("-1" is a valid score)
    // Period 2 has no real scores, so currentRound should be 1
    // All STATUS_FINISH → displayRound = 2
    expect(result).toEqual({ currentRound: 1, displayRound: 2, totalRounds: 4, nextRoundTeeTime: null });
  });

  it("returns null when all linescores have empty/dash values", async () => {
    const comp = makeESPNCompetitor({
      linescores: [
        { displayValue: "-", period: 1 },
        { displayValue: "", period: 2 },
      ],
    });
    global.fetch = mockFetchResponse({
      events: [makeESPNEvent({ competitions: [{ competitors: [comp] }] })],
    });

    const result = await fetchCurrentRound("evt1");
    expect(result).toBeNull();
  });

  it("returns next round tee time when current round is complete", async () => {
    const comp = makeESPNCompetitor({
      linescores: [
        { displayValue: "70", period: 1, teeTime: "2025-06-01T07:00:00Z" },
        { displayValue: "", period: 2, teeTime: "2025-06-02T08:30:00Z" },
      ],
    });
    global.fetch = mockFetchResponse({
      events: [makeESPNEvent({ competitions: [{ competitors: [comp] }] })],
    });

    const result = await fetchCurrentRound("evt1");
    // comp has STATUS_FINISH → current round (1) is done → displayRound = 2, tee time from round 2
    expect(result).toEqual({ currentRound: 1, displayRound: 2, totalRounds: 4, nextRoundTeeTime: "2025-06-02T08:30:00Z" });
  });

  it("returns current round tee time when round is still in progress", async () => {
    const comp1 = makeESPNCompetitor({
      status: { type: { name: "STATUS_ACTIVE", state: "in" }, position: { displayName: "T5" } },
      linescores: [
        { displayValue: "70", period: 1, teeTime: "2025-06-01T07:00:00Z" },
        { displayValue: "", period: 2, teeTime: "2025-06-02T09:00:00Z" },
      ],
    });
    const comp2 = makeESPNCompetitor({
      linescores: [
        { displayValue: "68", period: 1, teeTime: "2025-06-01T07:30:00Z" },
        { displayValue: "", period: 2, teeTime: "2025-06-02T08:00:00Z" },
      ],
    });
    global.fetch = mockFetchResponse({
      events: [makeESPNEvent({ competitions: [{ competitors: [comp1, comp2] }] })],
    });

    const result = await fetchCurrentRound("evt1");
    // comp1 is STATUS_ACTIVE → round 1 still in progress → displayRound = 1
    expect(result).toEqual({ currentRound: 1, displayRound: 1, totalRounds: 4, nextRoundTeeTime: "2025-06-01T07:00:00Z" });
  });

  it("picks earliest tee time across competitors for next round", async () => {
    const comp1 = makeESPNCompetitor({
      linescores: [
        { displayValue: "70", period: 1, teeTime: "2025-06-01T07:00:00Z" },
        { displayValue: "", period: 2, teeTime: "2025-06-02T10:00:00Z" },
      ],
    });
    const comp2 = makeESPNCompetitor({
      linescores: [
        { displayValue: "68", period: 1, teeTime: "2025-06-01T07:30:00Z" },
        { displayValue: "", period: 2, teeTime: "2025-06-02T07:45:00Z" },
      ],
    });
    global.fetch = mockFetchResponse({
      events: [makeESPNEvent({ competitions: [{ competitors: [comp1, comp2] }] })],
    });

    const result = await fetchCurrentRound("evt1");
    // Both finished → displayRound = 2 → earliest tee time is comp2's
    expect(result).toEqual({ currentRound: 1, displayRound: 2, totalRounds: 4, nextRoundTeeTime: "2025-06-02T07:45:00Z" });
  });

  it("returns null tee time when next round has no tee times", async () => {
    const comp = makeESPNCompetitor({
      linescores: [
        { displayValue: "70", period: 1, teeTime: "2025-06-01T07:00:00Z" },
        { displayValue: "", period: 2 },
      ],
    });
    global.fetch = mockFetchResponse({
      events: [makeESPNEvent({ competitions: [{ competitors: [comp] }] })],
    });

    const result = await fetchCurrentRound("evt1");
    expect(result).toEqual({ currentRound: 1, displayRound: 2, totalRounds: 4, nextRoundTeeTime: null });
  });

  it("treats STATUS_SCHEDULED as round complete (between rounds overnight)", async () => {
    const comp1 = makeESPNCompetitor({
      status: { type: { name: "STATUS_SCHEDULED", state: "pre" }, position: { displayName: "T1" } },
      linescores: [
        { displayValue: "68", period: 1, teeTime: "2025-06-01T07:00:00Z" },
        { displayValue: "", period: 2, teeTime: "2025-06-02T08:30:00Z" },
      ],
    });
    const comp2 = makeESPNCompetitor({
      status: { type: { name: "STATUS_SCHEDULED", state: "pre" }, position: { displayName: "T3" } },
      linescores: [
        { displayValue: "70", period: 1, teeTime: "2025-06-01T07:30:00Z" },
        { displayValue: "", period: 2, teeTime: "2025-06-02T09:00:00Z" },
      ],
    });
    global.fetch = mockFetchResponse({
      events: [makeESPNEvent({ competitions: [{ competitors: [comp1, comp2] }] })],
    });

    const result = await fetchCurrentRound("evt1");
    // STATUS_SCHEDULED = not actively playing → round 1 is done → display round 2
    expect(result).toEqual({ currentRound: 1, displayRound: 2, totalRounds: 4, nextRoundTeeTime: "2025-06-02T08:30:00Z" });
  });
});
