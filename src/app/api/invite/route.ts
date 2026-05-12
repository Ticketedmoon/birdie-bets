import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not configured");
  return new Resend(key);
}

export async function POST(request: NextRequest) {
  try {
    const resend = getResend();
    const { emails, partyName, inviteCode, invitedBy } = await request.json();

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json({ error: "No emails provided" }, { status: 400 });
    }

    const baseUrl = request.headers.get("origin") || "http://localhost:3000";
    const joinUrl = `${baseUrl}/party/join?code=${inviteCode}`;

    const results = await Promise.allSettled(
      emails.map((email: string) =>
        resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || "Golf Tourney Tracker <onboarding@resend.dev>",
          to: email,
          subject: `You're invited to join "${partyName}" on Golf Tourney Tracker!`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
              <div style="text-align: center; margin-bottom: 24px;">
                <span style="font-size: 48px;">⛳</span>
              </div>
              <h1 style="color: #166534; font-size: 22px; text-align: center; margin-bottom: 8px;">
                You're Invited!
              </h1>
              <p style="color: #4b5563; text-align: center; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">
                <strong>${invitedBy}</strong> has invited you to join
                <strong>"${partyName}"</strong> on Golf Tourney Tracker.
                Pick your golfers and compete on the leaderboard!
              </p>
              <div style="text-align: center; margin-bottom: 24px;">
                <a href="${joinUrl}"
                   style="display: inline-block; background: #15803d; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
                  Join the Party
                </a>
              </div>
              <div style="text-align: center; color: #9ca3af; font-size: 13px; margin-bottom: 8px;">
                Or use this invite code:
              </div>
              <div style="text-align: center; font-size: 24px; font-weight: 700; letter-spacing: 6px; color: #166534; font-family: monospace; margin-bottom: 24px;">
                ${inviteCode}
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

    return NextResponse.json({ sent, failed, total: emails.length });
  } catch (error) {
    console.error("Email invite error:", error);
    return NextResponse.json(
      { error: "Failed to send invites" },
      { status: 500 }
    );
  }
}
