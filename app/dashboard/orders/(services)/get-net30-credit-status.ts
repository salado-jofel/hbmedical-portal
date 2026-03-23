"use server";

import {
  getNet30CreditStatusByUserId,
  type Net30CreditStatus,
} from "@/lib/billing/net30";

export async function getNet30CreditStatus(
  userId: string,
): Promise<Net30CreditStatus> {
  if (!userId) {
    return {
      blocked: false,
      reason: null,
      outstandingBalance: 0,
      overdueBalance: 0,
      activeInvoiceCount: 0,
      overdueInvoiceCount: 0,
      creditLimit: 50000,
    };
  }

  return getNet30CreditStatusByUserId(userId);
}
