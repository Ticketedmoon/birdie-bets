import { Resend } from "resend";

/**
 * Lazily create a Resend client. Must be called inside a request handler,
 * not at module scope, to avoid env-var issues during build/test.
 */
export function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not configured");
  return new Resend(key);
}

/** Default "from" address for outgoing emails */
export function getFromEmail(): string {
  return process.env.RESEND_FROM_EMAIL || "Golf Tourney Tracker <onboarding@resend.dev>";
}
