import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/server/firebaseAdmin";
import { packForVariant, verifySignature } from "@/lib/server/lemonsqueezy";

interface OrderEvent {
  meta: { event_name: string; custom_data?: { uid?: string } };
  data: {
    id: string;
    attributes: {
      status: string;
      test_mode: boolean;
      user_email?: string;
      first_order_item?: { variant_id: number };
    };
  };
}

/**
 * Lemon Squeezy calls this when an order is paid or refunded. Paid orders add
 * coins to purchases/{uid}.coins, which the game claims on its next sync.
 * Each order is recorded under orders/{id}, so a retried webhook never credits twice.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-signature"))) {
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }

  const event = JSON.parse(raw) as OrderEvent;
  const { event_name, custom_data } = event.meta;
  const order = event.data;
  const db = adminDb();
  const orderRef = db.collection("orders").doc(String(order.id));

  if (event_name === "order_created") {
    const uid = custom_data?.uid;
    const pack = order.attributes.first_order_item && packForVariant(order.attributes.first_order_item.variant_id);
    // Acknowledge orders we can't credit so Lemon Squeezy stops retrying, but leave a trace in the logs.
    if (!uid || !pack || order.attributes.status !== "paid") {
      console.warn("Skipping order", order.id, { uid, pack: pack?.id, status: order.attributes.status });
      return NextResponse.json({ ok: true });
    }
    await db.runTransaction(async (tx) => {
      if ((await tx.get(orderRef)).exists) return;
      tx.set(orderRef, {
        uid,
        pack: pack.id,
        coins: pack.coins,
        email: order.attributes.user_email ?? null,
        testMode: order.attributes.test_mode,
        status: "paid",
        createdAt: FieldValue.serverTimestamp(),
      });
      tx.set(db.collection("purchases").doc(uid), { coins: FieldValue.increment(pack.coins) }, { merge: true });
    });
  } else if (event_name === "order_refunded") {
    // Coins already in a player's wallet stay there; the refund is recorded for bookkeeping.
    await orderRef.set({ status: "refunded", refundedAt: FieldValue.serverTimestamp() }, { merge: true });
  }

  return NextResponse.json({ ok: true });
}
