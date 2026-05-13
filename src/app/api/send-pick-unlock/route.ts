import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getParty, getUserEmail, getUserDisplayName, hasIncompleteOrNoPicks, getPicks, createPickUnlock, invalidatePreviousUnlocks } from "@/lib/firestore";

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not configured");
  return new Resend(key);
}

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

    // Build unlock URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.headers.get("origin") || "http://localhost:3000";
    const unlockUrl = `${baseUrl}/party/${partyId}/picks?unlock=${token}`;

    // Initialise Resend only after all validation passes
    const resend = getResend();

    // Send email
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "Golf Tourney Tracker <onboarding@resend.dev>",
      to: targetEmail,
      subject: `🔓 You've been granted access to submit your picks for "${party.name}"`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <span style="font-size: 48px;">🔓</span>
          </div>
          <h1 style="color: #166534; font-size: 22px; text-align: center; margin-bottom: 8px;">
            Submit Your Picks
          </h1>
          <p style="color: #4b5563; text-align: center; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">
            Hi <strong>${targetName}</strong>, the tournament has started but the owner of
            <strong>&ldquo;${party.name}&rdquo;</strong> has granted you temporary access to submit your golfer picks.
          </p>
          <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
            <p style="color: #92400e; font-size: 14px; font-weight: 600; margin: 0;">
              ⏳ This link expires in 1 hour
            </p>
            <p style="color: #92400e; font-size: 13px; margin: 4px 0 0 0;">
              Make your picks before the link expires — you won&rsquo;t be able to change them afterwards.
            </p>
          </div>
          <div style="text-align: center; margin-bottom: 24px;">
            <a href="${unlockUrl}"
               style="display: inline-block; background: #15803d; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
              Pick Your Golfers
            </a>
          </div>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">
            Golf Tourney Tracker — Pick your golfers, track tournaments, compete with friends.
          </p>
        </div>
      `,
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
