import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mockParty, completePicks, CREATOR_UID, TARGET_UID, PARTY_ID, makeRequest, makeValidUnlock } from "./helpers";

// Mock Firestore module
vi.mock("@/lib/firestore", () => ({
  getParty: vi.fn(),
  getPickUnlock: vi.fn(),
  savePicksWithUnlock: vi.fn(),
}));

import { POST } from "@/app/api/submit-unlocked-picks/route";
import * as firestore from "@/lib/firestore";

const mocks = {
  getParty: vi.mocked(firestore.getParty),
  getPickUnlock: vi.mocked(firestore.getPickUnlock),
  savePicksWithUnlock: vi.mocked(firestore.savePicksWithUnlock),
};

const UNLOCK_TOKEN = "valid-token-uuid";

describe("POST /api/submit-unlocked-picks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-01T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --- Input validation ---

  it("returns 400 when partyId is missing", async () => {
    const req = makeRequest({ callerUid: TARGET_UID, unlockToken: UNLOCK_TOKEN, picks: completePicks });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Missing required fields" });
    expect(mocks.getParty).not.toHaveBeenCalled();
  });

  it("returns 400 when callerUid is missing", async () => {
    const req = makeRequest({ partyId: PARTY_ID, unlockToken: UNLOCK_TOKEN, picks: completePicks });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
    expect(mocks.getParty).not.toHaveBeenCalled();
  });

  it("returns 400 when unlockToken is missing", async () => {
    const req = makeRequest({ partyId: PARTY_ID, callerUid: TARGET_UID, picks: completePicks });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
    expect(mocks.getParty).not.toHaveBeenCalled();
  });

  it("returns 400 when picks is missing", async () => {
    const req = makeRequest({ partyId: PARTY_ID, callerUid: TARGET_UID, unlockToken: UNLOCK_TOKEN });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
    expect(mocks.getParty).not.toHaveBeenCalled();
  });

  // --- Picks completeness validation ---

  it("returns 400 when groupA is missing from picks", async () => {
    const req = makeRequest({
      partyId: PARTY_ID,
      callerUid: TARGET_UID,
      unlockToken: UNLOCK_TOKEN,
      picks: { ...completePicks, groupA: null },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "All 6 pick slots must be filled" });
    expect(mocks.getParty).not.toHaveBeenCalled();
  });

  it("returns 400 when wildcard2 is missing from picks", async () => {
    const req = makeRequest({
      partyId: PARTY_ID,
      callerUid: TARGET_UID,
      unlockToken: UNLOCK_TOKEN,
      picks: { ...completePicks, wildcard2: null },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
    expect(mocks.savePicksWithUnlock).not.toHaveBeenCalled();
  });

  // --- Party validation ---

  it("returns 404 when party not found", async () => {
    mocks.getParty.mockResolvedValue(null);
    const req = makeRequest({ partyId: PARTY_ID, callerUid: TARGET_UID, unlockToken: UNLOCK_TOKEN, picks: completePicks });
    const res = await POST(req as any);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Party not found" });
    expect(mocks.getPickUnlock).not.toHaveBeenCalled();
  });

  it("returns 400 when party status is complete", async () => {
    mocks.getParty.mockResolvedValue({ ...mockParty, status: "complete" });
    const req = makeRequest({ partyId: PARTY_ID, callerUid: TARGET_UID, unlockToken: UNLOCK_TOKEN, picks: completePicks });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Tournament is complete — picks can no longer be changed" });
    expect(mocks.savePicksWithUnlock).not.toHaveBeenCalled();
  });

  it("returns 400 when party status is picking", async () => {
    mocks.getParty.mockResolvedValue({ ...mockParty, status: "picking" });
    const req = makeRequest({ partyId: PARTY_ID, callerUid: TARGET_UID, unlockToken: UNLOCK_TOKEN, picks: completePicks });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Party is not in locked state" });
  });

  // --- Token validation ---

  it("returns 403 when token does not exist", async () => {
    mocks.getParty.mockResolvedValue(mockParty);
    mocks.getPickUnlock.mockResolvedValue(null);
    const req = makeRequest({ partyId: PARTY_ID, callerUid: TARGET_UID, unlockToken: UNLOCK_TOKEN, picks: completePicks });
    const res = await POST(req as any);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Invalid unlock token" });
    expect(mocks.savePicksWithUnlock).not.toHaveBeenCalled();
  });

  it("returns 403 when token belongs to a different user", async () => {
    mocks.getParty.mockResolvedValue(mockParty);
    mocks.getPickUnlock.mockResolvedValue(makeValidUnlock({ uid: "someone-else" }));
    const req = makeRequest({ partyId: PARTY_ID, callerUid: TARGET_UID, unlockToken: UNLOCK_TOKEN, picks: completePicks });
    const res = await POST(req as any);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "This unlock token is not for your account" });
    expect(mocks.savePicksWithUnlock).not.toHaveBeenCalled();
  });

  it("returns 400 when token has already been used", async () => {
    mocks.getParty.mockResolvedValue(mockParty);
    mocks.getPickUnlock.mockResolvedValue(makeValidUnlock({ used: true, usedAt: "2025-06-01T11:30:00Z" }));
    const req = makeRequest({ partyId: PARTY_ID, callerUid: TARGET_UID, unlockToken: UNLOCK_TOKEN, picks: completePicks });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "This unlock link has already been used" });
    expect(mocks.savePicksWithUnlock).not.toHaveBeenCalled();
  });

  it("returns 400 when token has expired", async () => {
    mocks.getParty.mockResolvedValue(mockParty);
    // Token expired 1 minute ago
    mocks.getPickUnlock.mockResolvedValue(
      makeValidUnlock({ expiresAt: new Date(Date.now() - 60000).toISOString() })
    );
    const req = makeRequest({ partyId: PARTY_ID, callerUid: TARGET_UID, unlockToken: UNLOCK_TOKEN, picks: completePicks });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "This unlock link has expired" });
    expect(mocks.savePicksWithUnlock).not.toHaveBeenCalled();
  });

  it("accepts token that expires at exactly the current time (strict < comparison)", async () => {
    mocks.getParty.mockResolvedValue(mockParty);
    // Token expires at exactly now — not yet expired per strict < comparison
    mocks.getPickUnlock.mockResolvedValue(
      makeValidUnlock({ expiresAt: new Date(Date.now()).toISOString() })
    );
    mocks.savePicksWithUnlock.mockResolvedValue(undefined);
    const req = makeRequest({ partyId: PARTY_ID, callerUid: TARGET_UID, unlockToken: UNLOCK_TOKEN, picks: completePicks });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
  });

  it("accepts token that expires 1ms from now", async () => {
    mocks.getParty.mockResolvedValue(mockParty);
    mocks.getPickUnlock.mockResolvedValue(
      makeValidUnlock({ expiresAt: new Date(Date.now() + 1).toISOString() })
    );
    mocks.savePicksWithUnlock.mockResolvedValue(undefined);
    const req = makeRequest({ partyId: PARTY_ID, callerUid: TARGET_UID, unlockToken: UNLOCK_TOKEN, picks: completePicks });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
  });

  // --- Happy path ---

  it("saves picks and returns success with valid token", async () => {
    mocks.getParty.mockResolvedValue(mockParty);
    mocks.getPickUnlock.mockResolvedValue(makeValidUnlock());
    mocks.savePicksWithUnlock.mockResolvedValue(undefined);

    const req = makeRequest({ partyId: PARTY_ID, callerUid: TARGET_UID, unlockToken: UNLOCK_TOKEN, picks: completePicks });
    const res = await POST(req as any);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mocks.savePicksWithUnlock).toHaveBeenCalledWith(
      PARTY_ID,
      TARGET_UID,
      completePicks,
      UNLOCK_TOKEN
    );
  });

  it("passes the correct arguments to savePicksWithUnlock", async () => {
    mocks.getParty.mockResolvedValue(mockParty);
    mocks.getPickUnlock.mockResolvedValue(makeValidUnlock());
    mocks.savePicksWithUnlock.mockResolvedValue(undefined);

    const customPicks = {
      ...completePicks,
      groupA: { playerId: "custom-a", playerName: "Custom Player A" },
    };
    const req = makeRequest({ partyId: PARTY_ID, callerUid: TARGET_UID, unlockToken: "my-token", picks: customPicks });
    const res = await POST(req as any);

    expect(res.status).toBe(200);
    expect(mocks.savePicksWithUnlock).toHaveBeenCalledWith(
      PARTY_ID,
      TARGET_UID,
      customPicks,
      "my-token"
    );
  });

  // --- Error handling ---

  it("returns 500 when savePicksWithUnlock throws", async () => {
    mocks.getParty.mockResolvedValue(mockParty);
    mocks.getPickUnlock.mockResolvedValue(makeValidUnlock());
    mocks.savePicksWithUnlock.mockRejectedValue(new Error("Firestore batch failed"));

    const req = makeRequest({ partyId: PARTY_ID, callerUid: TARGET_UID, unlockToken: UNLOCK_TOKEN, picks: completePicks });
    const res = await POST(req as any);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Failed to save picks" });
  });
});
