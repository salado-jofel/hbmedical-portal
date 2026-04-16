"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, ChevronDown } from "lucide-react";
import { formatAmount } from "@/utils/helpers/formatter";
import { TableToolbar } from "@/app/(components)/TableToolbar";
import { cn } from "@/utils/utils";
import type { IRepTreeNode } from "@/utils/interfaces/my-team";

export function RepTree({ tree }: { tree: IRepTreeNode[] }) {
  const [search, setSearch] = useState("");
  const [topLevelOnly, setTopLevelOnly] = useState(false);

  const filteredTree = useMemo(() => {
    const term = search.trim().toLowerCase();
    function matches(node: IRepTreeNode): boolean {
      const name = `${node.first_name ?? ""} ${node.last_name ?? ""} ${node.email ?? ""}`.toLowerCase();
      return !term || name.includes(term);
    }
    function filter(nodes: IRepTreeNode[]): IRepTreeNode[] {
      const out: IRepTreeNode[] = [];
      for (const n of nodes) {
        const kids = topLevelOnly ? [] : filter(n.children);
        if (matches(n) || kids.length > 0) out.push({ ...n, children: kids });
      }
      return out;
    }
    return filter(tree);
  }, [tree, search, topLevelOnly]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[240px]">
          <TableToolbar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search reps..."
          />
        </div>
        <label className="inline-flex items-center gap-2 text-xs text-[var(--text2)]">
          <input
            type="checkbox"
            checked={topLevelOnly}
            onChange={(e) => setTopLevelOnly(e.target.checked)}
            className="h-3.5 w-3.5 accent-[var(--navy)]"
          />
          Show top-level only
        </label>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-white overflow-hidden">
        <div className="grid grid-cols-[minmax(220px,2fr)_110px_90px_90px_110px_130px] px-4 py-2 text-[10px] uppercase tracking-wide text-[var(--text3)] border-b border-[var(--border)] bg-[#f8fafc]">
          <span>Rep</span>
          <span className="text-right">Rate</span>
          <span className="text-right">Override</span>
          <span className="text-right">Accounts</span>
          <span className="text-right">Orders</span>
          <span className="text-right">Commission $</span>
        </div>
        {filteredTree.map((node) => (
          <TreeRow key={node.id} node={node} depth={0} />
        ))}
        {filteredTree.length === 0 && (
          <div className="px-4 py-6 text-sm text-[var(--text3)] text-center">No reps match.</div>
        )}
      </div>
    </div>
  );
}

function TreeRow({ node, depth }: { node: IRepTreeNode; depth: number }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;

  return (
    <>
      <div
        className={cn(
          "grid grid-cols-[minmax(220px,2fr)_110px_90px_90px_110px_130px] items-center px-4 py-2 border-b border-[var(--border)] last:border-b-0 hover:bg-[#f8fafc]",
        )}
      >
        <div className="flex items-center gap-2 min-w-0" style={{ paddingLeft: depth * 20 }}>
          {hasChildren ? (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="shrink-0 text-[var(--text3)] hover:text-[var(--navy)]"
              aria-label={expanded ? "Collapse" : "Expand"}
            >
              {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          ) : (
            <span className="w-4 h-4 shrink-0" />
          )}
          <Link
            href={`/dashboard/my-team/${node.id}`}
            className="flex-1 min-w-0 truncate text-sm font-medium text-[var(--navy)] hover:underline"
          >
            {node.first_name} {node.last_name}
            <span className="ml-2 text-[10px] text-[var(--text3)] font-normal">{node.status}</span>
          </Link>
        </div>
        <span className="text-right text-sm text-[var(--text2)]">{node.commissionRate}%</span>
        <span className="text-right text-sm text-[var(--text2)]">{node.overridePercent}%</span>
        <span className="text-right text-sm text-[var(--text2)]">{node.accountCount}</span>
        <span className="text-right text-sm text-[var(--text2)]">{node.orderCount}</span>
        <span className="text-right text-sm font-semibold text-[var(--navy)]">
          {formatAmount(node.commissionEarned)}
        </span>
      </div>
      {hasChildren && expanded &&
        node.children.map((child) => <TreeRow key={child.id} node={child} depth={depth + 1} />)
      }
    </>
  );
}
