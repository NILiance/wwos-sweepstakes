import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { fulfillCheckoutSession } from "@/lib/fulfill";

// Production fulfillment source of truth. Register the endpoint in Stripe
// and set STRIPE_WEBHOOK_SECRET. The success page covers local dev.
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 501 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      await request.text(),
      signature,
      secret,
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const result = await fulfillCheckoutSession(session);
    if (!result.ok && result.reason !== "not_paid") {
      // Non-2xx makes Stripe retry — desired for transient DB failures
      return NextResponse.json({ error: result.reason }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
