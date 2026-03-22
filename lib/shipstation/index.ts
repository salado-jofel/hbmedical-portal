import { MockShipStationService } from "./mock";
import { RealShipStationService } from "./real";
import { ShipStationService } from "./types";

export function getShipStationService(): ShipStationService {
  if (process.env.USE_MOCK_SHIPSTATION === "true") {
    return new MockShipStationService();
  }

  return new RealShipStationService();
}
