import {
  BOARD_STATUS_DELIVERED,
  BOARD_STATUS_NEW_ORDERS,
  DEFAULT_DELIVERY_STATUS,
  DEFAULT_FULFILLMENT_STATUS,
  DEFAULT_INVOICE_STATUS,
  DEFAULT_PAYMENT_STATUS,
  DEFAULT_SHIPPING_AMOUNT,
  DEFAULT_TAX_AMOUNT,
} from "../constants/orders";
import {
  CancelOrderInput,
  cancelOrderSchema,
  CreateOrderInput,
  createOrderSchema,
  DashboardOrder,
  dashboardOrderSchema,
  EditOrderInput,
  editOrderSchema,
  MaybeRelation,
  OrderBoardStatus,
  OrderDeliveryStatus,
  OrderInvoiceStatus,
  OrderPaymentStatus,
  PaymentRecord,
  ProductRecord,
  RawOrderRecord,
  SubmitOrderPaymentChoiceInput,
  submitOrderPaymentChoiceSchema,
  UpdateOrderStatusInput,
  updateOrderStatusSchema,
} from "../interfaces/orders";

export function toNullableString(
  value: FormDataEntryValue | string | null | undefined,
): string | null {
  if (value == null) return null;

  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function toMoney(value: number): number {
  return Number(value.toFixed(2));
}

export function calculateOrderAmounts(unitPrice: number, quantity: number) {
  const safeUnitPrice = Number.isFinite(unitPrice) ? unitPrice : 0;
  const safeQuantity = Number.isFinite(quantity) ? quantity : 0;

  const shippingAmount = toMoney(DEFAULT_SHIPPING_AMOUNT);
  const taxAmount = toMoney(DEFAULT_TAX_AMOUNT);

  return {
    unit_price: toMoney(safeUnitPrice),
    shipping_amount: shippingAmount,
    tax_amount: taxAmount,
    preview_subtotal: toMoney(safeUnitPrice * safeQuantity),
    preview_total_amount: toMoney(
      safeUnitPrice * safeQuantity + shippingAmount + taxAmount,
    ),
  };
}

export function generateOrderNumber(date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();

  return `ORD-${year}${month}${day}-${random}`;
}

export function getSingleRelation<T>(value: MaybeRelation<T>): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function sortPaymentsNewestFirst(payments: PaymentRecord[] | null | undefined) {
  return [...(payments ?? [])].sort((a, b) => {
    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
    return bTime - aTime;
  });
}

export function getOrderBoardStatus(
  deliveryStatus: OrderDeliveryStatus,
): OrderBoardStatus {
  return deliveryStatus === "delivered"
    ? BOARD_STATUS_DELIVERED
    : BOARD_STATUS_NEW_ORDERS;
}

export function getInvoiceStatusForSubmittedPaymentMethod(
  paymentMethod: "pay_now" | "net_30",
): OrderInvoiceStatus {
  return paymentMethod === "net_30" ? "draft" : DEFAULT_INVOICE_STATUS;
}

export function getPaidAtForStatus(
  nextPaymentStatus: OrderPaymentStatus,
  existingPaidAt: string | null,
): string | null {
  if (nextPaymentStatus === "paid") {
    return existingPaidAt ?? new Date().toISOString();
  }

  return existingPaidAt;
}

export function getDeliveredAtForStatus(
  nextDeliveryStatus: OrderDeliveryStatus,
  existingDeliveredAt: string | null,
): string | null {
  if (nextDeliveryStatus === "delivered") {
    return existingDeliveredAt ?? new Date().toISOString();
  }

  if (nextDeliveryStatus === "returned") {
    return existingDeliveredAt;
  }

  return null;
}

export function parseCreateOrderInput(
  input: FormData | CreateOrderInput,
): CreateOrderInput {
  if (input instanceof FormData) {
    return createOrderSchema.parse({
      product_id: input.get("product_id"),
      quantity: input.get("quantity"),
      notes: input.has("notes") ? input.get("notes") : undefined,
    });
  }

  return createOrderSchema.parse(input);
}

export function parseEditOrderInput(
  input: FormData | EditOrderInput,
): EditOrderInput {
  if (input instanceof FormData) {
    return editOrderSchema.parse({
      id: input.get("id"),
      product_id: input.get("product_id"),
      quantity: input.get("quantity"),
    });
  }

  return editOrderSchema.parse(input);
}

export function parseSubmitOrderPaymentChoiceInput(
  input: FormData | SubmitOrderPaymentChoiceInput,
): SubmitOrderPaymentChoiceInput {
  if (input instanceof FormData) {
    return submitOrderPaymentChoiceSchema.parse({
      id: input.get("id"),
      payment_method: input.get("payment_method"),
    });
  }

  return submitOrderPaymentChoiceSchema.parse(input);
}

export function parseUpdateOrderStatusInput(
  input: FormData | UpdateOrderStatusInput,
): UpdateOrderStatusInput {
  const parsed =
    input instanceof FormData
      ? updateOrderStatusSchema.parse({
          id: input.get("id"),
          payment_status: input.get("payment_status") || undefined,
          invoice_status: input.get("invoice_status") || undefined,
          fulfillment_status: input.get("fulfillment_status") || undefined,
          delivery_status: input.get("delivery_status") || undefined,
          tracking_number: input.has("tracking_number")
            ? input.get("tracking_number")
            : undefined,
          notes: input.has("notes") ? input.get("notes") : undefined,
        })
      : updateOrderStatusSchema.parse(input);

  const hasAnyChanges =
    parsed.payment_status !== undefined ||
    parsed.invoice_status !== undefined ||
    parsed.fulfillment_status !== undefined ||
    parsed.delivery_status !== undefined ||
    parsed.tracking_number !== undefined ||
    parsed.notes !== undefined;

  if (!hasAnyChanges) {
    throw new Error("No order changes were provided.");
  }

  return parsed;
}

export function parseCancelOrderInput(
  input: FormData | CancelOrderInput,
): CancelOrderInput {
  if (input instanceof FormData) {
    return cancelOrderSchema.parse({
      id: input.get("id"),
      notes: input.has("notes") ? input.get("notes") : undefined,
    });
  }

  return cancelOrderSchema.parse(input);
}

export function mapDashboardOrder(row: RawOrderRecord): DashboardOrder {
  const facility = getSingleRelation(row.facilities);
  const product = getSingleRelation(row.products) as ProductRecord | null;

  const payments = sortPaymentsNewestFirst(row.payments);

  const latestPaidPayment =
    payments.find((payment) => payment.status === "paid") ?? null;

  const latestPendingPayment =
    payments.find((payment) => payment.status === "pending") ?? null;

  const latestRelevantPayment =
    latestPaidPayment ?? latestPendingPayment ?? payments[0] ?? null;

  return dashboardOrderSchema.parse({
    id: row.id,
    order_number: row.order_number,
    facility_id: row.facility_id,
    product_id: row.product_id,

    product_name: row.product_name,
    product_sku: row.product_sku,

    quantity: row.quantity,
    unit_price: row.unit_price,
    shipping_amount: row.shipping_amount,
    tax_amount: row.tax_amount,
    subtotal: row.subtotal,
    total_amount: row.total_amount,

    order_status: row.order_status,
    payment_method: row.payment_method,
    payment_status: latestRelevantPayment?.status ?? row.payment_status,
    invoice_status: row.invoice_status,
    fulfillment_status: row.fulfillment_status,
    delivery_status: row.delivery_status,

    tracking_number: toNullableString(row.tracking_number),
    notes: toNullableString(row.notes),

    placed_at: row.placed_at,
    paid_at: latestPaidPayment?.paid_at ?? row.paid_at,
    delivered_at: row.delivered_at,

    created_at: row.created_at,
    updated_at: row.updated_at,

    facility_name: facility?.name?.trim() || "Unknown Facility",
    facility_contact_name: toNullableString(facility?.contact),
    facility_email: null,
    facility_phone: toNullableString(facility?.phone),

    product_category: toNullableString(product?.category),

    board_status: getOrderBoardStatus(row.delivery_status),

    receipt_url: latestPaidPayment?.receipt_url ?? null,
    stripe_receipt_url: latestPaidPayment?.receipt_url ?? null,
    stripe_checkout_session_id:
      latestPendingPayment?.stripe_checkout_session_id ?? null,
    stripe_payment_intent_id:
      latestPaidPayment?.stripe_payment_intent_id ??
      latestPendingPayment?.stripe_payment_intent_id ??
      null,
    stripe_charge_id: latestPaidPayment?.stripe_charge_id ?? null,
  });
}

export function mapDashboardOrders(rows: RawOrderRecord[]): DashboardOrder[] {
  return rows.map(mapDashboardOrder);
}

export function getDefaultDraftStatuses() {
  return {
    payment_status: DEFAULT_PAYMENT_STATUS,
    invoice_status: DEFAULT_INVOICE_STATUS,
    fulfillment_status: DEFAULT_FULFILLMENT_STATUS,
    delivery_status: DEFAULT_DELIVERY_STATUS,
  };
}

export function hasInvoice(order: DashboardOrder): boolean {
  return order.invoice_status !== "not_applicable";
}

export function hasCompletedPayment(order: DashboardOrder): boolean {
  return (
    order.payment_status === "paid" ||
    order.payment_status === "refunded" ||
    order.payment_status === "partially_refunded"
  );
}

export function isCanceledOrder(order: DashboardOrder): boolean {
  return (
    order.order_status === "canceled" ||
    order.delivery_status === "canceled" ||
    order.fulfillment_status === "canceled" ||
    order.payment_status === "canceled"
  );
}

export function isFinanciallyLocked(order: DashboardOrder): boolean {
  return hasInvoice(order) || hasCompletedPayment(order);
}

export function canEditOrder(order: DashboardOrder): boolean {
  if (isCanceledOrder(order)) return false;
  if (isFinanciallyLocked(order)) return false;
  return true;
}

export function canDeleteOrder(order: DashboardOrder): boolean {
  if (isCanceledOrder(order)) return false;
  if (isFinanciallyLocked(order)) return false;
  return true;
}

export function canChoosePaymentMethod(order: DashboardOrder): boolean {
  return order.order_status === "draft" && !isCanceledOrder(order);
}

export function canUpdateOrderWorkflow(order: DashboardOrder): boolean {
  if (isCanceledOrder(order)) return false;
  return true;
}

export function canCancelOrder(order: DashboardOrder): boolean {
  if (isCanceledOrder(order)) return false;
  return true;
}

export function getOrderLockReason(order: DashboardOrder): string | null {
  if (isCanceledOrder(order)) {
    return "This order has been canceled and is now read-only.";
  }

  if (hasCompletedPayment(order) && hasInvoice(order)) {
    return "This order is locked because payment has been completed and an invoice already exists.";
  }

  if (hasCompletedPayment(order)) {
    return "This order is locked because payment has already been completed.";
  }

  if (hasInvoice(order)) {
    return "This order is locked because an invoice has already been created.";
  }

  return null;
}
