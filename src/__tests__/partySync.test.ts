import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Party } from "@/types";
import { mockParty } from "./helpers";

// Mock all dependencies
vi.mock("@/lib/firestore", () => ({
  getParty: vi.fn(),
  updatePartyStatus: vi.fn(),
  updatePartyInvalidPicks: vi.fn(),
  clearPartyInvalidPicks: vi.fn(),
  updatePartyLastNotified: vi.fn(),
  getUserEmail: vi.fn(),
  getUsersInfo: vi.fn(),
  compactAnalytics: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/espn", () => ({
  fetchTournamentSnapshot: vi.fn(),
}));

vi.mock("@/lib/pickValidation", () => ({
  validatePartyPicks: vi.fn(),
}));

import { syncPartyStatus } from "@/lib/partySync";
import * as firestore from "@/lib/firestore";
import * as espn from "@/lib/espn";
import * as pickValidation from "@/lib/pickValidation";

const mocks = {
  fetchTournamentSnapshot: vi.mocked(espn.fetchTournamentSnapshot),
  validatePartyPicks: vi.mocked(pickValidation.validatePartyPicks),
  updatePartyStatus: vi.mocked(firestore.updatePartyStatus),
  updatePartyInvalidPicks: vi.mocked(firestore.updatePartyInvalidPicks),
  clearPartyInvalidPicks: vi.mocked(firestore.clearPartyInvalidPicks),
  updatePartyLastNotified: vi.mocked(firestore.updatePartyLastNotified),
  getUserEmail: vi.mocked(firestore.getUserEmail),
  getUsersInfo: vi.mocked(firestore.getUsersInfo),
  compactAnalytics: vi.mocked(firestore.compactAnalytics),
};

function makeParty(overrides: Partial<Party> = {}): Party {
  return { ...mockParty, ...overrides };
}

describe("syncPartyStatus", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-01T12:00:00Z"));
    // Stub global.fetch for notification calls
    fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchSpy;
    // compactAnalytics is fire-and-forget — always resolve
    mocks.compactAnalytics.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // --- locked → complete ---

  it("transitions locked → complete when ESPN says post", async () => {
    const party = makeParty({ status: "locked" });
    mocks.fetchTournamentSnapshot.mockResolvedValue({ status: "post", firstTeeTime: null });

    const result = await syncPartyStatus(party);

    expect(mocks.updatePartyStatus).toHaveBeenCalledWith(party.id, "complete");
    expect(mocks.compactAnalytics).toHaveBeenCalledWith(party);
    expect(result.status).toBe("complete");
  });

  it("does not transition locked party when ESPN says in", async () => {
    const party = makeParty({ status: "locked" });
    mocks.fetchTournamentSnapshot.mockResolvedValue({ status: "in", firstTeeTime: null });

    const result = await syncPartyStatus(party);

    expect(mocks.updatePartyStatus).not.toHaveBeenCalled();
    expect(result.status).toBe("locked");
  });

  it("does not transition locked party when ESPN says pre", async () => {
    const party = makeParty({ status: "locked" });
    mocks.fetchTournamentSnapshot.mockResolvedValue({ status: "pre", firstTeeTime: null });

    const result = await syncPartyStatus(party);

    expect(mocks.updatePartyStatus).not.toHaveBeenCalled();
    expect(result.status).toBe("locked");
  });

  // --- picking → locked (ESPN in) ---

  it("transitions picking → locked when ESPN says in and picks are valid", async () => {
    const party = makeParty({ status: "picking" });
    mocks.fetchTournamentSnapshot.mockResolvedValue({ status: "in", firstTeeTime: null });
    mocks.validatePartyPicks.mockResolvedValue({ valid: true, invalidPicks: [] });

    const result = await syncPartyStatus(party);

    expect(mocks.updatePartyStatus).toHaveBeenCalledWith(party.id, "locked");
    expect(result.status).toBe("locked");
  });

  // --- picking → complete (ESPN post) ---

  it("transitions picking → complete when ESPN says post and picks are valid", async () => {
    const party = makeParty({ status: "picking" });
    mocks.fetchTournamentSnapshot.mockResolvedValue({ status: "post", firstTeeTime: null });
    mocks.validatePartyPicks.mockResolvedValue({ valid: true, invalidPicks: [] });

    const result = await syncPartyStatus(party);

    expect(mocks.updatePartyStatus).toHaveBeenCalledWith(party.id, "complete");
    expect(mocks.compactAnalytics).toHaveBeenCalledWith(party);
    expect(result.status).toBe("complete");
  });

  // --- picking stays picking (ESPN pre, no tee time) ---

  it("keeps picking when ESPN says pre and no tee time", async () => {
    const party = makeParty({ status: "picking" });
    mocks.fetchTournamentSnapshot.mockResolvedValue({ status: "pre", firstTeeTime: null });

    const result = await syncPartyStatus(party);

    expect(mocks.updatePartyStatus).not.toHaveBeenCalled();
    expect(mocks.validatePartyPicks).not.toHaveBeenCalled();
    expect(result.status).toBe("picking");
  });

  // --- picking stays picking (ESPN pre, future tee time) ---

  it("keeps picking when ESPN says pre and tee time is in the future", async () => {
    const party = makeParty({ status: "picking" });
    const futureTeeTime = new Date(Date.now() + 1000 * 60 * 60 * 2).toISOString(); // 2 hours from now
    mocks.fetchTournamentSnapshot.mockResolvedValue({ status: "pre", firstTeeTime: futureTeeTime });

    const result = await syncPartyStatus(party);

    expect(mocks.updatePartyStatus).not.toHaveBeenCalled();
    expect(result.status).toBe("picking");
  });

  // --- picking → locked by tee time ---

  it("transitions picking → locked when ESPN pre but tee time has passed (valid picks)", async () => {
    const party = makeParty({ status: "picking" });
    const pastTeeTime = new Date(Date.now() - 1000 * 60 * 30).toISOString(); // 30 min ago
    mocks.fetchTournamentSnapshot.mockResolvedValue({ status: "pre", firstTeeTime: pastTeeTime });
    mocks.validatePartyPicks.mockResolvedValue({ valid: true, invalidPicks: [] });

    const result = await syncPartyStatus(party);

    expect(mocks.updatePartyStatus).toHaveBeenCalledWith(party.id, "locked");
    expect(result.status).toBe("locked");
  });

  it("locks when tee time is exactly now", async () => {
    const party = makeParty({ status: "picking" });
    const nowTeeTime = new Date(Date.now()).toISOString();
    mocks.fetchTournamentSnapshot.mockResolvedValue({ status: "pre", firstTeeTime: nowTeeTime });
    mocks.validatePartyPicks.mockResolvedValue({ valid: true, invalidPicks: [] });

    const result = await syncPartyStatus(party);

    expect(mocks.updatePartyStatus).toHaveBeenCalledWith(party.id, "locked");
    expect(result.status).toBe("locked");
  });

  // --- invalid picks block locking ---

  it("stays picking and records invalid picks when validation fails", async () => {
    const party = makeParty({ status: "picking" });
    const invalidPicks = [{ uid: "uid1", playerName: "Tiger Woods", slot: "groupA" }];
    mocks.fetchTournamentSnapshot.mockResolvedValue({ status: "in", firstTeeTime: null });
    mocks.validatePartyPicks.mockResolvedValue({ valid: false, invalidPicks });
    mocks.getUserEmail.mockResolvedValue("user@test.com");
    mocks.getUsersInfo.mockResolvedValue({ uid1: { displayName: "User 1" } });

    const result = await syncPartyStatus(party);

    expect(mocks.updatePartyStatus).not.toHaveBeenCalled();
    expect(mocks.updatePartyInvalidPicks).toHaveBeenCalledWith(party.id, invalidPicks);
    expect(result.invalidPicks).toEqual(invalidPicks);
  });

  it("sends notification when invalid picks found and no recent notification", async () => {
    const party = makeParty({ status: "picking", lastInvalidNotifiedAt: undefined });
    const invalidPicks = [{ uid: "uid1", playerName: "Tiger Woods", slot: "groupA" }];
    mocks.fetchTournamentSnapshot.mockResolvedValue({ status: "in", firstTeeTime: null });
    mocks.validatePartyPicks.mockResolvedValue({ valid: false, invalidPicks });
    mocks.getUserEmail.mockResolvedValue("user@test.com");
    mocks.getUsersInfo.mockResolvedValue({ uid1: { displayName: "User 1" } });

    await syncPartyStatus(party);

    expect(mocks.updatePartyLastNotified).toHaveBeenCalledWith(party.id);
    // Verify notification fetch was called
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/api/notify-invalid-picks"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("respects notification cooldown", async () => {
    const recentNotification = new Date(Date.now() - 1000 * 60 * 30).toISOString(); // 30 min ago (within 1hr cooldown)
    const party = makeParty({ status: "picking", lastInvalidNotifiedAt: recentNotification });
    const invalidPicks = [{ uid: "uid1", playerName: "Tiger Woods", slot: "groupA" }];
    mocks.fetchTournamentSnapshot.mockResolvedValue({ status: "in", firstTeeTime: null });
    mocks.validatePartyPicks.mockResolvedValue({ valid: false, invalidPicks });

    await syncPartyStatus(party);

    expect(mocks.updatePartyLastNotified).not.toHaveBeenCalled();
    // fetch should not be called for notification (it may be called for other things)
    expect(fetchSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("/api/notify-invalid-picks"),
      expect.anything()
    );
  });

  it("sends notification when cooldown has expired", async () => {
    const oldNotification = new Date(Date.now() - 1000 * 60 * 90).toISOString(); // 90 min ago (past 1hr cooldown)
    const party = makeParty({ status: "picking", lastInvalidNotifiedAt: oldNotification });
    const invalidPicks = [{ uid: "uid1", playerName: "Tiger Woods", slot: "groupA" }];
    mocks.fetchTournamentSnapshot.mockResolvedValue({ status: "in", firstTeeTime: null });
    mocks.validatePartyPicks.mockResolvedValue({ valid: false, invalidPicks });
    mocks.getUserEmail.mockResolvedValue("user@test.com");
    mocks.getUsersInfo.mockResolvedValue({ uid1: { displayName: "User 1" } });

    await syncPartyStatus(party);

    expect(mocks.updatePartyLastNotified).toHaveBeenCalledWith(party.id);
  });

  // --- clears stale invalid picks on valid lock ---

  it("clears stale invalid picks when locking with valid picks", async () => {
    const party = makeParty({
      status: "picking",
      invalidPicks: [{ uid: "uid1", playerName: "Old Bad Pick", slot: "groupA" }],
    });
    mocks.fetchTournamentSnapshot.mockResolvedValue({ status: "in", firstTeeTime: null });
    mocks.validatePartyPicks.mockResolvedValue({ valid: true, invalidPicks: [] });

    const result = await syncPartyStatus(party);

    expect(mocks.clearPartyInvalidPicks).toHaveBeenCalledWith(party.id);
    expect(result.invalidPicks).toEqual([]);
  });

  it("does not compact analytics when transitioning to locked (not complete)", async () => {
    const party = makeParty({ status: "picking" });
    mocks.fetchTournamentSnapshot.mockResolvedValue({ status: "in", firstTeeTime: null });
    mocks.validatePartyPicks.mockResolvedValue({ valid: true, invalidPicks: [] });

    const result = await syncPartyStatus(party);

    expect(result.status).toBe("locked");
    expect(mocks.compactAnalytics).not.toHaveBeenCalled();
  });

  it("completes successfully even if analytics compaction fails", async () => {
    const party = makeParty({ status: "locked" });
    mocks.fetchTournamentSnapshot.mockResolvedValue({ status: "post", firstTeeTime: null });
    mocks.compactAnalytics.mockRejectedValue(new Error("Firestore error"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await syncPartyStatus(party);

    expect(result.status).toBe("complete");
    expect(mocks.compactAnalytics).toHaveBeenCalledWith(party);
    // Wait for the fire-and-forget promise to settle
    await vi.waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith("Analytics compaction failed:", expect.any(Error));
    });
    consoleSpy.mockRestore();
  });

  // --- complete party is not affected ---

  it("returns party unchanged when already complete", async () => {
    const party = makeParty({ status: "complete" });
    mocks.fetchTournamentSnapshot.mockResolvedValue({ status: "post", firstTeeTime: null });

    const result = await syncPartyStatus(party);

    expect(mocks.updatePartyStatus).not.toHaveBeenCalled();
    expect(result.status).toBe("complete");
  });

  // --- notification error handling ---

  it("handles notification fetch failure gracefully", async () => {
    const party = makeParty({ status: "picking", lastInvalidNotifiedAt: undefined });
    const invalidPicks = [{ uid: "uid1", playerName: "Tiger Woods", slot: "groupA" }];
    mocks.fetchTournamentSnapshot.mockResolvedValue({ status: "in", firstTeeTime: null });
    mocks.validatePartyPicks.mockResolvedValue({ valid: false, invalidPicks });
    mocks.getUserEmail.mockResolvedValue("user@test.com");
    mocks.getUsersInfo.mockResolvedValue({ uid1: { displayName: "User 1" } });
    // Make the notification fetch throw
    fetchSpy.mockRejectedValue(new Error("Network error"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await syncPartyStatus(party);

    // Should still return the invalid picks result (error is caught)
    expect(result.invalidPicks).toEqual(invalidPicks);
    expect(mocks.updatePartyLastNotified).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("skips notification when affected user has no email", async () => {
    const party = makeParty({ status: "picking", lastInvalidNotifiedAt: undefined });
    const invalidPicks = [{ uid: "uid1", playerName: "Tiger Woods", slot: "groupA" }];
    mocks.fetchTournamentSnapshot.mockResolvedValue({ status: "in", firstTeeTime: null });
    mocks.validatePartyPicks.mockResolvedValue({ valid: false, invalidPicks });
    mocks.getUserEmail.mockResolvedValue(null); // no email
    mocks.getUsersInfo.mockResolvedValue({ uid1: { displayName: "User 1" } });

    await syncPartyStatus(party);

    // No notification fetch should happen when no valid emails exist
    expect(fetchSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("/api/notify-invalid-picks"),
      expect.anything()
    );
  });
});
