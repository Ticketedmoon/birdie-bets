import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not configured");
  return new Resend(key);
}

interface InvalidMember {
  email: string;
  displayName: string;
  invalidPlayers: string[];
}

export async function POST(request: NextRequest) {
  try {
    const resend = getResend();
    const { partyId, partyName, invalidMembers } = (await request.json()) as {
      partyId: string;
      partyName: string;
      invalidMembers: InvalidMember[];
    };

    if (!invalidMembers || invalidMembers.length === 0) {
      return NextResponse.json({ sent: 0, failed: 0 });
    }

    const baseUrl = request.headers.get("origin") || "http://localhost:3000";
    const picksUrl = `${baseUrl}/party/${partyId}/picks`;

    const results = await Promise.allSettled(
      invalidMembers.map((member) =>
        resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || "Golf Tourney Tracker <onboarding@resend.dev>",
          to: member.email,
          subject: `⚠️ Update your picks for "${partyName}" — tournament starting!`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
              <div style="text-align: center; margin-bottom: 24px;">
                <span style="font-size: 48px;">⚠️</span>
              </div>
              <h1 style="color: #b45309; font-size: 22px; text-align: center; margin-bottom: 8px;">
                Action Required
              </h1>
              <p style="color: #4b5563; text-align: center; font-size: 15px; line-height: 1.6; margin-bottom: 16px;">
                Hi <strong>${member.displayName}</strong>, the tournament for
                <strong>"${partyName}"</strong> is about to start, but some of your picks
                are not in the confirmed field.
              </p>
              <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                <p style="color: #92400e; font-size: 14px; font-weight: 600; margin: 0 0 8px 0;">
                  Players not in the field:
                </p>
                <ul style="color: #92400e; font-size: 14px; margin: 0; padding-left: 20px;">
                  ${member.invalidPlayers.map((p) => `<li>${p}</li>`).join("")}
                </ul>
              </div>
              <p style="color: #4b5563; text-align: center; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
                Please update your picks before the tournament locks. The game can't start until
                all players have valid picks!
              </p>
              <div style="text-align: center; margin-bottom: 24px;">
                <a href="${picksUrl}"
                   style="display: inline-block; background: #d97706; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
                  Update Your Picks
                </a>
              </div>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
              <p style="color: #9ca3af; font-size: 12px; text-align: center;">
                Golf Tourney Tracker — Pick your golfers, track tournaments, compete with friends.
              </p>
            </div>
          `,
        })
      )
    );

    const sent = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    return NextResponse.json({ sent, failed, total: invalidMembers.length });
  } catch (error) {
    console.error("Invalid picks notification error:", error);
    return NextResponse.json(
      { error: "Failed to send notifications" },
      { status: 500 }
    );
  }
}
