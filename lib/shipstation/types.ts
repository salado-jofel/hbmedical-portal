export type ShipStationMode = "mock" | "production";

export type ShipStationPaymentMode = "pay_now" | "net_30";

export type ShipStationPaymentStatus =
  | "unpaid"
  | "invoice_sent"
  | "paid"
  | "overdue"
  | "payment_failed";

export type ShipStationOrderInput = {
  localOrderId: string;
  orderNumber: string;
  createdAt: string;
  amount: number;
  quantity: number;
  facilityId: string;
  facilityName: string;
  // Individual address fields instead of facilityLocation string
  address_line_1: string;
  address_line_2?: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  facilityContact?: string | null;
  recipientPhone?: string | null;
  receiptEmail?: string | null;
  productName: string;
  paymentMode?: ShipStationPaymentMode | null;
  paymentStatus?: ShipStationPaymentStatus | null;
  existingShipStationOrderKey?: string | null;
  existingShipStationOrderId?: string | null;
};

export type ShipStationOrderResult = {
  externalOrderId: string;
  orderKey: string | null;
  status: string;
};

export type ShipStationLabelInput = {
  localOrderId: string;
  orderNumber: string;
  amount: number;
  quantity: number;
  facilityId: string;
  facilityName: string;
  productName: string;
};

export type ShipStationLabelResult = {
  shipmentId: string;
  trackingNumber: string;
  carrierCode: string;
  serviceCode: string;
  labelUrl: string | null;
  status: string;
};

export interface ShipStationClient {
  syncOrder(input: ShipStationOrderInput): Promise<ShipStationOrderResult>;
  purchaseLabel(input: ShipStationLabelInput): Promise<ShipStationLabelResult>;
}
