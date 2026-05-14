import { describe, it, expect } from "vitest";
import {
  escapeHtml,
  buildInviteEmail,
  buildUnlockEmail,
  buildInvalidPicksEmail,
} from "@/lib/emailTemplates";

describe("escapeHtml", () => {
  it("escapes ampersands", () => {
    expect(escapeHtml("A & B")).toBe("A &amp; B");
  });

  it("escapes angle brackets", () => {
    expect(escapeHtml("<script>alert('xss')</script>")).toBe(
      "&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;"
    );
  });

  it("escapes quotes", () => {
    expect(escapeHtml('"hello"')).toBe("&quot;hello&quot;");
    expect(escapeHtml("it's")).toBe("it&#39;s");
  });

  it("returns empty string unchanged", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("leaves safe strings unchanged", () => {
    expect(escapeHtml("Hello World")).toBe("Hello World");
  });
});

describe("buildInviteEmail", () => {
  const params = {
    invitedBy: "Shane",
    partyName: "Test Party",
    joinUrl: "https://example.com/join",
    inviteCode: "ABC123",
  };

  it("returns subject with party name", () => {
    const { subject } = buildInviteEmail(params);
    expect(subject).toContain("Test Party");
  });

  it("returns html with invite code", () => {
    const { html } = buildInviteEmail(params);
    expect(html).toContain("ABC123");
  });

  it("returns html with join URL", () => {
    const { html } = buildInviteEmail(params);
    expect(html).toContain("https://example.com/join");
  });

  it("returns html with inviter name", () => {
    const { html } = buildInviteEmail(params);
    expect(html).toContain("Shane");
  });

  it("escapes HTML in user-provided strings", () => {
    const { html } = buildInviteEmail({
      ...params,
      partyName: '<script>alert("xss")</script>',
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("buildUnlockEmail", () => {
  const params = {
    targetName: "Player",
    partyName: "Test Party",
    unlockUrl: "https://example.com/unlock",
  };

  it("returns subject with party name", () => {
    const { subject } = buildUnlockEmail(params);
    expect(subject).toContain("Test Party");
  });

  it("returns html with unlock URL", () => {
    const { html } = buildUnlockEmail(params);
    expect(html).toContain("https://example.com/unlock");
  });

  it("returns html with target name", () => {
    const { html } = buildUnlockEmail(params);
    expect(html).toContain("Player");
  });

  it("includes expiry warning", () => {
    const { html } = buildUnlockEmail(params);
    expect(html).toContain("1 hour");
  });
});

describe("buildInvalidPicksEmail", () => {
  const params = {
    displayName: "User",
    partyName: "Test Party",
    invalidPlayers: ["Tiger Woods", "Phil Mickelson"],
    picksUrl: "https://example.com/picks",
  };

  it("returns subject with party name", () => {
    const { subject } = buildInvalidPicksEmail(params);
    expect(subject).toContain("Test Party");
  });

  it("returns html with invalid player names", () => {
    const { html } = buildInvalidPicksEmail(params);
    expect(html).toContain("Tiger Woods");
    expect(html).toContain("Phil Mickelson");
  });

  it("returns html with picks URL", () => {
    const { html } = buildInvalidPicksEmail(params);
    expect(html).toContain("https://example.com/picks");
  });

  it("escapes HTML in player names", () => {
    const { html } = buildInvalidPicksEmail({
      ...params,
      invalidPlayers: ['<img src=x onerror="alert(1)">'],
    });
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });
});
