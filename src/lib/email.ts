// Resend-powered email. Failures are logged, never thrown — email must not
// break fulfillment, draws, or crons.

const SKIP = [/@wwos\.test$/i, /@wwossweepstakes\.com$/i]; // QA + simulator accounts

function branded(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:#0e1726;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px">
    <p style="text-align:center;margin:0 0 4px;color:#a7a9ac;font-size:11px;letter-spacing:3px">WIDE WORLD OF</p>
    <p style="text-align:center;margin:0;color:#c0273d;font-size:34px;font-weight:bold;font-style:italic">Sports</p>
    <p style="text-align:center;margin:2px 0 24px;color:#a7a9ac;font-size:11px;letter-spacing:3px">SWEEPSTAKES</p>
    <div style="background:#15233f;border:1px solid #243759;border-radius:10px;padding:24px;color:#f5f7fa">
      <h1 style="margin:0 0 12px;font-size:20px">${title}</h1>
      ${bodyHtml}
    </div>
    <p style="text-align:center;margin:18px 0 0;color:#a7a9ac;font-size:11px">
      © Wide World of Sports Sweepstakes · No purchase necessary — see official rules per sweepstakes.
    </p>
  </div></body></html>`;
}

export async function sendEmail(
  to: string,
  subject: string,
  title: string,
  bodyHtml: string,
): Promise<boolean> {
  try {
    if (!process.env.RESEND_API_KEY || SKIP.some((re) => re.test(to))) {
      return false;
    }
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from:
          process.env.EMAIL_FROM ??
          "WWOS Sweepstakes <noreply@wwossweepstakes.com>",
        to,
        subject,
        html: branded(title, bodyHtml),
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

const ACCENT = `style="color:#a9d3ec"`;
export const emailStyles = { ACCENT };

export function p(text: string): string {
  return `<p style="margin:0 0 10px;font-size:14px;line-height:1.6;color:#dfe6ef">${text}</p>`;
}

export function cta(href: string, label: string): string {
  return `<p style="margin:18px 0 4px"><a href="${href}" style="background:#c0273d;color:#fff;text-decoration:none;font-weight:bold;font-size:14px;padding:10px 22px;border-radius:6px;display:inline-block">${label}</a></p>`;
}

export const SITE = "https://www.wwossweepstakes.com";
