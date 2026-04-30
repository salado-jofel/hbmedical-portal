import type {
  ShipStationClient,
  ShipStationLabelInput,
  ShipStationLabelResult,
  ShipStationOrderInput,
  ShipStationOrderResult,
} from "./types";

const SHIPSTATION_BASE_URL = "https://ssapi.shipstation.com";
const SHIPSTATION_CREATE_ORDER_ENDPOINT = "/orders/createorder";
const DEFAULT_COUNTRY = "US";
const DEFAULT_ORDER_STATUS = "awaiting_shipment";

type ExtendedShipStationOrderInput = ShipStationOrderInput & {
  facilityContact?: string | null;
  facilityLocation?: string | null;
  receiptEmail?: string | null;
  paymentMode?: "pay_now" | "net_30" | null;
  paymentStatus?:
    | "paid"
    | "invoice_sent"
    | "overdue"
    | "payment_failed"
    | "unpaid"
    | null;
  existingShipStationOrderKey?: string | null;
  existingShipStationOrderId?: string | null;
};

type ShipStationAddress = {
  name: string;
  company: string;
  street1: string;
  street2: string | null;
  street3: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string | null;
  residential: boolean;
};

type ShipStationCreateOrUpdateOrderResponse = {
  orderId?: string | number | null;
  orderNumber?: string | null;
  orderKey?: string | null;
  orderStatus?: string | null;
};

const US_STATE_ABBREVIATIONS: Record<string, string> = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY",
  "district of columbia": "DC",
};

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getShipStationAuthHeader(): string {
  const apiKey = getRequiredEnv("SHIPSTATION_API_KEY");
  const apiSecret = getRequiredEnv("SHIPSTATION_API_SECRET");

  const encoded = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
  return `Basic ${encoded}`;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function toNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

function resolveStateCode(state: string, country: string): string {
  const s = state.trim();
  if (country.toUpperCase() !== "US") return s; // PH or others use full names or specific codes
  if (s.length === 2) return s.toUpperCase();
  // Add mapping here if needed, otherwise return as is
  return s;
}

function resolveStateAbbreviation(input: string): string {
  const normalized = normalizeWhitespace(input).toLowerCase();

  if (!normalized) {
    throw new Error("State is required for ShipStation sync.");
  }

  if (/^[A-Za-z]{2}$/.test(normalized)) {
    return normalized.toUpperCase();
  }

  const mapped = US_STATE_ABBREVIATIONS[normalized];
  if (mapped) return mapped;

  throw new Error(
    `Unable to parse state "${input}" for ShipStation sync. Please use a 2-letter state code or full US state name.`,
  );
}

function normalizeCountry(country?: string | null): string {
  const c = (country || DEFAULT_COUNTRY).trim().toUpperCase();
  if (c === "USA" || c === "UNITED STATES") return "US";
  if (c === "PHILIPPINES") return "PH";
  return c;
}

function parseStateAndPostal(value: string): {
  state: string;
  postalCode: string;
} {
  const normalized = normalizeWhitespace(value);

  let match = normalized.match(/^([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/);
  if (match) {
    return {
      state: match[1].toUpperCase(),
      postalCode: match[2],
    };
  }

  match = normalized.match(/^(.+?)\s+(\d{5}(?:-\d{4})?)$/);
  if (match) {
    return {
      state: resolveStateAbbreviation(match[1]),
      postalCode: match[2],
    };
  }

  throw new Error(
    `Unable to parse state/postal code from "${value}". Expected format like "CA 90210" or "California 90210".`,
  );
}

function tryParseJsonAddress(
  location: string,
): Partial<ShipStationAddress> | null {
  const trimmed = location.trim();

  if (!trimmed.startsWith("{")) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;

    const street1 =
      toNullableString(parsed.street1) ??
      toNullableString(parsed.address1) ??
      toNullableString(parsed.line1);

    const city = toNullableString(parsed.city);
    const postalCode =
      toNullableString(parsed.postalCode) ??
      toNullableString(parsed.postal_code) ??
      toNullableString(parsed.zip) ??
      toNullableString(parsed.zipCode);
    const stateRaw =
      toNullableString(parsed.state) ?? toNullableString(parsed.region);
    const countryRaw = toNullableString(parsed.country);
    const street2 =
      toNullableString(parsed.street2) ??
      toNullableString(parsed.address2) ??
      toNullableString(parsed.line2);
    const street3 =
      toNullableString(parsed.street3) ?? toNullableString(parsed.line3);

    if (!street1 || !city || !stateRaw || !postalCode) {
      return null;
    }

    return {
      street1,
      street2: street2 ?? null,
      street3: street3 ?? null,
      city,
      state: resolveStateAbbreviation(stateRaw),
      postalCode,
      country: normalizeCountry(countryRaw),
    };
  } catch {
    return null;
  }
}

function parseDelimitedAddress(location: string): Partial<ShipStationAddress> {
  const singleLine = location
    .split(/\r?\n/g)
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");

  const parts = singleLine
    .split(",")
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean);

  if (parts.length < 3) {
    throw new Error(
      'Facility location is incomplete for ShipStation sync. Expected something like "123 Main St, Springfield, IL 62704" or JSON with street1/city/state/postalCode.',
    );
  }

  let street1: string;
  let street2: string | null = null;
  let city: string;
  let statePostal: string;
  let country: string | null = null;

  if (parts.length >= 5) {
    street1 = parts[0];
    street2 = parts[1];
    city = parts[2];
    statePostal = parts[3];
    country = parts[4];
  } else if (parts.length === 4) {
    const thirdLooksLikeStatePostal =
      /^([A-Za-z]{2}|[A-Za-z ]+)\s+\d{5}(?:-\d{4})?$/.test(parts[2]);

    if (thirdLooksLikeStatePostal) {
      street1 = parts[0];
      city = parts[1];
      statePostal = parts[2];
      country = parts[3];
    } else {
      street1 = parts[0];
      street2 = parts[1];
      city = parts[2];
      statePostal = parts[3];
    }
  } else {
    street1 = parts[0];
    city = parts[1];
    statePostal = parts[2];
  }

  const { state, postalCode } = parseStateAndPostal(statePostal);

  return {
    street1,
    street2,
    street3: null,
    city,
    state,
    postalCode,
    country: normalizeCountry(country),
  };
}

function buildShipStationAddress(
  input: ShipStationOrderInput,
): ShipStationAddress {
  return {
    name: input.facilityContact ?? input.facilityName,
    company: input.facilityName,
    street1: input.address_line_1,
    street2: input.address_line_2 ?? null,
    street3: null,
    city: input.city,
    state: resolveStateCode(input.state, input.country),
    postalCode: input.postal_code,
    country: normalizeCountry(input.country),
    phone: input.recipientPhone ?? null,
    residential: false,
  };
}

function toShipStationDateTime(input: string): string {
  const date = new Date(input);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date provided for ShipStation sync: ${input}`);
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const lookup = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return `${lookup.year}-${lookup.month}-${lookup.day} ${lookup.hour}:${lookup.minute}:${lookup.second}`;
}

function getAmountPaid(input: ExtendedShipStationOrderInput): number {
  if (input.paymentStatus === "paid") {
    return roundMoney(Number(input.amount ?? 0));
  }

  return 0;
}

function getUnitPrice(input: ExtendedShipStationOrderInput): number {
  const amount = Number(input.amount ?? 0);
  const quantity = Math.max(1, Number(input.quantity ?? 1));
  return roundMoney(amount / quantity);
}

function buildCreateOrUpdateOrderPayload(input: ShipStationOrderInput) {
  const shipTo = buildShipStationAddress(input);
  const billTo = { ...shipTo };

  return {
    orderNumber: input.orderNumber,
    ...(input.existingShipStationOrderKey
      ? { orderKey: input.existingShipStationOrderKey }
      : {}),
    orderDate: new Date(input.createdAt).toISOString(),
    orderStatus: DEFAULT_ORDER_STATUS,
    paymentMethod: input.paymentMode === "net_30" ? "Net 30 Invoice" : "Stripe",
    amountPaid: input.paymentStatus === "paid" ? input.amount : 0,
    customerEmail: input.receiptEmail ?? null,
    billTo,
    shipTo,
    items: [
      {
        lineItemKey: input.localOrderId,
        sku: input.productName,
        name: input.productName,
        quantity: Math.max(1, input.quantity),
        unitPrice: input.amount / Math.max(1, input.quantity),
      },
    ],
    advancedOptions: {
      customField1: input.localOrderId,
      source: "Meridian Portal",
    },
  };
}

function safeJsonParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function buildShipStationErrorMessage(
  status: number,
  bodyText: string,
  rateLimitReset: string | null,
): string {
  const parsed = safeJsonParse<{ message?: string }>(bodyText);
  const apiMessage =
    parsed?.message && parsed.message.trim().length > 0
      ? parsed.message.trim()
      : null;

  if (status === 401) {
    return (
      apiMessage ?? "ShipStation authentication failed. Check API key/secret."
    );
  }

  if (status === 402) {
    return (
      apiMessage ??
      "ShipStation API access is unavailable for this account or plan. Verify the trial/plan includes API access."
    );
  }

  if (status === 429) {
    const retryText = rateLimitReset
      ? ` Retry after ${rateLimitReset} seconds.`
      : "";
    return (apiMessage ?? "ShipStation rate limit reached.") + retryText;
  }

  if (status >= 500) {
    return apiMessage ?? "ShipStation server error. Please try again later.";
  }

  return apiMessage ?? `ShipStation request failed with status ${status}.`;
}

export async function createOrUpdateOrder(
  rawInput: ShipStationOrderInput,
): Promise<ShipStationCreateOrUpdateOrderResponse> {
  const input = rawInput as ExtendedShipStationOrderInput;

  const payload = buildCreateOrUpdateOrderPayload(input);

  const response = await fetch(
    `${SHIPSTATION_BASE_URL}${SHIPSTATION_CREATE_ORDER_ENDPOINT}`,
    {
      method: "POST",
      headers: {
        Authorization: getShipStationAuthHeader(),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    },
  );

  const bodyText = await response.text();

  if (!response.ok) {
    const message = buildShipStationErrorMessage(
      response.status,
      bodyText,
      response.headers.get("X-Rate-Limit-Reset"),
    );

    throw new Error(message);
  }

  const parsed =
    safeJsonParse<ShipStationCreateOrUpdateOrderResponse>(bodyText);

  if (!parsed || typeof parsed !== "object") {
    throw new Error("ShipStation returned an invalid JSON response.");
  }

  return parsed;
}

export const productionShipStationClient: ShipStationClient = {
  async syncOrder(
    input: ShipStationOrderInput,
  ): Promise<ShipStationOrderResult> {
    const apiKey = process.env.SHIPSTATION_API_KEY;
    const apiSecret = process.env.SHIPSTATION_API_SECRET;
    const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");

    const response = await fetch(
      `${SHIPSTATION_BASE_URL}${SHIPSTATION_CREATE_ORDER_ENDPOINT}`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildCreateOrUpdateOrderPayload(input)),
      },
    );

    const result = await response.json();
    if (!response.ok)
      throw new Error(result.message || "ShipStation sync failed");

    return {
      externalOrderId: String(result.orderId),
      orderKey: result.orderKey || null,
      status: result.orderStatus || DEFAULT_ORDER_STATUS,
    };
  },

  async purchaseLabel() {
    throw new Error("Label purchase not implemented in real client yet.");
  },
};
