import "server-only";

import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  throw new Error("Missing STRIPE_SECRET_KEY");
}

export const stripe = new Stripe(stripeSecretKey);

export function getAppUrl() {
  const explicitUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicitUrl) {
    return explicitUrl.replace(/\/$/, "");
  }

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) {
    return `https://${vercelUrl.replace(/\/$/, "")}`;
  }

  return "http://localhost:3000";
}

export function toStripeAmount(amount: number | string) {
  const numericAmount = typeof amount === "string" ? Number(amount) : amount;

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error("Invalid amount for Stripe Checkout.");
  }

  return Math.round(numericAmount * 100);
}
