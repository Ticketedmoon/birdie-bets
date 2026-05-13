import { NextRequest, NextResponse } from "next/server";
import { getParty, getPickUnlock, savePicksWithUnlock } from "@/lib/firestore";
import type { Picks } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const { partyId, callerUid, unlockToken, picks } = (await request.json()) as {
      partyId: string;
      callerUid: string;
      unlockToken: string;
      picks: Picks;
    };

    if (!partyId || !callerUid || !unlockToken || !picks) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Validate all 6 pick slots are filled
    if (!picks.groupA || !picks.groupB || !picks.groupC || !picks.groupD || !picks.wildcard1 || !picks.wildcard2) {
      return NextResponse.json({ error: "All 6 pick slots must be filled" }, { status: 400 });
    }

    // Validate party exists and is locked (not complete)
    const party = await getParty(partyId);
    if (!party) {
      return NextResponse.json({ error: "Party not found" }, { status: 404 });
    }
    if (party.status === "complete") {
      return NextResponse.json({ error: "Tournament is complete — picks can no longer be changed" }, { status: 400 });
    }
    if (party.status !== "locked") {
      return NextResponse.json({ error: "Party is not in locked state" }, { status: 400 });
    }

    // Validate unlock token
    const unlock = await getPickUnlock(partyId, unlockToken);
    if (!unlock) {
      return NextResponse.json({ error: "Invalid unlock token" }, { status: 403 });
    }
    if (unlock.uid !== callerUid) {
      return NextResponse.json({ error: "This unlock token is not for your account" }, { status: 403 });
    }
    if (unlock.used) {
      return NextResponse.json({ error: "This unlock link has already been used" }, { status: 400 });
    }
    if (new Date(unlock.expiresAt).getTime() < Date.now()) {
      return NextResponse.json({ error: "This unlock link has expired" }, { status: 400 });
    }

    // Save picks and mark token as used atomically
    await savePicksWithUnlock(partyId, callerUid, picks, unlockToken);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Submit unlocked picks error:", error);
    return NextResponse.json(
      { error: "Failed to save picks" },
      { status: 500 }
    );
  }
}
