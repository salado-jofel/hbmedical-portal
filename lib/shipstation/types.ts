export type ShipStationMode = "mock" | "production";

export type ShipStationOrderInput = {
  localOrderId: string;
  orderNumber: string;
  createdAt: string;
  amount: number;
  quantity: number;
  facilityId: string;
  facilityName: string;
  recipientPhone?: string | null;
  productName: string;
};

export type ShipStationOrderResult = {
  externalOrderId: string;
  orderKey: string;
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
