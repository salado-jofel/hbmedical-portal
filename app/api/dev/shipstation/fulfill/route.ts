import { markOrderDeliveredViaShipStation } from "@/lib/actions/shipstation";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { orderId } = await req.json();

    if (!orderId) {
      return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
    }

    const result = await markOrderDeliveredViaShipStation(orderId);

    return NextResponse.json({ success: true, result });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
