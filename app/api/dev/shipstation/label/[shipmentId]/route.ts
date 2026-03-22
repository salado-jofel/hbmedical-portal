import { NextRequest } from "next/server";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ shipmentId: string }> },
) {
  const { shipmentId } = await context.params;
  const orderNumber =
    request.nextUrl.searchParams.get("orderNumber") ?? "Unknown";

  const content = `
Mock ShipStation Label
=====================
Shipment ID: ${shipmentId}
Order Number: ${orderNumber}
Mode: Development / Mock
Carrier: mock-usps
Service: mock-priority

This is not a real shipping label.
No postage was purchased.
No production ShipStation API was used.
`.trim();

  return new Response(content, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `inline; filename="mock-label-${shipmentId}.txt"`,
    },
  });
}
