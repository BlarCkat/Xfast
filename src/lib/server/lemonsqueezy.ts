import { createHmac, timingSafeEqual } from "node:crypto";
import { COIN_PACKS, type CoinPack, type PackId } from "@/game/coinPacks";

const API = "https://api.lemonsqueezy.com/v1";

/** Each coin pack is a Lemon Squeezy variant, e.g. LEMONSQUEEZY_VARIANT_POCKET=123456. */
export const variantFor = (id: PackId) => process.env[`LEMONSQUEEZY_VARIANT_${id.toUpperCase()}`];

/** The pack a paid variant stands for. Coins always come from here, never from the buyer. */
export const packForVariant = (variantId: string | number): CoinPack | undefined =>
  COIN_PACKS.find((p) => variantFor(p.id) === String(variantId));

export async function createCheckout(opts: { pack: PackId; uid: string; email?: string; redirectUrl: string }) {
  const key = process.env.LEMONSQUEEZY_API_KEY;
  const store = process.env.LEMONSQUEEZY_STORE_ID;
  const variant = variantFor(opts.pack);
  if (!key || !store || !variant) throw new Error("Lemon Squeezy env vars are not set");

  const res = await fetch(`${API}/checkouts`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      data: {
        type: "checkouts",
        attributes: {
          // The webhook reads the uid back from custom data to know whose coins to credit.
          checkout_data: { email: opts.email, custom: { uid: opts.uid } },
          product_options: { redirect_url: opts.redirectUrl },
        },
        relationships: {
          store: { data: { type: "stores", id: store } },
          variant: { data: { type: "variants", id: variant } },
        },
      },
    }),
  });
  if (!res.ok) throw new Error(`Lemon Squeezy checkout failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { data: { attributes: { url: string } } };
  return json.data.attributes.url;
}

/** Lemon Squeezy signs the raw body with the webhook secret (HMAC-SHA256, hex) in X-Signature. */
export function verifySignature(rawBody: string, signature: string | null) {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(rawBody).digest("hex"), "utf8");
  const given = Buffer.from(signature, "utf8");
  return expected.length === given.length && timingSafeEqual(expected, given);
}
