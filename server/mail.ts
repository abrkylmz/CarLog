// Outgoing email (password reset links) through Resend's HTTP API. Needs RESEND_API_KEY and
// MAIL_FROM (a sender on a domain verified in Resend, e.g. "CarLog <noreply@ornek.com>"); without
// them mailConfigured() is false and the app says email isn't set up instead of failing silently.

export function mailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
}

export async function sendMail(to: string, subject: string, text: string, html: string): Promise<void> {
  // RESEND_API_URL only for tests, to point at a local stand-in.
  const res = await fetch(process.env.RESEND_API_URL ?? "https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.MAIL_FROM, to: [to], subject, text, html }),
  });
  if (!res.ok) throw new Error(`mail ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

/**
 * The app's own address for links in emails. Never taken from the request's Host header, which a
 * client can set to send someone a reset link pointing at another site.
 */
export function appUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return `http://localhost:${process.env.PORT ?? 5173}`;
}
