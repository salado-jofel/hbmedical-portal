# Account Detail — Orders Tab Redesign

**Date:** 2026-04-16
**Scope:** Redesign the Orders tab on `/dashboard/accounts/[id]` to include: (1) a row of 3 charts (orders per month, revenue per month, status donut) showing a rolling 12-month window, (2) a filter bar with status dropdown, period chips, search, and view toggle, and (3) either a table view (default) or the existing kanban view, both scoped to the account.

---

## 1. Overview

Currently the Orders tab renders only a kanban board with no filters or analytics. The redesign turns it into a mini-dashboard that helps a rep or admin assess the account's order activity at a glance and drill down as needed.

All charts and data derive from the orders already loaded into the tab — no new server fetches. The table is built from scratch (scoped to this account) to keep the tab isolated from the global orders page.

---

## 2. Layout (top-to-bottom)

### 2.1 Charts row
Three equal-width charts:

| Chart | Type | Data | Notes |
|---|---|---|---|
| Orders per Month | Line | Count of orders placed in each of the last 12 months | X-axis = month labels, Y-axis = count |
| Revenue per Month | Line | Sum of delivered `order_items.total_amount` per month (by `delivered_at`) over last 12 months | Green line; Y-axis = dollars |
| Status Breakdown | Donut | Count by current `order_status` across all orders for this account | Segments color-coded to match kanban config |

Charts always show **rolling 12 months** regardless of the period chip selection. Status donut is not time-scoped — shows current state of all orders.

### 2.2 Filter bar
Horizontal row:
- **Status dropdown**: All / Draft / Pending Signature / Mfr Review / Info Needed / Approved / Shipped / Delivered / Canceled
- **Period chips**: This Month / Last 3 Months / All Time (default: All Time)
- **Search input**: order number or patient name (client-side filter)
- **View toggle**: segmented control — Table / Kanban (default: Table)

The Status / Period / Search filters apply to the Table and Kanban views but NOT to the charts above.

### 2.3 Content view

**Table view (default):**
Columns — Order # · Patient · Date of Service · Status · Payment · Total · (click row opens `OrderDetailModal`)

**Kanban view:**
Current kanban rendering preserved as-is, but receives filtered orders (status/period/search applied before grouping).

---

## 3. Data flow

All source data: `orders: DashboardOrder[]` already passed to `OrdersTab` as a prop.

### 3.1 Chart data derivation

All three are pure client-side transformations of `orders`:

```ts
// Orders per month — last 12 months
function ordersPerMonth(orders): Array<{ month: string; count: number }> {
  // Group by YYYY-MM of placed_at, backfill missing months with 0
}

// Revenue per month — last 12 months
function revenuePerMonth(orders): Array<{ month: string; revenue: number }> {
  // For orders with delivery_status='delivered' and delivered_at,
  // group by YYYY-MM of delivered_at, sum order_items.total_amount
}

// Status donut
function ordersByStatus(orders): Array<{ status: OrderStatus; count: number }> {
  // Count occurrences of each order_status, exclude zero counts
}
```

### 3.2 Filter derivation

```ts
// After charts render from full orders list, compute a filtered array
// for the table/kanban:
const filtered = useMemo(() => {
  let result = orders;
  if (statusFilter !== "all") result = result.filter((o) => o.order_status === statusFilter);
  if (periodFilter !== "all_time") {
    const { start, end } = periodBounds(periodFilter);
    result = result.filter((o) => o.placed_at >= start && (!end || o.placed_at < end));
  }
  if (search.trim()) {
    const term = search.toLowerCase();
    result = result.filter((o) =>
      (o.order_number ?? "").toLowerCase().includes(term) ||
      `${o.patient?.first_name ?? ""} ${o.patient?.last_name ?? ""}`.toLowerCase().includes(term),
    );
  }
  return result;
}, [orders, statusFilter, periodFilter, search]);
```

---

## 4. Components

### 4.1 `OrdersTab.tsx` (modify)
Becomes the controller. Holds filter state (`statusFilter`, `periodFilter`, `search`, `view`). Renders:
- `<OrdersChartsRow orders={orders} />`
- `<OrdersFilterBar ... />`
- `{view === "table" ? <OrdersTableView orders={filtered} /> : <OrdersKanbanView orders={filtered} />}`

### 4.2 `OrdersChartsRow.tsx` (new)
**File:** `accounts/[id]/(components)/OrdersChartsRow.tsx`
Renders three `<div>` cards side-by-side each containing a Recharts chart. `grid-cols-1 md:grid-cols-3 gap-4`.

Uses `recharts` components (already installed):
- `LineChart` for the two time-series charts
- `PieChart` + `Pie` for the donut

Empty-state handling: if orders array is empty, show a friendly message in each chart container.

### 4.3 `OrdersFilterBar.tsx` (new)
**File:** `accounts/[id]/(components)/OrdersFilterBar.tsx`
Props: current filter values + change handlers. Inline segmented controls for period + view; `<select>` for status; `<input>` for search.

### 4.4 `OrdersTableView.tsx` (new)
**File:** `accounts/[id]/(components)/OrdersTableView.tsx`
Reuses the existing `DataTable` component. Columns:
- Order # (bold navy)
- Patient (first + last)
- Date of Service (formatDate)
- Status (colored pill — reuse `KANBAN_STATUS_CONFIG` badge classes)
- Payment (payment_status pill)
- Total ($ — sum of `order_items.total_amount`)
- Row click → calls `onOrderClick(order.id)` (prop passed from `OrdersTab`)

### 4.5 `OrdersKanbanView.tsx` (extract from current OrdersTab)
**File:** `accounts/[id]/(components)/OrdersKanbanView.tsx`
The current kanban JSX in `OrdersTab.tsx` is extracted into this component unchanged, just accepting filtered orders as a prop.

---

## 5. Files Changed

### New files
| File | Purpose |
|---|---|
| `accounts/[id]/(components)/OrdersChartsRow.tsx` | 3-chart analytics row |
| `accounts/[id]/(components)/OrdersFilterBar.tsx` | status/period/search/view toggle |
| `accounts/[id]/(components)/OrdersTableView.tsx` | Scoped table view |
| `accounts/[id]/(components)/OrdersKanbanView.tsx` | Existing kanban extracted |

### Modified files
| File | Change |
|---|---|
| `accounts/[id]/(components)/OrdersTab.tsx` | Becomes controller; holds filter/view state; renders charts + filter bar + active view |

---

## 6. Out of Scope
- Creating/editing orders from the tab
- Period chips affecting charts (charts always show rolling 12 months)
- Custom date range picker
- Exporting orders (CSV/PDF)
- Dark mode styling beyond what the existing CSS vars already handle
