import type {
  ShipStationClient,
  ShipStationLabelInput,
  ShipStationLabelResult,
  ShipStationOrderInput,
  ShipStationOrderResult,
} from "./types";

export const productionShipStationClient: ShipStationClient = {
  async syncOrder(
    _input: ShipStationOrderInput,
  ): Promise<ShipStationOrderResult> {
    throw new Error(
      "ShipStation production mode is not enabled yet. Current safe mode is mock.",
    );
  },

  async purchaseLabel(
    _input: ShipStationLabelInput,
  ): Promise<ShipStationLabelResult> {
    throw new Error(
      "ShipStation production mode is not enabled yet. Current safe mode is mock.",
    );
  },
};
