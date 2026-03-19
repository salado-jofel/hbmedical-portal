"use server";

import { getValidQBClient } from "@/utils/quickbooks/client";

// ── Shared helper ─────────────────────────────────────────────────────────────
function getQBBaseUrl() {
  return process.env.QB_ENVIRONMENT === "production"
    ? "https://quickbooks.api.intuit.com"
    : "https://sandbox-quickbooks.api.intuit.com";
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface QBInvoiceLine {
  Amount: number;
  DetailType: "SalesItemLineDetail";
  SalesItemLineDetail: {
    ItemRef: { value: string; name?: string };
    UnitPrice: number;
    Qty: number;
  };
}

interface QBInvoice {
  Id?: string;
  SyncToken?: string;
  DocNumber?: string;
  CustomerRef: { value: string; name?: string };
  Line: QBInvoiceLine[];
  PrivateNote?: string;
}

interface QBInvoiceResponse {
  Invoice: QBInvoice & { Id: string; SyncToken: string };
}

// ── Create QB Invoice — throws on failure ─────────────────────────────────────
export async function createQBInvoiceFromData(params: {
  orderDocNumber: string;
  qbCustomerId: string;
  facilityName: string;
  qbItemId: string;
  productName: string;
  amount: number;
}): Promise<string> {
  const client = await getValidQBClient();
  const token = client.getToken();

  const payload: QBInvoice = {
    DocNumber: params.orderDocNumber,
    CustomerRef: { value: params.qbCustomerId, name: params.facilityName },
    Line: [
      {
        Amount: params.amount,
        DetailType: "SalesItemLineDetail",
        SalesItemLineDetail: {
          ItemRef: { value: params.qbItemId, name: params.productName },
          UnitPrice: params.amount,
          Qty: 1,
        },
      },
    ],
    PrivateNote: `Order ${params.orderDocNumber} from HB Medical Dashboard`,
  };

  const response = await fetch(
    `${getQBBaseUrl()}/v3/company/${token.realmId}/invoice`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    const errText = await response.text();
    console.error("[createQBInvoiceFromData] QB error:", errText);
    throw new Error(`Failed to create QuickBooks invoice (${response.status})`);
  }

  const json = (await response.json()) as QBInvoiceResponse;

  if (!json?.Invoice?.Id) {
    throw new Error("[createQBInvoiceFromData] QB returned no Invoice ID.");
  }

  return json.Invoice.Id;
}

// ── Void QB Invoice — throws on failure ───────────────────────────────────────
export async function voidQuickBooksInvoice(
  qbInvoiceId: string,
): Promise<{ success: boolean; message: string }> {
  try {
    const client = await getValidQBClient();
    const token = client.getToken();
    const baseUrl = getQBBaseUrl();

    // ── Step 1: Fetch invoice to get current SyncToken ────────────────────
    const getResponse = await fetch(
      `${baseUrl}/v3/company/${token.realmId}/invoice/${qbInvoiceId}`,
      {
        headers: {
          Authorization: `Bearer ${token.access_token}`,
          Accept: "application/json",
        },
      },
    );

    if (!getResponse.ok) {
      return { success: false, message: "Failed to fetch QB invoice" };
    }

    const getJson = (await getResponse.json()) as QBInvoiceResponse;

    if (!getJson?.Invoice?.SyncToken) {
      return { success: false, message: "QB invoice missing SyncToken" };
    }

    // ── Step 2: Void it ───────────────────────────────────────────────────
    const voidResponse = await fetch(
      `${baseUrl}/v3/company/${token.realmId}/invoice?operation=void&minorversion=65`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token.access_token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          Id: qbInvoiceId,
          SyncToken: getJson.Invoice.SyncToken,
        }),
      },
    );

    if (!voidResponse.ok) {
      const errText = await voidResponse.text();
      console.error("[voidQuickBooksInvoice] QB error:", errText);
      return { success: false, message: "Failed to void QB invoice" };
    }

    return { success: true, message: "Invoice voided in QuickBooks" };
  } catch (err) {
    console.error("[voidQuickBooksInvoice] Unexpected error:", err);
    return {
      success: false,
      message: err instanceof Error ? err.message : "Unexpected error",
    };
  }
}
