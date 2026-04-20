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
  OrderBoardStatus,
  OrderDeliveryStatus,
  OrderInvoiceStatus,
  OrderPaymentStatus,
  OrderStatus,
  RawOrderRecord,
  UpdateOrderStatusInput,
  updateOrderStatusSchema,
  mapOrder,
  mapOrders,
} from "../interfaces/orders";

export function getDisplayOrderStatus(
  order: Pick<DashboardOrder, "order_status" | "payment_method">,
): OrderStatus | "processed" {
  return order.order_status === "approved" && order.payment_method
    ? "processed"
    : order.order_status;
}

export { mapOrder as mapDashboardOrder, mapOrders as mapDashboardOrders };

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
  return `HBM-${year}${month}${day}-${random}`;
}

export function getSingleRelation<T>(
  value: T | T[] | null,
): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
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
      patient_id: input.get("patient_id"),
      wound_type: input.get("wound_type"),
      date_of_service: input.get("date_of_service"),
      notes: input.has("notes") ? input.get("notes") : undefined,
      assigned_provider_id: input.get("assigned_provider_id") || undefined,
      items: JSON.parse((input.get("items") as string) ?? "[]"),
    });
  }
  return createOrderSchema.parse(input);
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

export function parseUpdateOrderStatusInput(
  input: FormData | UpdateOrderStatusInput,
): UpdateOrderStatusInput {
  if (input instanceof FormData) {
    return updateOrderStatusSchema.parse({
      id: input.get("id"),
      payment_status: input.get("payment_status") || undefined,
      invoice_status: input.get("invoice_status") || undefined,
      fulfillment_status: input.get("fulfillment_status") || undefined,
      delivery_status: input.get("delivery_status") || undefined,
      tracking_number: input.has("tracking_number")
        ? input.get("tracking_number")
        : undefined,
      notes: input.has("notes") ? input.get("notes") : undefined,
    });
  }
  return updateOrderStatusSchema.parse(input);
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
  return order.order_status === "canceled";
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
  return order.order_status === "draft";
}

export function canChoosePaymentMethod(order: DashboardOrder): boolean {
  return order.order_status === "approved" && !isCanceledOrder(order);
}

export function canUpdateOrderWorkflow(order: DashboardOrder): boolean {
  return !isCanceledOrder(order);
}

export function canCancelOrder(order: DashboardOrder): boolean {
  return !isCanceledOrder(order);
}

export function getOrderLockReason(order: DashboardOrder): string | null {
  if (isCanceledOrder(order)) {
    return "This order has been canceled and is now read-only.";
  }
  if (order.order_status !== "draft") {
    return "Only draft orders can be edited or deleted.";
  }
  return null;
}
