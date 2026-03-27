import "server-only";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserOrThrow } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import {
  ORDER_TABLE,
  ORDER_WITH_RELATIONS_SELECT,
  ORDERS_PATH,
} from "@/utils/constants/orders";
import { mapDashboardOrder } from "@/utils/helpers/orders";
import type {
  OrderInvoiceStatus,
  RawOrderRecord,
} from "@/utils/interfaces/orders";
import {
  CheckoutFacilityRecord,
  CreateStripeNet30InvoiceResult,
  LocalInvoiceRecord,
  Net30OrderRecord,
} from "@/utils/interfaces/stripe";
import { syncOrderToShipStation } from "@/lib/actions/shipstation";
import { stripe } from "../server";
import { toStripeAmount } from "../stripe";

function fromUnixTimestamp(seconds: number | null | undefined) {
  if (typeof seconds !== "number" || Number.isNaN(seconds)) {
    return null;
  }

  return new Date(seconds * 1000).toISOString();
}

function toMajorAmount(amountMinor: number | null | undefined) {
  if (typeof amountMinor !== "number" || Number.isNaN(amountMinor)) {
    return 0;
  }

  return amountMinor / 100;
}

function normalizeCurrency(currency: string | null | undefined) {
  return (currency ?? "usd").toUpperCase();
}

function fallbackInvoiceNumber(orderNumber: string) {
  return `INV-${orderNumber}`;
}

async function getOrCreateStripeCustomer(
  facility: CheckoutFacilityRecord,
  userEmail?: string | null,
) {
  if (facility.stripe_customer_id) {
    return facility.stripe_customer_id;
  }

  const customer = await stripe.customers.create({
    name: facility.name,
    email: userEmail ?? undefined,
    phone: facility.phone || undefined,
    metadata: {
      facility_id: facility.id,
      facility_contact: facility.contact,
    },
    address: {
      line1: facility.address_line_1,
      line2: facility.address_line_2 ?? undefined,
      city: facility.city,
      state: facility.state,
      postal_code: facility.postal_code,
      country: facility.country,
    },
  });

  const admin = await createAdminClient();

  const { error: facilityUpdateError } = await admin
    .from("facilities")
    .update({
      stripe_customer_id: customer.id,
    })
    .eq("id", facility.id);

  if (facilityUpdateError) {
    console.error(
      "[invoices.getOrCreateStripeCustomer] Facility update error:",
      facilityUpdateError,
    );
    throw new Error("Failed to save Stripe customer to facility.");
  }

  return customer.id;
}

async function getUpdatedDashboardOrder(
  orderId: string,
  facilityId: string,
): Promise<CreateStripeNet30InvoiceResult> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from(ORDER_TABLE)
    .select(ORDER_WITH_RELATIONS_SELECT)
    .eq("id", orderId)
    .eq("facility_id", facilityId)
    .single();

  if (error || !data) {
    console.error("[invoices.getUpdatedDashboardOrder] Error:", error);
    throw new Error("Failed to fetch updated order.");
  }

  return mapDashboardOrder(data as unknown as RawOrderRecord);
}

export async function createStripeNet30Invoice(
  orderId: string,
): Promise<CreateStripeNet30InvoiceResult> {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const user = await getCurrentUserOrThrow(supabase);

  const { data: order, error: orderError } = await admin
    .from("orders")
    .select(
      `
        id,
        order_number,
        facility_id,
        payment_method,
        payment_status,
        invoice_status,
        order_status,
        placed_at,
        order_items (
          id,
          order_id,
          product_id,
          product_name,
          product_sku,
          unit_price,
          quantity,
          shipping_amount,
          tax_amount,
          subtotal,
          total_amount
        )
      `,
    )
    .eq("id", orderId)
    .single<Net30OrderRecord>();

  if (orderError || !order) {
    console.error(
      "[invoices.createStripeNet30Invoice] Order error:",
      orderError,
    );
    throw new Error("Order not found.");
  }

  const { data: facility, error: facilityError } = await admin
    .from("facilities")
    .select(
      `
        id,
        user_id,
        name,
        contact,
        phone,
        status,
        address_line_1,
        address_line_2,
        city,
        state,
        postal_code,
        country,
        stripe_customer_id
      `,
    )
    .eq("id", order.facility_id)
    .single<CheckoutFacilityRecord & { status: "active" | "inactive" }>();

  if (facilityError || !facility) {
    console.error(
      "[invoices.createStripeNet30Invoice] Facility error:",
      facilityError,
    );
    throw new Error("Facility not found.");
  }

  if (facility.user_id !== user.id) {
    throw new Error(
      "You are not allowed to create a Net 30 invoice for this order.",
    );
  }

  if (facility.status !== "active") {
    throw new Error("Your facility is inactive.");
  }

  if (order.order_status === "canceled") {
    throw new Error("Canceled orders cannot use Net 30.");
  }

  if (
    order.payment_status === "paid" ||
    order.payment_status === "refunded" ||
    order.payment_status === "partially_refunded"
  ) {
    throw new Error("Paid or refunded orders cannot use Net 30.");
  }

  const { data: existingLocalInvoice, error: existingLocalInvoiceError } =
    await admin
      .from("invoices")
      .select(
        `
          id,
          order_id,
          invoice_number,
          provider,
          provider_invoice_id,
          status,
          amount_due,
          amount_paid,
          currency,
          due_at,
          issued_at,
          paid_at,
          hosted_invoice_url,
          created_at,
          updated_at
        `,
      )
      .eq("order_id", order.id)
      .maybeSingle<LocalInvoiceRecord>();

  if (existingLocalInvoiceError) {
    console.error(
      "[invoices.createStripeNet30Invoice] Existing local invoice error:",
      existingLocalInvoiceError,
    );
    throw new Error("Failed to check existing invoice.");
  }

  if (
    existingLocalInvoice &&
    existingLocalInvoice.provider === "stripe" &&
    existingLocalInvoice.provider_invoice_id
  ) {
    const existingStatus = existingLocalInvoice.status as OrderInvoiceStatus;

    const { error: existingOrderUpdateError } = await admin
      .from("orders")
      .update({
        order_status: "submitted",
        payment_method: "net_30",
        payment_status: existingStatus === "paid" ? "paid" : "pending",
        invoice_status: existingStatus,
        fulfillment_status: "processing",
      })
      .eq("id", order.id);

    if (existingOrderUpdateError) {
      console.error(
        "[invoices.createStripeNet30Invoice] Existing order sync error:",
        existingOrderUpdateError,
      );
      throw new Error("Failed to sync order with existing Stripe invoice.");
    }

    revalidatePath(ORDERS_PATH);

    try {
      await syncOrderToShipStation(order.id);
    } catch (error) {
      console.error(
        "[invoices.createStripeNet30Invoice] ShipStation sync failed for existing invoice, order:",
        order.id,
        error,
      );
    }

    return getUpdatedDashboardOrder(order.id, facility.id);
  }

  const stripeCustomerId = await getOrCreateStripeCustomer(
    facility,
    user.email,
  );

  const firstItem = order.order_items[0];
  if (!firstItem) {
    throw new Error("Order has no items.");
  }

  const draftInvoice = await stripe.invoices.create({
    customer: stripeCustomerId,
    collection_method: "send_invoice",
    days_until_due: 30,
    auto_advance: false,
    metadata: {
      order_id: order.id,
      order_number: order.order_number,
      facility_id: order.facility_id,
      user_id: user.id,
    },
    description: `Net 30 invoice for order ${order.order_number}`,
  });

  await stripe.invoiceItems.create({
    customer: stripeCustomerId,
    invoice: draftInvoice.id,
    amount: toStripeAmount(firstItem.total_amount),
    currency: "usd",
    description: `${firstItem.product_name} x ${firstItem.quantity} • Order ${order.order_number} • SKU: ${firstItem.product_sku}`,
    metadata: {
      order_id: order.id,
      order_number: order.order_number,
      facility_id: order.facility_id,
      user_id: user.id,
    },
  });

  const finalizedInvoice = await stripe.invoices.finalizeInvoice(
    draftInvoice.id,
  );
  const sentInvoice = await stripe.invoices.sendInvoice(finalizedInvoice.id);

  const localInvoiceStatus: OrderInvoiceStatus = "sent";

  const { error: invoiceUpsertError } = await admin.from("invoices").upsert(
    {
      order_id: order.id,
      invoice_number:
        sentInvoice.number ??
        finalizedInvoice.number ??
        fallbackInvoiceNumber(order.order_number),
      provider: "stripe",
      provider_invoice_id: sentInvoice.id,
      status: localInvoiceStatus,
      amount_due: toMajorAmount(sentInvoice.amount_due),
      amount_paid: toMajorAmount(sentInvoice.amount_paid),
      currency: normalizeCurrency(sentInvoice.currency),
      due_at: fromUnixTimestamp(sentInvoice.due_date),
      issued_at:
        fromUnixTimestamp(sentInvoice.status_transitions?.finalized_at) ??
        new Date().toISOString(),
      paid_at: fromUnixTimestamp(sentInvoice.status_transitions?.paid_at),
      hosted_invoice_url: sentInvoice.hosted_invoice_url,
    },
    { onConflict: "order_id" },
  );

  if (invoiceUpsertError) {
    console.error(
      "[invoices.createStripeNet30Invoice] Local invoice upsert error:",
      invoiceUpsertError,
    );
    throw new Error(
      invoiceUpsertError.message || "Failed to save local invoice.",
    );
  }

  const { error: orderUpdateError } = await admin
    .from("orders")
    .update({
      order_status: "submitted",
      payment_method: "net_30",
      payment_status: "pending",
      invoice_status: localInvoiceStatus,
      fulfillment_status: "processing",
    })
    .eq("id", order.id);

  if (orderUpdateError) {
    console.error(
      "[invoices.createStripeNet30Invoice] Order update error:",
      orderUpdateError,
    );
    throw new Error(
      orderUpdateError.message || "Failed to update order for Net 30.",
    );
  }

  revalidatePath(ORDERS_PATH);

  try {
    await syncOrderToShipStation(order.id);
  } catch (error) {
    console.error(
      "[invoices.createStripeNet30Invoice] ShipStation sync failed for order:",
      order.id,
      error,
    );
  }

  return getUpdatedDashboardOrder(order.id, facility.id);
}
