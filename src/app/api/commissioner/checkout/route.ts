import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { getCommissionerPlan } from "@/lib/settings";
import { activateCommissioner } from "@/lib/commissioner";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const plan = await getCommissionerPlan();
  if (!plan.enabled) {
    return NextResponse.json(
      { error: "Commissioner sign-ups aren't open yet." },
      { status: 409 },
    );
  }
  const fee = plan.yearly_fee_cents ?? 0;

  // Free plan — activate immediately, no payment
  if (fee <= 0) {
    await activateCommissioner(user.id, { amountCents: 0 });
    return NextResponse.json({ activated: true });
  }

  const origin = new URL(request.url).origin;
  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    ui_mode: "embedded_page",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: fee,
          product_data: { name: "WWOS Commissioner — 1 year" },
        },
      },
    ],
    customer_email: user.email,
    metadata: { kind: "commissioner", user_id: user.id },
    return_url: `${origin}/commissioner/success?session_id={CHECKOUT_SESSION_ID}`,
  });

  return NextResponse.json({ clientSecret: session.client_secret });
}
