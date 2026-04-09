"use client";

import { useMemo, useState } from "react";
import { ActionBar } from "@/app/(components)/ActionBar";
import { PillBadge } from "@/app/(components)/PillBadge";
import { formatAmount, formatDate } from "@/utils/helpers/formatter";

const REPS = [
  { id: 1, name: "Sarah Mitchell", initials: "SM", color: "bg-[var(--teal)]"   },
  { id: 2, name: "James Ochoa",    initials: "JO", color: "bg-[var(--blue)]"   },
  { id: 3, name: "Rachel Kim",     initials: "RK", color: "bg-[var(--gold)]"   },
  { id: 4, name: "Devon Patel",    initials: "DP", color: "bg-[var(--navy)]"   },
  { id: 5, name: "Tanya Brooks",   initials: "TB", color: "bg-[var(--purple)]" },
];

const SALES = [
  { id: "HB-2604-1", repId: 3, client: "Mass General Brigham",   products: "Surgical Kits (x40), Gloves (x200)",          amount: 18400, commission: 920,  date: "2026-04-07", status: "completed" },
  { id: "HB-2604-2", repId: 4, client: "Rush University Medical", products: "IV Supplies (x100), Catheters (x50)",          amount: 14200, commission: 710,  date: "2026-04-06", status: "completed" },
  { id: "HB-2604-3", repId: 1, client: "Palmetto General",        products: "Diagnostic Equipment (x2)",                    amount: 22000, commission: 880,  date: "2026-04-05", status: "completed" },
  { id: "HB-2604-4", repId: 2, client: "Roper St. Francis",       products: "Surgical Kits (x60)",                          amount: 17800, commission: 712,  date: "2026-04-02", status: "completed" },
  { id: "HB-2604-5", repId: 3, client: "Boston Children's",       products: "Lab Supplies (x300)",                          amount: 9800,  commission: 490,  date: "2026-04-03", status: "completed" },
  { id: "HB-2604-6", repId: 5, client: "—",                       products: "PPE Bundle (x150)",                            amount: 12500, commission: 500,  date: "2026-04-04", status: "pending"   },
  { id: "HB-2604-7", repId: 4, client: "Northwestern Medicine",   products: "Monitoring Equipment (x3)",                    amount: 31000, commission: 1550, date: "2026-04-04", status: "completed" },
  { id: "HB-2604-8", repId: 1, client: "Coastal Surgical Center", products: "Suture Kits (x100), Drapes (x200)",            amount: 8700,  commission: 348,  date: "2026-04-02", status: "completed" },
];

const STATUS_VARIANT: Record<string, "green" | "gold"> = {
  completed: "green",
  pending:   "gold",
};

export default function SalesTable() {
  const [search, setSearch]     = useState("");
  const [repFilter, setRepFilter] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return SALES.filter((s) => {
      const rep = REPS.find((r) => r.id === s.repId);
      const matchesSearch =
        !q ||
        s.id.toLowerCase().includes(q) ||
        s.client.toLowerCase().includes(q) ||
        s.products.toLowerCase().includes(q) ||
        rep?.name.toLowerCase().includes(q);
      const matchesRep = !repFilter || String(s.repId) === repFilter;
      return matchesSearch && matchesRep;
    });
  }, [search, repFilter]);

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <ActionBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search orders, reps, clients..."
      >
        <select
          value={repFilter}
          onChange={(e) => setRepFilter(e.target.value)}
          className="h-8 rounded-[7px] border border-[var(--border2)] bg-transparent px-2.5 text-[13px] text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
        >
          <option value="">All Reps</option>
          {REPS.map((r) => (
            <option key={r.id} value={String(r.id)}>
              {r.name}
            </option>
          ))}
        </select>
      </ActionBar>

      {/* Table card */}
      <div className="overflow-hidden rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--bg)]">
                {["Order #", "Rep", "Client", "Products", "Amount", "Commission", "Date", "Status"].map((h) => (
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
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-[13px] text-[var(--text3)]">
                    No sales found.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => {
                  const rep = REPS.find((r) => r.id === row.repId)!;
                  return (
                    <tr
                      key={row.id}
                      className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg)]"
                    >
                      <td
                        className="px-4 py-[10px] text-[13px] font-medium text-[var(--navy)]"
                        style={{ fontFamily: "var(--font-dm-mono), monospace" }}
                      >
                        {row.id}
                      </td>
                      <td className="px-4 py-[10px]">
                        <div className="flex items-center gap-2">
                          <div
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white ${rep.color}`}
                          >
                            {rep.initials}
                          </div>
                          <span className="text-[13px] text-[var(--text)]">{rep.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-[10px] text-[13px] text-[var(--text)]">{row.client}</td>
                      <td className="max-w-[200px] truncate px-4 py-[10px] text-[13px] text-[var(--text2)]">
                        {row.products}
                      </td>
                      <td
                        className="px-4 py-[10px] text-[13px]"
                        style={{ fontFamily: "var(--font-dm-mono), monospace" }}
                      >
                        {formatAmount(row.amount)}
                      </td>
                      <td
                        className="px-4 py-[10px] text-[13px] font-medium text-[var(--teal)]"
                        style={{ fontFamily: "var(--font-dm-mono), monospace" }}
                      >
                        {formatAmount(row.commission)}
                      </td>
                      <td className="px-4 py-[10px] text-[13px] text-[var(--text2)]">
                        {formatDate(row.date)}
                      </td>
                      <td className="px-4 py-[10px]">
                        <PillBadge
                          label={row.status === "completed" ? "Completed" : "Pending"}
                          variant={STATUS_VARIANT[row.status] ?? "gold"}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
