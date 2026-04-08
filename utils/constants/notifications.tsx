import {
  ClipboardList,
  PenLine,
  AlertTriangle,
  RefreshCw,
  CheckCircle,
  Package,
  Home,
  XCircle,
  Undo2,
  MessageSquare,
  CreditCard,
} from "lucide-react";
import type React from "react";

export const STATUS_COLORS: Record<string, string> = {
  order_submitted:   "bg-blue-100 text-blue-700",
  order_signed:      "bg-purple-100 text-purple-700",
  info_requested:    "bg-amber-100 text-amber-700",
  order_resubmitted: "bg-blue-100 text-blue-700",
  order_approved:    "bg-green-100 text-green-700",
  order_shipped:     "bg-green-100 text-green-700",
  order_delivered:   "bg-emerald-100 text-emerald-700",
  order_canceled:    "bg-red-100 text-red-700",
  order_recalled:    "bg-amber-100 text-amber-700",
  message_received:  "bg-gray-100 text-gray-700",
  payment_initiated: "bg-green-100 text-green-700",
};

export const TYPE_ICONS: Record<string, React.ReactNode> = {
  order_submitted:   <ClipboardList className="w-4 h-4" />,
  order_signed:      <PenLine className="w-4 h-4" />,
  info_requested:    <AlertTriangle className="w-4 h-4" />,
  order_resubmitted: <RefreshCw className="w-4 h-4" />,
  order_approved:    <CheckCircle className="w-4 h-4" />,
  order_shipped:     <Package className="w-4 h-4" />,
  order_delivered:   <Home className="w-4 h-4" />,
  order_canceled:    <XCircle className="w-4 h-4" />,
  order_recalled:    <Undo2 className="w-4 h-4" />,
  message_received:  <MessageSquare className="w-4 h-4" />,
  payment_initiated: <CreditCard className="w-4 h-4" />,
};
