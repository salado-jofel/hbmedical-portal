import type {
  ShipStationClient,
  ShipStationLabelInput,
  ShipStationLabelResult,
  ShipStationOrderInput,
  ShipStationOrderResult,
} from "./types";

function shortId(value: string) {
  return value.replace(/-/g, "").slice(0, 8).toUpperCase();
}

function mockTrackingNumber() {
  const stamp = Date.now().toString().slice(-10);
  const rand = Math.floor(10 + Math.random() * 89).toString();
  return `9400${stamp}${rand}`;
}

async function sleep(ms = 350) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export const mockShipStationClient: ShipStationClient = {
  async syncOrder(
    input: ShipStationOrderInput,
  ): Promise<ShipStationOrderResult> {
    await sleep();

    const short = shortId(input.localOrderId);

    return {
      externalOrderId: `mock-ss-order-${short}`,
      orderKey: `mock-ss-key-${short}`,
      status: "awaiting_shipment",
    };
  },

  async purchaseLabel(
    input: ShipStationLabelInput,
  ): Promise<ShipStationLabelResult> {
    await sleep();

    const short = shortId(input.localOrderId);

    return {
      shipmentId: `mock-ss-shipment-${short}`,
      trackingNumber: mockTrackingNumber(),
      carrierCode: "mock-usps",
      serviceCode: "mock-priority",
      labelUrl: `/api/dev/shipstation/label/${short}?orderNumber=${encodeURIComponent(
        input.orderNumber,
      )}`,
      status: "label_purchased_mock",
    };
  },
};
