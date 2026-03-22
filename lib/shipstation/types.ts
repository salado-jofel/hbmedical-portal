export type ShipStationShipmentInput = {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerPhone?: string | null;
  address1: string;
  city: string;
  state: string;
  postalCode: string;
  countryCode: string;
  productName: string;
  quantity: number;
  unitPrice: number;
};

export type ShipStationShipmentResult = {
  ok: boolean;
  shipmentId?: string;
  raw: unknown;
};

export type ShipStationFulfillmentInput = {
  shipmentId: string;
  trackingNumber: string;
  carrierCode: string;
};

export type ShipStationFulfillmentResult = {
  ok: boolean;
  fulfillmentId?: string;
  raw: unknown;
};

export interface ShipStationService {
  createShipment(
    input: ShipStationShipmentInput,
  ): Promise<ShipStationShipmentResult>;

  createFulfillment(
    input: ShipStationFulfillmentInput,
  ): Promise<ShipStationFulfillmentResult>;
}
