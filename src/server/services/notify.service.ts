import { env } from "@/lib/env";

/**
 * Signup notifications.
 *
 * Sends the site admin an email whenever a new account is created (Google OAuth
 * or email/password), so you know the moment someone — e.g. a reviewer — signs
 * up. Uses Resend's REST API directly (no SDK dependency, works on serverless).
 *
 * Fail-safe by design: this NEVER throws. Account creation must succeed even if
 * the email provider is misconfigured or down, so all errors are swallowed and
 * logged. If RESEND_API_KEY / ADMIN_NOTIFY_EMAIL aren't set, it's a no-op.
 */
export async function notifyNewSignup(
  user: { name?: string | null; email?: string | null },
  method: "google" | "credentials",
): Promise<void> {
  const apiKey = env.RESEND_API_KEY;
  const to = env.ADMIN_NOTIFY_EMAIL;
  const label = method === "google" ? "Google" : "Email/password";

  if (!apiKey || !to) {
    console.log(`[notify] new signup via ${label}: ${user.email ?? "unknown"} (email notifications not configured)`);
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.NOTIFY_FROM_EMAIL,
        to,
        subject: `New Syncwrite signup: ${user.name ?? user.email ?? "New user"}`,
        html: `
          <div style="font-family:system-ui,sans-serif;line-height:1.5">
            <h2 style="margin:0 0 8px">New account created 🎉</h2>
            <p style="margin:0 0 12px;color:#555">Someone just signed up for Syncwrite.</p>
            <table style="border-collapse:collapse">
              <tr><td style="padding:2px 12px 2px 0;color:#888">Name</td><td>${escapeHtml(user.name) || "—"}</td></tr>
              <tr><td style="padding:2px 12px 2px 0;color:#888">Email</td><td>${escapeHtml(user.email) || "—"}</td></tr>
              <tr><td style="padding:2px 12px 2px 0;color:#888">Method</td><td>${label}</td></tr>
              <tr><td style="padding:2px 12px 2px 0;color:#888">Time</td><td>${new Date().toISOString()}</td></tr>
            </table>
          </div>`,
      }),
    });
    if (!res.ok) {
      console.error("[notify] Resend responded", res.status, await res.text());
    }
  } catch (error) {
    console.error("[notify] failed to send signup email:", error);
  }
}

function escapeHtml(value?: string | null): string {
  if (!value) return "";
  return value.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
