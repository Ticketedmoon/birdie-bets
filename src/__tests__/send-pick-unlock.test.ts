import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockParty, incompletePicks, completePicks, CREATOR_UID, TARGET_UID, PARTY_ID, makeRequest } from "./helpers";

// Mock Firestore module
vi.mock("@/lib/firestore", () => ({
  getParty: vi.fn(),
  getPicks: vi.fn(),
  hasIncompleteOrNoPicks: vi.fn(),
  getUserEmail: vi.fn(),
  getUserDisplayName: vi.fn(),
  invalidatePreviousUnlocks: vi.fn(),
  createPickUnlock: vi.fn(),
}));

// Mock Resend via shared helper
vi.mock("@/lib/resend", () => ({
  getResend: vi.fn().mockReturnValue({
    emails: { send: vi.fn().mockResolvedValue({ id: "email-id" }) },
  }),
  getFromEmail: vi.fn().mockReturnValue("test@example.com"),
}));

// Mock email templates
vi.mock("@/lib/emailTemplates", () => ({
  buildUnlockEmail: vi.fn().mockReturnValue({
    subject: "Test subject",
    html: "<p>Test html</p>",
  }),
}));

import { POST } from "@/app/api/send-pick-unlock/route";
import * as firestore from "@/lib/firestore";

const mocks = {
  getParty: vi.mocked(firestore.getParty),
  getPicks: vi.mocked(firestore.getPicks),
  hasIncompleteOrNoPicks: vi.mocked(firestore.hasIncompleteOrNoPicks),
  getUserEmail: vi.mocked(firestore.getUserEmail),
  getUserDisplayName: vi.mocked(firestore.getUserDisplayName),
  invalidatePreviousUnlocks: vi.mocked(firestore.invalidatePreviousUnlocks),
  createPickUnlock: vi.mocked(firestore.createPickUnlock),
};

function setupHappyPath() {
  mocks.getParty.mockResolvedValue(mockParty);
  mocks.getPicks.mockResolvedValue(null);
  mocks.hasIncompleteOrNoPicks.mockReturnValue(true);
  mocks.getUserEmail.mockResolvedValue("target@example.com");
  mocks.getUserDisplayName.mockResolvedValue("Target User");
  mocks.invalidatePreviousUnlocks.mockResolvedValue(undefined);
  mocks.createPickUnlock.mockResolvedValue({
    uid: TARGET_UID,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    used: false,
    createdBy: CREATOR_UID,
  });
}

describe("POST /api/send-pick-unlock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_API_KEY = "test-key";
  });

  // --- Validation tests ---

  it("returns 400 when partyId is missing", async () => {
    const req = makeRequest({ callerUid: CREATOR_UID, targetUid: TARGET_UID });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Missing required fields" });
    // No Firestore calls should have been made
    expect(mocks.getParty).not.toHaveBeenCalled();
  });

  it("returns 400 when callerUid is missing", async () => {
    const req = makeRequest({ partyId: PARTY_ID, targetUid: TARGET_UID });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
    expect(mocks.getParty).not.toHaveBeenCalled();
  });

  it("returns 400 when targetUid is missing", async () => {
    const req = makeRequest({ partyId: PARTY_ID, callerUid: CREATOR_UID });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
    expect(mocks.getParty).not.toHaveBeenCalled();
  });

  // --- Party validation ---

  it("returns 404 when party not found", async () => {
    mocks.getParty.mockResolvedValue(null);
    const req = makeRequest({ partyId: PARTY_ID, callerUid: CREATOR_UID, targetUid: TARGET_UID });
    const res = await POST(req as any);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Party not found" });
    // Should not proceed to check picks
    expect(mocks.getPicks).not.toHaveBeenCalled();
  });

  it("returns 403 when caller is not the party creator", async () => {
    mocks.getParty.mockResolvedValue(mockParty);
    const req = makeRequest({ partyId: PARTY_ID, callerUid: "not-the-creator", targetUid: TARGET_UID });
    const res = await POST(req as any);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Only the party creator can send unlock emails" });
    expect(mocks.getPicks).not.toHaveBeenCalled();
    expect(mocks.invalidatePreviousUnlocks).not.toHaveBeenCalled();
  });

  it("returns 400 when party is not locked (picking)", async () => {
    mocks.getParty.mockResolvedValue({ ...mockParty, status: "picking" });
    const req = makeRequest({ partyId: PARTY_ID, callerUid: CREATOR_UID, targetUid: TARGET_UID });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Unlock emails can only be sent when the party is locked" });
    expect(mocks.getPicks).not.toHaveBeenCalled();
  });

  it("returns 400 when party is complete", async () => {
    mocks.getParty.mockResolvedValue({ ...mockParty, status: "complete" });
    const req = makeRequest({ partyId: PARTY_ID, callerUid: CREATOR_UID, targetUid: TARGET_UID });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
    expect(mocks.invalidatePreviousUnlocks).not.toHaveBeenCalled();
  });

  it("returns 400 when target is not a party member", async () => {
    mocks.getParty.mockResolvedValue({
      ...mockParty,
      memberUids: [CREATOR_UID], // target not included
    });
    const req = makeRequest({ partyId: PARTY_ID, callerUid: CREATOR_UID, targetUid: TARGET_UID });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Target user is not a member of this party" });
    expect(mocks.getPicks).not.toHaveBeenCalled();
  });

  // --- Picks validation ---

  it("returns 400 when member already has complete picks", async () => {
    mocks.getParty.mockResolvedValue(mockParty);
    mocks.getPicks.mockResolvedValue(completePicks);
    mocks.hasIncompleteOrNoPicks.mockReturnValue(false);
    const req = makeRequest({ partyId: PARTY_ID, callerUid: CREATOR_UID, targetUid: TARGET_UID });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "This member already has complete picks" });
    // Should not proceed to send email
    expect(mocks.invalidatePreviousUnlocks).not.toHaveBeenCalled();
    expect(mocks.createPickUnlock).not.toHaveBeenCalled();
  });

  // --- Email/user info ---

  it("returns 400 when target user has no email", async () => {
    mocks.getParty.mockResolvedValue(mockParty);
    mocks.getPicks.mockResolvedValue(null);
    mocks.hasIncompleteOrNoPicks.mockReturnValue(true);
    mocks.getUserEmail.mockResolvedValue(null);
    mocks.getUserDisplayName.mockResolvedValue("Target User");
    const req = makeRequest({ partyId: PARTY_ID, callerUid: CREATOR_UID, targetUid: TARGET_UID });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Could not find email for this member" });
    expect(mocks.invalidatePreviousUnlocks).not.toHaveBeenCalled();
  });

  // --- Happy path ---

  it("sends unlock email and returns success", async () => {
    setupHappyPath();
    const req = makeRequest({ partyId: PARTY_ID, callerUid: CREATOR_UID, targetUid: TARGET_UID });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.sentTo).toBe("target@example.com");

    // Verify side effects happened in correct order
    expect(mocks.invalidatePreviousUnlocks).toHaveBeenCalledWith(PARTY_ID, TARGET_UID);
    expect(mocks.createPickUnlock).toHaveBeenCalledWith(
      PARTY_ID,
      expect.any(String), // UUID token
      TARGET_UID,
      CREATOR_UID
    );
  });

  it("invalidates previous tokens before creating a new one", async () => {
    setupHappyPath();
    const req = makeRequest({ partyId: PARTY_ID, callerUid: CREATOR_UID, targetUid: TARGET_UID });
    await POST(req as any);

    const invalidateOrder = mocks.invalidatePreviousUnlocks.mock.invocationCallOrder[0];
    const createOrder = mocks.createPickUnlock.mock.invocationCallOrder[0];
    expect(invalidateOrder).toBeLessThan(createOrder);
  });

  it("works when member has incomplete picks (not null)", async () => {
    mocks.getParty.mockResolvedValue(mockParty);
    mocks.getPicks.mockResolvedValue(incompletePicks);
    mocks.hasIncompleteOrNoPicks.mockReturnValue(true);
    mocks.getUserEmail.mockResolvedValue("target@example.com");
    mocks.getUserDisplayName.mockResolvedValue("Target User");
    mocks.invalidatePreviousUnlocks.mockResolvedValue(undefined);
    mocks.createPickUnlock.mockResolvedValue({
      uid: TARGET_UID,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      used: false,
      createdBy: CREATOR_UID,
    });

    const req = makeRequest({ partyId: PARTY_ID, callerUid: CREATOR_UID, targetUid: TARGET_UID });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
  });
});
