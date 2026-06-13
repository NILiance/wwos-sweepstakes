import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

const Body = z.object({
  sweepstakesId: z.string().uuid(),
  productId: z.string().uuid(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to enter." }, { status: 401 });
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { sweepstakesId, productId } = parsed.data;

  const admin = createAdminClient();
  const [{ data: sw }, { data: product }] = await Promise.all([
    admin
      .from("sweepstakes")
      .select("id,slug,name,status,pool_size")
      .eq("id", sweepstakesId)
      .single(),
    admin
      .from("products")
      .select("id,name,description,price_cents,requires_shipping,active,sweepstakes_id")
      .eq("id", productId)
      .single(),
  ]);

  if (!sw || !product || product.sweepstakes_id !== sw.id || !product.active) {
    return NextResponse.json({ error: "Pool not found." }, { status: 404 });
  }
  if (sw.status !== "enrolling") {
    return NextResponse.json(
      { error: "This pool is not open for entry." },
      { status: 409 },
    );
  }
  // Capacity honors other entrants' live renewal reservations
  const { occupiedSpots } = await import("@/lib/renewals");
  const occupied = await occupiedSpots(sw.id, user.id);
  if (occupied >= sw.pool_size) {
    return NextResponse.json(
      { error: "Pool is full (some spots are reserved for returning entrants)." },
      { status: 409 },
    );
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
          unit_amount: product.price_cents,
          product_data: {
            name: product.name,
            description: product.description ?? undefined,
          },
        },
      },
    ],
    customer_email: user.email,
    metadata: {
      sweepstakes_id: sw.id,
      product_id: product.id,
      user_id: user.id,
    },
    ...(product.requires_shipping
      ? { shipping_address_collection: { allowed_countries: ["US"] } }
      : {}),
    return_url: `${origin}/s/${sw.slug}/success?session_id={CHECKOUT_SESSION_ID}`,
  });

  return NextResponse.json({ clientSecret: session.client_secret });
}
