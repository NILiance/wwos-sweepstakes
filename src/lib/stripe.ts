import Stripe from "stripe";

// Lazy init so module import never throws at build time (e.g. during
// Next.js page-data collection when env vars are absent).
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    _stripe = new Stripe(key);
  }
  return _stripe;
}
