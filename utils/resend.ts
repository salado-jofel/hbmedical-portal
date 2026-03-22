import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;

if (!apiKey) {
  throw new Error("Missing RESEND_API_KEY environment variable.");
}

export const resend = new Resend(apiKey);

export const PAYMENTS_FROM_EMAIL =
  process.env.PAYMENTS_FROM_EMAIL || "payments@hbmedicalportal.com";
