import { NextRequest, NextResponse } from "next/server";
import { getResend, getFromEmail } from "@/lib/resend";
import { buildInvalidPicksEmail } from "@/lib/emailTemplates";

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
      invalidMembers.map((member) => {
        const template = buildInvalidPicksEmail({
          displayName: member.displayName,
          partyName,
          invalidPlayers: member.invalidPlayers,
          picksUrl,
        });
        return resend.emails.send({
          from: getFromEmail(),
          to: member.email,
          subject: template.subject,
          html: template.html,
        });
      })
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
