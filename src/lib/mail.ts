import nodemailer from "nodemailer";
import { HttpError } from "./auth";

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransport() {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 465);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.zoho.com",
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      // Fail fast instead of leaving the person waiting if Zoho is slow or unreachable.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }
  return transporter;
}

function layout(title: string, body: string, button?: { label: string; url: string }) {
  return `<!doctype html><html><body style="margin:0;background:#F4F5F7;font-family:-apple-system,Segoe UI,Inter,sans-serif;color:#111318">
  <div style="max-width:460px;margin:0 auto;padding:32px 20px">
    <div style="display:inline-block;background:#111318;color:#fff;font-weight:800;border-radius:12px;padding:8px 12px;font-size:15px">Pocket</div>
    <div style="background:#fff;border-radius:22px;padding:24px;margin-top:16px">
      <h1 style="margin:0 0 10px;font-size:22px">${title}</h1>
      <div style="font-size:15px;line-height:1.5;color:#3A3F48">${body}</div>
      ${button ? `<a href="${button.url}" style="display:inline-block;margin-top:18px;background:#111318;color:#fff;text-decoration:none;font-weight:700;border-radius:14px;padding:14px 20px">${button.label}</a>` : ""}
    </div>
    <p style="font-size:12px;color:#5F6672;margin-top:16px">You're getting this because someone used this address with Pocket. If that wasn't you, you can ignore this email.</p>
  </div></body></html>`;
}

export async function sendMail(to: string, subject: string, title: string, body: string, button?: { label: string; url: string }) {
  if (!process.env.SMTP_PASS) {
    console.warn(`[mail] SMTP_PASS not set — would send "${subject}" to ${to}`, button?.url ?? "");
    return;
  }
  try {
    await getTransport().sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to,
      subject,
      html: layout(title, body, button),
      text: `${title}\n\n${body.replace(/<[^>]+>/g, "")}${button ? `\n\n${button.label}: ${button.url}` : ""}`,
    });
  } catch (e) {
    console.error("[mail] couldn't send", subject, "to", to, e);
    throw new HttpError(502, "We couldn't send the email. Try again in a minute.");
  }
}
