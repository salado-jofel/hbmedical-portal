import { mockShipStationClient } from "./mock";
import { productionShipStationClient } from "./real";
import type { ShipStationClient } from "./types";

export function getShipStationClient(): ShipStationClient {
  const mode = process.env.SHIPSTATION_MODE?.toLowerCase();

  if (mode === "production") {
    return productionShipStationClient;
  }

  return mockShipStationClient;
}
