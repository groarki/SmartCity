import nodemailer from "nodemailer";
import { HttpError } from "../utils/httpError.js";

function getEmailConfig() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT);
  const from = process.env.EMAIL_FROM;
  const resetUrl = process.env.PASSWORD_RESET_URL;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (
    !host ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535 ||
    !from ||
    !resetUrl ||
    Boolean(user) !== Boolean(pass)
  ) {
    throw new HttpError(
      503,
      "Password reset email is not configured. Set the SMTP and reset URL environment variables."
    );
  }

  let parsedResetUrl;
  try {
    parsedResetUrl = new URL(resetUrl);
  } catch {
    throw new HttpError(503, "PASSWORD_RESET_URL must be a valid absolute URL.");
  }

  if (!["http:", "https:"].includes(parsedResetUrl.protocol)) {
    throw new HttpError(503, "PASSWORD_RESET_URL must use HTTP or HTTPS.");
  }

  return {
    host,
    port,
    secure: process.env.SMTP_SECURE === "true",
    from,
    resetUrl: parsedResetUrl,
    auth: user ? { user, pass } : undefined
  };
}

export function assertPasswordResetEmailConfigured() {
  getEmailConfig();
}

export async function sendPasswordResetEmail(email, token) {
  const emailConfig = getEmailConfig();
  const resetUrl = new URL(emailConfig.resetUrl);
  resetUrl.searchParams.set("token", token);
  const transporter = nodemailer.createTransport({
    host: emailConfig.host,
    port: emailConfig.port,
    secure: emailConfig.secure,
    auth: emailConfig.auth
  });

  await transporter.sendMail({
    from: emailConfig.from,
    to: email,
    subject: "Reset your SmartCity password",
    text: `Use this link within 15 minutes to reset your password: ${resetUrl}`,
    html: `<p>Use this link within 15 minutes to reset your password:</p><p><a href="${resetUrl}">Reset password</a></p>`
  });
}
