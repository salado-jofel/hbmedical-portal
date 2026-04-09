"use client";

import toast from "react-hot-toast";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PillBadge } from "@/app/(components)/PillBadge";
import { formatAmount } from "@/utils/helpers/formatter";

const LEDGER = [
  { rep: "Rachel Kim",     order: "HB-2604-1", saleAmt: 18400, rate: 5,   commission: 920,  override: 368, yourCut: 368, status: "paid"    },
  { rep: "Devon Patel",    order: "HB-2604-2", saleAmt: 14200, rate: 5,   commission: 710,  override: 284, yourCut: 284, status: "paid"    },
  { rep: "Sarah Mitchell", order: "HB-2604-3", saleAmt: 22000, rate: 4,   commission: 880,  override: 440, yourCut: 440, status: "paid"    },
  { rep: "James Ochoa",    order: "HB-2604-4", saleAmt: 17800, rate: 4,   commission: 712,  override: 356, yourCut: 356, status: "paid"    },
  { rep: "Rachel Kim",     order: "HB-2604-5", saleAmt: 9800,  rate: 5,   commission: 490,  override: 196, yourCut: 196, status: "paid"    },
  { rep: "Tanya Brooks",   order: "HB-2604-6", saleAmt: 12500, rate: 4,   commission: 500,  override: 250, yourCut: 250, status: "pending" },
  { rep: "Devon Patel",    order: "HB-2604-7", saleAmt: 31000, rate: 5,   commission: 1550, override: 620, yourCut: 620, status: "paid"    },
  { rep: "Sarah Mitchell", order: "HB-2604-8", saleAmt: 8700,  rate: 4,   commission: 348,  override: 174, yourCut: 174, status: "paid"    },
];

export default function CommissionLedger() {
  return (
    <div className="overflow-hidden rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-[0.8rem]">
        <div>
          <p className="text-[13px] font-semibold text-[var(--navy)]">Commission Ledger</p>
          <p className="mt-[1px] text-[11px] text-[var(--text3)]">All earned commissions this period</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-[12px]"
          onClick={() => toast("Coming soon", { icon: "⏳" })}
        >
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--bg)]">
              {["Rep", "Order #", "Sale Amt", "Rate", "Commission", "Override", "Your Cut", "Status"].map((h) => (
                <th
                  key={h}
                  className="px-4 py-[9px] text-[10px] font-semibold uppercase tracking-[0.6px] text-[var(--text3)]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {LEDGER.map((row, i) => (
              <tr
                key={i}
                className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg)]"
              >
                <td className="px-4 py-[10px] text-[13px] font-medium text-[var(--navy)]">
                  {row.rep}
                </td>
                <td
                  className="px-4 py-[10px] text-[13px]"
                  style={{ fontFamily: "var(--font-dm-mono), monospace" }}
                >
                  {row.order}
                </td>
                <td className="px-4 py-[10px] text-[13px]">{formatAmount(row.saleAmt)}</td>
                <td className="px-4 py-[10px] text-[13px]">{row.rate}%</td>
                <td
                  className="px-4 py-[10px] text-[13px] font-medium text-[var(--teal)]"
                  style={{ fontFamily: "var(--font-dm-mono), monospace" }}
                >
                  {formatAmount(row.commission)}
                </td>
                <td className="px-4 py-[10px] text-[13px]">{formatAmount(row.override)}</td>
                <td
                  className="px-4 py-[10px] text-[13px] font-semibold text-[var(--navy)]"
                  style={{ fontFamily: "var(--font-dm-mono), monospace" }}
                >
                  {formatAmount(row.yourCut)}
                </td>
                <td className="px-4 py-[10px]">
                  <PillBadge
                    label={row.status === "paid" ? "Paid" : "Pending"}
                    variant={row.status === "paid" ? "green" : "gold"}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
