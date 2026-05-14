import { NextRequest, NextResponse } from "next/server";
import { getParty, getUserEmail, getUserDisplayName, hasIncompleteOrNoPicks, getPicks, createPickUnlock, invalidatePreviousUnlocks } from "@/lib/firestore";
import { getResend, getFromEmail } from "@/lib/resend";
import { buildUnlockEmail } from "@/lib/emailTemplates";

export async function POST(request: NextRequest) {
  try {
    const { partyId, callerUid, targetUid } = (await request.json()) as {
      partyId: string;
      callerUid: string;
      targetUid: string;
    };

    if (!partyId || !callerUid || !targetUid) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Validate party and permissions
    const party = await getParty(partyId);
    if (!party) {
      return NextResponse.json({ error: "Party not found" }, { status: 404 });
    }
    if (party.createdBy !== callerUid) {
      return NextResponse.json({ error: "Only the party creator can send unlock emails" }, { status: 403 });
    }
    if (party.status !== "locked") {
      return NextResponse.json({ error: "Unlock emails can only be sent when the party is locked" }, { status: 400 });
    }
    if (!party.memberUids.includes(targetUid)) {
      return NextResponse.json({ error: "Target user is not a member of this party" }, { status: 400 });
    }

    // Verify member has incomplete or no picks
    const targetPicks = await getPicks(partyId, targetUid);
    if (!hasIncompleteOrNoPicks(targetPicks)) {
      return NextResponse.json({ error: "This member already has complete picks" }, { status: 400 });
    }

    // Load target user info server-side
    const [targetEmail, targetName] = await Promise.all([
      getUserEmail(targetUid),
      getUserDisplayName(targetUid),
    ]);
    if (!targetEmail) {
      return NextResponse.json({ error: "Could not find email for this member" }, { status: 400 });
    }

    // Invalidate any previous unused tokens for this user
    await invalidatePreviousUnlocks(partyId, targetUid);

    // Generate unlock token and store it
    const token = crypto.randomUUID();
    await createPickUnlock(partyId, token, targetUid, callerUid);

    // Build unlock URL and email
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.headers.get("origin") || "http://localhost:3000";
    const unlockUrl = `${baseUrl}/party/${partyId}/picks?unlock=${token}`;
    const template = buildUnlockEmail({ targetName, partyName: party.name, unlockUrl });

    // Initialise Resend only after all validation passes
    const resend = getResend();

    await resend.emails.send({
      from: getFromEmail(),
      to: targetEmail,
      subject: template.subject,
      html: template.html,
    });

    return NextResponse.json({ success: true, sentTo: targetEmail });
  } catch (error) {
    console.error("Send pick unlock error:", error);
    return NextResponse.json(
      { error: "Failed to send unlock email" },
      { status: 500 }
    );
  }
}
