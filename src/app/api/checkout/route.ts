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
  const [{ data: sw }, { data: product }, { count: taken }] =
    await Promise.all([
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
      admin
        .from("entries")
        .select("id", { count: "exact", head: true })
        .eq("sweepstakes_id", sweepstakesId)
        .eq("status", "active"),
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
  if ((taken ?? 0) >= sw.pool_size) {
    return NextResponse.json({ error: "Pool is full." }, { status: 409 });
  }

  const origin = new URL(request.url).origin;
  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
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
    success_url: `${origin}/s/${sw.slug}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/s/${sw.slug}`,
  });

  return NextResponse.json({ url: session.url });
}
