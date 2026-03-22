import {
  ShipStationService,
  ShipStationShipmentInput,
  ShipStationShipmentResult,
  ShipStationFulfillmentInput,
  ShipStationFulfillmentResult,
} from "./types";

const API_BASE =
  process.env.SHIPSTATION_API_BASE_URL || "https://api.shipstation.com";

const API_KEY = process.env.SHIPSTATION_API_KEY;

async function shipstationFetch(path: string, init?: RequestInit) {
  if (!API_KEY) {
    throw new Error("Missing SHIPSTATION_API_KEY");
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "API-Key": API_KEY,
      ...(init?.headers || {}),
    },
  });

  const text = await res.text();
  let data: unknown = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    throw new Error(
      `ShipStation API error ${res.status}: ${JSON.stringify(data)}`,
    );
  }

  return data;
}

export class RealShipStationService implements ShipStationService {
  async createShipment(
    input: ShipStationShipmentInput,
  ): Promise<ShipStationShipmentResult> {
    const payload = {
      shipments: [
        {
          external_shipment_id: input.orderId,
          shipment_number: input.orderNumber,
          create_sales_order: true,
          ship_to: {
            name: input.customerName,
            phone: input.customerPhone ?? "",
            address_line1: input.address1,
            city_locality: input.city,
            state_province: input.state,
            postal_code: input.postalCode,
            country_code: input.countryCode,
            address_residential_indicator: "unknown",
          },
          items: [
            {
              name: input.productName,
              quantity: input.quantity,
              unit_price: input.unitPrice,
            },
          ],
        },
      ],
    };

    const raw = await shipstationFetch("/v2/shipments", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const shipmentId =
      (raw as any)?.shipments?.[0]?.shipment_id ||
      (raw as any)?.shipment_id ||
      undefined;

    return {
      ok: true,
      shipmentId,
      raw,
    };
  }

  async createFulfillment(
    input: ShipStationFulfillmentInput,
  ): Promise<ShipStationFulfillmentResult> {
    const payload = {
      fulfillments: [
        {
          shipment_id: input.shipmentId,
          tracking_number: input.trackingNumber,
          carrier_code: input.carrierCode,
          ship_date: new Date().toISOString(),
          notify_customer: true,
          notify_order_source: true,
        },
      ],
    };

    const raw = await shipstationFetch("/v2/fulfillments", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const fulfillmentId =
      (raw as any)?.fulfillments?.[0]?.fulfillment_id ||
      (raw as any)?.fulfillment_id ||
      undefined;

    return {
      ok: true,
      fulfillmentId,
      raw,
    };
  }
}
