/**
 * Escape HTML special characters to prevent injection in email templates.
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// --- Shared email wrapper ---

const FOOTER = `
  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
  <p style="color: #9ca3af; font-size: 12px; text-align: center;">
    Golf Tourney Tracker — Pick your golfers, track tournaments, compete with friends.
  </p>`;

function emailWrapper(icon: string, content: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="font-size: 48px;">${icon}</span>
      </div>
      ${content}
      ${FOOTER}
    </div>`;
}

function ctaButton(href: string, label: string, color = "#15803d"): string {
  return `
    <div style="text-align: center; margin-bottom: 24px;">
      <a href="${escapeHtml(href)}"
         style="display: inline-block; background: ${color}; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
        ${escapeHtml(label)}
      </a>
    </div>`;
}

// --- Template builders ---

export function buildInviteEmail(params: {
  invitedBy: string;
  partyName: string;
  joinUrl: string;
  inviteCode: string;
}): { subject: string; html: string } {
  const { invitedBy, partyName, joinUrl, inviteCode } = params;
  return {
    subject: `You're invited to join "${escapeHtml(partyName)}" on Golf Tourney Tracker!`,
    html: emailWrapper("⛳", `
      <h1 style="color: #166534; font-size: 22px; text-align: center; margin-bottom: 8px;">
        You're Invited!
      </h1>
      <p style="color: #4b5563; text-align: center; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">
        <strong>${escapeHtml(invitedBy)}</strong> has invited you to join
        <strong>"${escapeHtml(partyName)}"</strong> on Golf Tourney Tracker.
        Pick your golfers and compete on the leaderboard!
      </p>
      ${ctaButton(joinUrl, "Join the Party")}
      <div style="text-align: center; color: #9ca3af; font-size: 13px; margin-bottom: 8px;">
        Or use this invite code:
      </div>
      <div style="text-align: center; font-size: 24px; font-weight: 700; letter-spacing: 6px; color: #166534; font-family: monospace; margin-bottom: 24px;">
        ${escapeHtml(inviteCode)}
      </div>
    `),
  };
}

export function buildUnlockEmail(params: {
  targetName: string;
  partyName: string;
  unlockUrl: string;
}): { subject: string; html: string } {
  const { targetName, partyName, unlockUrl } = params;
  return {
    subject: `🔓 You've been granted access to submit your picks for "${escapeHtml(partyName)}"`,
    html: emailWrapper("🔓", `
      <h1 style="color: #166534; font-size: 22px; text-align: center; margin-bottom: 8px;">
        Submit Your Picks
      </h1>
      <p style="color: #4b5563; text-align: center; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">
        Hi <strong>${escapeHtml(targetName)}</strong>, the tournament has started but the owner of
        <strong>&ldquo;${escapeHtml(partyName)}&rdquo;</strong> has granted you temporary access to submit your golfer picks.
      </p>
      <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <p style="color: #92400e; font-size: 14px; font-weight: 600; margin: 0;">
          ⏳ This link expires in 1 hour
        </p>
        <p style="color: #92400e; font-size: 13px; margin: 4px 0 0 0;">
          Make your picks before the link expires — you won&rsquo;t be able to change them afterwards.
        </p>
      </div>
      ${ctaButton(unlockUrl, "Pick Your Golfers")}
    `),
  };
}

export function buildInvalidPicksEmail(params: {
  displayName: string;
  partyName: string;
  invalidPlayers: string[];
  picksUrl: string;
}): { subject: string; html: string } {
  const { displayName, partyName, invalidPlayers, picksUrl } = params;
  return {
    subject: `⚠️ Update your picks for "${escapeHtml(partyName)}" — tournament starting!`,
    html: emailWrapper("⚠️", `
      <h1 style="color: #b45309; font-size: 22px; text-align: center; margin-bottom: 8px;">
        Action Required
      </h1>
      <p style="color: #4b5563; text-align: center; font-size: 15px; line-height: 1.6; margin-bottom: 16px;">
        Hi <strong>${escapeHtml(displayName)}</strong>, the tournament for
        <strong>"${escapeHtml(partyName)}"</strong> is about to start, but some of your picks
        are not in the confirmed field.
      </p>
      <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <p style="color: #92400e; font-size: 14px; font-weight: 600; margin: 0 0 8px 0;">
          Players not in the field:
        </p>
        <ul style="color: #92400e; font-size: 14px; margin: 0; padding-left: 20px;">
          ${invalidPlayers.map((p) => `<li>${escapeHtml(p)}</li>`).join("")}
        </ul>
      </div>
      <p style="color: #4b5563; text-align: center; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
        Please update your picks before the tournament locks. The game can't start until
        all players have valid picks!
      </p>
      ${ctaButton(picksUrl, "Update Your Picks", "#d97706")}
    `),
  };
}
