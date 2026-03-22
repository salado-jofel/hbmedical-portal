import {
  ShipStationService,
  ShipStationShipmentInput,
  ShipStationShipmentResult,
  ShipStationFulfillmentInput,
  ShipStationFulfillmentResult,
} from "./types";

export class MockShipStationService implements ShipStationService {
  async createShipment(
    input: ShipStationShipmentInput,
  ): Promise<ShipStationShipmentResult> {
    const shipmentId = `mock_shipment_${Date.now()}`;

    return {
      ok: true,
      shipmentId,
      raw: {
        mode: "mock",
        action: "createShipment",
        shipment_id: shipmentId,
        create_sales_order: true,
        input,
      },
    };
  }

  async createFulfillment(
    input: ShipStationFulfillmentInput,
  ): Promise<ShipStationFulfillmentResult> {
    const fulfillmentId = `mock_fulfillment_${Date.now()}`;

    return {
      ok: true,
      fulfillmentId,
      raw: {
        mode: "mock",
        action: "createFulfillment",
        fulfillment_id: fulfillmentId,
        input,
      },
    };
  }
}
