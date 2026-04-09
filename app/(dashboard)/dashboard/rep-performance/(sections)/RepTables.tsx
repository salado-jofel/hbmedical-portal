"use client";

import { PillBadge } from "@/app/(components)/PillBadge";
import { formatAmount } from "@/utils/helpers/formatter";

const MY_SALES = [
  { order: "HB-2604-1", client: "Mass General Brigham",   amount: 18400, status: "completed" },
  { order: "HB-2604-5", client: "Boston Children's",      amount: 9800,  status: "completed" },
  { order: "HB-2604-9", client: "Lahey Hospital",         amount: 14200, status: "completed" },
  { order: "HB-2604-11",client: "Mass Eye and Ear",       amount: 6800,  status: "pending"   },
];

const MY_CLIENTS = [
  { name: "Mass General Brigham",  category: "Hospital",    purchases: 185000 },
  { name: "Boston Children's",     category: "Hospital",    purchases: 92000  },
  { name: "Lahey Hospital",        category: "Hospital",    purchases: 41000  },
  { name: "Mass Eye and Ear",      category: "Specialty",   purchases: 28000  },
];

export default function RepTables() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* My Recent Sales */}
      <div className="overflow-hidden rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)]">
        <div className="border-b border-[var(--border)] px-4 py-[0.8rem]">
          <p className="text-[13px] font-semibold text-[var(--navy)]">My Recent Sales</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--bg)]">
                {["Order", "Client", "Amount", "Status"].map((h) => (
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
              {MY_SALES.map((row) => (
                <tr
                  key={row.order}
                  className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg)]"
                >
                  <td
                    className="px-4 py-[10px] text-[13px] font-medium text-[var(--navy)]"
                    style={{ fontFamily: "var(--font-dm-mono), monospace" }}
                  >
                    {row.order}
                  </td>
                  <td className="px-4 py-[10px] text-[13px] text-[var(--text)]">{row.client}</td>
                  <td
                    className="px-4 py-[10px] text-[13px]"
                    style={{ fontFamily: "var(--font-dm-mono), monospace" }}
                  >
                    {formatAmount(row.amount)}
                  </td>
                  <td className="px-4 py-[10px]">
                    <PillBadge
                      label={row.status === "completed" ? "Done" : "Pending"}
                      variant={row.status === "completed" ? "green" : "gold"}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* My Clients */}
      <div className="overflow-hidden rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)]">
        <div className="border-b border-[var(--border)] px-4 py-[0.8rem]">
          <p className="text-[13px] font-semibold text-[var(--navy)]">My Clients</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--bg)]">
                {["Client", "Category", "Purchases"].map((h) => (
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
              {MY_CLIENTS.map((row) => (
                <tr
                  key={row.name}
                  className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg)]"
                >
                  <td className="px-4 py-[10px] text-[13px] font-medium text-[var(--navy)]">
                    {row.name}
                  </td>
                  <td className="px-4 py-[10px]">
                    <PillBadge label={row.category} variant="blue" />
                  </td>
                  <td
                    className="px-4 py-[10px] text-[13px]"
                    style={{ fontFamily: "var(--font-dm-mono), monospace" }}
                  >
                    {formatAmount(row.purchases)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
