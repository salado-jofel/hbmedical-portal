import { z } from "zod";
import {
  uuidSchema,
  nullableStringSchema,
  shipmentStatusSchema,
  nullableTimestampSchema,
  timestampSchema,
} from "./commerce";

export interface ShipmentRow {
  id: string;
  order_id: string;
  carrier: string | null;
  service_level: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  shipstation_order_id: string | null;
  shipstation_shipment_id: string | null;
  status:
    | "pending"
    | "label_created"
    | "in_transit"
    | "delivered"
    | "returned"
    | "exception"
    | "canceled";
  shipped_at: string | null;
  estimated_delivery_at: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Shipment extends ShipmentRow {}

export const shipmentSchema = z.object({
  id: uuidSchema,
  order_id: uuidSchema,
  carrier: nullableStringSchema,
  service_level: nullableStringSchema,
  tracking_number: nullableStringSchema,
  tracking_url: nullableStringSchema,
  shipstation_order_id: nullableStringSchema,
  shipstation_shipment_id: nullableStringSchema,
  status: shipmentStatusSchema,
  shipped_at: nullableTimestampSchema,
  estimated_delivery_at: nullableTimestampSchema,
  delivered_at: nullableTimestampSchema,
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

export const createShipmentSchema = z.object({
  order_id: uuidSchema,
  carrier: nullableStringSchema.optional(),
  service_level: nullableStringSchema.optional(),
  tracking_number: nullableStringSchema.optional(),
  tracking_url: nullableStringSchema.optional(),
  shipstation_order_id: nullableStringSchema.optional(),
  shipstation_shipment_id: nullableStringSchema.optional(),
  status: shipmentStatusSchema.optional(),
  shipped_at: nullableTimestampSchema.optional(),
  estimated_delivery_at: nullableTimestampSchema.optional(),
  delivered_at: nullableTimestampSchema.optional(),
});

export const updateShipmentSchema = createShipmentSchema.partial();

export type ShipmentInput = z.infer<typeof createShipmentSchema>;
export type ShipmentUpdateInput = z.infer<typeof updateShipmentSchema>;
