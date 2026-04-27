"use client";

import { useState, useEffect, useMemo, useTransition, useRef } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  removeOrderFromStore,
  updateOrderInStore,
} from "../(redux)/orders-slice";
// Use raw Radix primitive so we own 100% of the sizing — shadcn DialogContent
// bakes in `sm:max-w-sm` via @media which cannot be overridden with className.
import { Dialog as RadixDialog } from "radix-ui";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogPortal,
  DialogOverlay,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  X,
  Upload,
  Trash2,
  ExternalLink,
  Loader2,
  Lock,
  AlertCircle,
  Check,
  Calendar,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Paperclip,
  Download,
  Clock,
  CreditCard,
  FileText,
  Info,
  RefreshCw,
} from "lucide-react";
import type {
  DashboardOrder,
  IOrderHistory,
  IOrderMessage,
  IOrderDocument,
  IOrderForm,
  DocumentType,
  ProductRecord,
  IPayment,
  IInvoice,
} from "@/utils/interfaces/orders";
import {
  getOrderMessages,
  getOrderHistory,
  getOrderDocuments,
  getOrderById,
} from "../(services)/order-read-actions";
import {
  deleteOrder,
  updateOrderClinicalFields,
} from "../(services)/order-write-actions";
import {
  submitForSignature,
  recallOrder,
  resubmitForReview,
  requestAdditionalInfo,
  markOrderDelivered,
  getUnsignedForms,
  submitSignedOrder,
} from "../(services)/order-workflow-actions";
import {
  getOrderPayment,
  getOrderInvoice,
  initiatePayment,
  setOrderPaymentMethod,
} from "../(services)/order-payment-actions";
import {
  uploadOrderDocument,
  deleteOrderDocument,
  getDocumentSignedUrl,
  getForm1500,
  triggerDocumentExtraction,
} from "../(services)/order-document-actions";
import {
  sendOrderMessage,
  markMessagesAsRead,
} from "../(services)/order-messaging-actions";
import { getOrderIVR, getOrderAiStatus } from "../(services)/order-ivr-actions";
import {
  addOrderItems,
  updateOrderItemQuantity,
  deleteOrderItem,
  getOrderShipment,
  type OrderShipmentInfo,
} from "../(services)/order-misc-actions";
import { createClient } from "@/lib/supabase/client";
import type { IOrderIVR, OrderStatus } from "@/utils/interfaces/orders";
import { OrderStatusBadge } from "./OrderStatusBadge";
import { PillBadge } from "@/app/(components)/PillBadge";
import { OrderCompletionGuide } from "./OrderCompletionGuide";
import { SignOrderModal } from "./SignOrderModal";
import { ApproveOrderModal } from "./ApproveOrderModal";
import { AddShippingModal } from "./AddShippingModal";
import ConfirmModal from "@/app/(components)/ConfirmModal";
import { OrderOverviewTab } from "./OrderOverviewTab";
import type { DraftOrderItem } from "./OrderOverviewTab";
import { OrderFormTab } from "./OrderFormTab";
import type { AiStatus } from "./OrderFormTab";
import { IVRTab } from "./IVRTab";
import { HCFATab } from "./HCFATab";
import { InvoiceTab } from "./InvoiceTab";
import { OrderChatTab } from "./OrderChatTab";
import { OrderHistoryTab } from "./OrderHistoryTab";
import toast from "react-hot-toast";
import { cn } from "@/utils/utils";
import { REQUIRED_DOC_TYPES, ALL_DOC_TYPES, isInvoiceVisibleForStatus, isItemsEditable } from "@/utils/constants/orders";
import { getDisplayOrderStatus } from "@/utils/helpers/orders";

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "order-form", label: "Order Form" },
  { value: "ivr", label: "IVR Form" },
  { value: "hcfa", label: "HCFA/1500" },
  { value: "invoice", label: "Invoice" },
  { value: "conversation", label: "Chat" },
  { value: "history", label: "History" },
] as const;

type TabValue = (typeof TABS)[number]["value"];

/* ── Props ── */

interface OrderDetailModalProps {
  open: boolean;
  onClose: () => void;
  order: DashboardOrder;
  canSign: boolean;
  isAdmin: boolean;
  isClinical: boolean;
  canEdit: boolean;
  isRep?: boolean;
  isSupport?: boolean;
  isProvider?: boolean;
  currentUserName?: string;
  currentUserId?: string;
  unreadCount?: number;
  onClearUnread?: () => void;
  initialTab?: string;
  onOrderUpdated?: (order: DashboardOrder) => void;
}

/* ── Component ── */

export function OrderDetailModal({
  open,
  onClose,
  order,
  canSign,
  isAdmin,
  isClinical,
  canEdit,
  isRep = false,
  isSupport = false,
  isProvider = false,
  currentUserName,
  currentUserId,
  unreadCount = 0,
  onClearUnread,
  initialTab,
  onOrderUpdated,
}: OrderDetailModalProps) {
  const dispatch = useAppDispatch();
  const liveOrder =
    useAppSelector((state) =>
      state.orders.items.find((o) => o.id === order.id),
    ) ?? order;
  const [, startTransition] = useTransition();

  const [tab, setTab] = useState<TabValue>("overview");

  /* -- Status-aware edit gate (overlays the role-based `canEdit` prop) --
     Non-admins lose edit rights once the order is past manufacturer_review.
     Admin can edit at every status — the previous version returned `canEdit`
     here, which was false for admin (because `canCreate` excluded admin)
     and silently locked them out of every form. Now admin always edits. */
  const effectiveCanEdit = useMemo(() => {
    if (isAdmin) return true;
    return canEdit && isItemsEditable(liveOrder.order_status);
  }, [canEdit, isAdmin, liveOrder.order_status]);

  // Signing of Order Form / IVR is only meaningful before admin approval.
  // Once the order hits manufacturer_review+, the provider can no longer
  // sign/unsign. Admin keeps `canSign` as passed (admin doesn't actually
  // sign as a clinical_provider, so canSign=false for admin is correct).
  const effectiveCanSign = useMemo(() => {
    if (isAdmin) return canSign;
    return canSign && isItemsEditable(liveOrder.order_status);
  }, [canSign, isAdmin, liveOrder.order_status]);

  /* -- Documents (shared between Docs tab and right panel) -- */
  const [documents, setDocuments] = useState<IOrderDocument[]>([]);
  const [localDocuments, setLocalDocuments] = useState<IOrderDocument[]>(
    order.documents ?? [],
  );
  const [viewingDocId, setViewingDocId] = useState<string | null>(null);
  const [generatingPdfTypes, setGeneratingPdfTypes] = useState<Set<string>>(new Set());
  const [aiWindowExpired, setAiWindowExpired] = useState(true);
  const [woundPhotoUrls, setWoundPhotoUrls] = useState<Record<string, string>>(
    {},
  );
  const [loadingDocs, setLoadingDocs] = useState(false);

  /* -- Tab load tracking (single source of truth) -- */
  const [loadedTabs, setLoadedTabs] = useState<Set<string>>(new Set());

  /* -- Payment + invoice data -- */
  const [paymentData, setPaymentData] = useState<IPayment | null>(null);
  const [invoiceData, setInvoiceData] = useState<IInvoice | null>(null);
  const [shipmentData, setShipmentData] = useState<OrderShipmentInfo | null>(null);
  const [initiatingPayment, setInitiatingPayment] = useState<
    false | "pay_now" | "net_30"
  >(false);
  const [markingDelivered, setMarkingDelivered] = useState(false);

  /* -- IVR + HCFA (lazy-loaded on first tab visit) -- */
  const [ivrData, setIvrData] = useState<Partial<IOrderIVR> | null>(null);
  const [hcfaData, setHcfaData] = useState<Record<string, unknown> | null>(
    null,
  );

  /* -- Messages (lazy-loaded on first chat visit) -- */
  const [messages, setMessages] = useState<IOrderMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentUserIdRef = useRef(currentUserId);
  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  /* -- History (lazy-loaded) -- */
  const [history, setHistory] = useState<IOrderHistory[]>([]);

  /* -- Product picker -- (state lives in OrderOverviewTab now) -- */

  /* -- Order items + notes (draft/saved) -- */
  const [savedItems, setSavedItems] = useState<DraftOrderItem[]>(
    (order.all_items ?? []) as DraftOrderItem[],
  );
  const [draftItems, setDraftItems] = useState<DraftOrderItem[]>(
    (order.all_items ?? []) as DraftOrderItem[],
  );
  const [savedNotes, setSavedNotes] = useState(order.notes ?? "");
  const [draftNotes, setDraftNotes] = useState(order.notes ?? "");
  const [isSavingOverview, setIsSavingOverview] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);

  /* -- Patient name (updates after AI links patient to order) -- */
  const [patientName, setPatientName] = useState<string | null>(
    order.patient_full_name ?? null,
  );

  /* -- AI extraction status + order_form data -- */
  const [aiStatus, setAiStatus] = useState<AiStatus>("idle");
  const [orderForm, setOrderForm] = useState<IOrderForm | null>(null);

  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const pollCountRef = useRef(0);
  const aiToastShownRef = useRef(false);
  // Tracks whether the poll ran its full completion handler (fetched IVR/HCFA).
  // If the Supabase realtime UPDATE arrives before the next poll tick, React's
  // effect cleanup kills the interval before completion — this flag lets the
  // Master AI effect detect that and run the IVR/HCFA fetch itself.
  const pollCompletedRef = useRef(false);
  // One-way latch: once AI extraction is confirmed complete for this modal session,
  // never allow aiStatus to regress back to "processing". Stale RSC payloads or
  // realtime events can temporarily deliver order.ai_extracted=false even after
  // extraction finished — this ref gates against those transient flips.
  const aiCompletedRef = useRef(false);

  function beginPolling() {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    pollCountRef.current = 0;

    pollingIntervalRef.current = setInterval(async () => {
      pollCountRef.current += 1;
      try {
        const result = await getOrderAiStatus(order.id);
        if (result.aiExtracted && result.orderForm) {
          // Guard: the Master AI effect fallback may have already fired while this
          // in-flight poll callback was awaiting getOrderAiStatus. Without this check
          // both paths complete and increment resetHcfaKey/resetIvrKey twice, causing
          // the HCFA skeleton to flash a second time.
          if (pollCompletedRef.current) return;
          pollCompletedRef.current = true;
          setOrderForm(result.orderForm);
          setAiStatus("complete");
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          // Only auto-switch to order-form if user hasn't navigated away
          setTab((current) =>
            current === "overview" || current === "order-form" ? "order-form" : current,
          );
          if (!aiToastShownRef.current) {
            aiToastShownRef.current = true;
            toast.success("AI extraction complete — please review the data", {
              duration: 5000,
            });
          }
          // Refresh patient name and documents — AI may have linked a patient and generated PDFs.
          // Note: ORDER_WITH_RELATIONS_SELECT does NOT include order_documents,
          // so updated.documents is always undefined — fetch docs directly so
          // the right-side cards flip from yellow to green after extraction.
          getOrderById(order.id).then((updated) => {
            if (updated?.patient_full_name) {
              setPatientName(updated.patient_full_name);
              dispatch(updateOrderInStore(updated));
            }
          });
          void refreshDocuments();
          // Refresh IVR and HCFA with AI-extracted data so those tabs are current
          // Increment reset keys so already-mounted forms remount with fresh AI data
          getOrderIVR(order.id).then(({ ivr }) => {
            setIvrData(ivr ?? {});
            setLoadedTabs((prev) => new Set([...prev, "ivr"]));
            setResetIvrKey((k) => k + 1);
          });
          getForm1500(order.id).then((data) => {
            setHcfaData((data as Record<string, unknown>) ?? {});
            setLoadedTabs((prev) => new Set([...prev, "hcfa"]));
            setResetHcfaKey((k) => k + 1);
          });
          return;
        }
      } catch (err) {
        console.error("[polling]", err);
      }
      if (pollCountRef.current >= 20) {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        setAiStatus("error");
      }
    }, 3000);
  }

  /* -- Dirty tracking for child tabs -- */
  const [isIvrDirty, setIsIvrDirty] = useState(false);
  const [isHcfaDirty, setIsHcfaDirty] = useState(false);
  const [isOrderFormDirty, setIsOrderFormDirty] = useState(false);

  /* -- Reset keys to remount child tabs on discard -- */
  const [resetIvrKey, setResetIvrKey] = useState(0);
  const [resetHcfaKey, setResetHcfaKey] = useState(0);

  /* -- Sub-modal flags -- */
  const [signOpen, setSignOpen] = useState(false);
  const [unsignedFormsOpen, setUnsignedFormsOpen] = useState(false);
  const [unsignedFormsList, setUnsignedFormsList] = useState<string[]>([]);
  const [approveOpen, setApproveOpen] = useState(false);
  const [requestInfoOpen, setRequestInfoOpen] = useState(false);
  const [requestInfoReason, setRequestInfoReason] = useState("");
  const [requestingInfo, setRequestingInfo] = useState(false);
  const [shipOpen, setShipOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [completionOpen, setCompletionOpen] = useState(false);
  const [closeWarningOpen, setCloseWarningOpen] = useState(false);

  /* -- Loading flags -- */
  const [isActing, setIsActing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  /* ── Sync items, notes, and patient name when order prop updates ── */
  useEffect(() => {
    setSavedItems((order.all_items ?? []) as DraftOrderItem[]);
    setDraftItems((order.all_items ?? []) as DraftOrderItem[]);
    setSavedNotes(order.notes ?? "");
    setDraftNotes(order.notes ?? "");
    if (order.patient_full_name) setPatientName(order.patient_full_name);
  }, [order.id, order.all_items, order.notes, order.patient_full_name]);

  /* ── Sync localDocuments when order changes ── */
  useEffect(() => {
    setLocalDocuments(order.documents ?? []);
  }, [order.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Modal open/close: reset tabs, load background data ── */
  useEffect(() => {
    if (!open) {
      // Reset all tab data on close
      setLoadedTabs(new Set());
      setIvrData(null);
      setHcfaData(null);
      setDocuments([]);
      setPaymentData(null);
      setInvoiceData(null);
      setShipmentData(null);
      setMessages([]);
      setHistory([]);
      // Reset poll state so stale counters don't affect the next open
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      pollCountRef.current = 0;
      aiToastShownRef.current = false;
      aiCompletedRef.current = false;
      return;
    }

    // Reset latch on open so it reflects the current order's extraction state
    aiCompletedRef.current = order.ai_extracted;

    // Mark immediately-ready tabs; others load on first visit
    setLoadedTabs(new Set(["overview", "order-form"]));
    setTab((initialTab as TabValue) ?? "overview");
    // Load right-panel data in background (non-blocking)
    setLoadingDocs(true);
    Promise.all([
      getOrderDocuments(order.id),
      getOrderPayment(order.id),
      getOrderInvoice(order.id),
      getOrderShipment(order.id),
    ]).then(([docs, payment, invoice, shipment]) => {
      setDocuments(docs);
      setLocalDocuments(docs);
      setLoadingDocs(false);
      setPaymentData(payment);
      setInvoiceData(invoice);
      setShipmentData(shipment);

      // Wound photos — non-blocking, resolves independently
      const photos = docs.filter((d) => d.documentType === "wound_pictures");
      if (photos.length > 0) {
        Promise.all(
          photos.map(async (p) => {
            const { url } = await getDocumentSignedUrl(p.filePath);
            return { id: p.id, url };
          }),
        ).then((results) => {
          const urlMap: Record<string, string> = {};
          for (const { id, url } of results) {
            if (url) urlMap[id] = url;
          }
          setWoundPhotoUrls(urlMap);
        });
      }

      // AI polling check — only for recently created orders that haven't been extracted yet.
      // Manual-input orders never receive AI extraction, so skip polling entirely.
      if (!order.ai_extracted && !order.manual_input) {
        const ageMs = Date.now() - new Date(order.created_at).getTime();
        const isRecentOrder = ageMs < 10 * 60 * 1000;
        const hasTriggerDoc = docs.some((d) =>
          ["facesheet", "clinical_docs"].includes(d.documentType),
        );
        if (hasTriggerDoc && isRecentOrder) {
          // aiStatus is already "processing" from the Master AI effect
          beginPolling();
        } else {
          // Old order or no extractable docs — show form as-is
          setAiStatus("idle");
        }
      } else if (order.manual_input) {
        setAiStatus("idle");
      }
    });
  }, [open, order.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Master AI effect — runs when modal opens or order changes ── */
  useEffect(() => {
    if (!open) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      aiToastShownRef.current = false;
      pollCompletedRef.current = false;
      return;
    }

    // Clear any existing polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    pollCountRef.current = 0;

    if (order.ai_extracted) {
      aiCompletedRef.current = true; // Latch: extraction confirmed complete
      setAiStatus("complete");
      getOrderAiStatus(order.id).then((result) => {
        if (result.orderForm) setOrderForm(result.orderForm);
      });

      // Guard: if the Supabase realtime UPDATE arrived before the next poll tick,
      // React's effect cleanup killed the interval before the poll completion handler
      // ran (which is the only place that fetches IVR/HCFA for new orders).
      // Detect this by checking the flag and fetch IVR/HCFA here as a fallback.
      const ageMs = Date.now() - new Date(order.created_at).getTime();
      const isRecentOrder = ageMs < 10 * 60 * 1000;
      if (isRecentOrder && !pollCompletedRef.current) {
        pollCompletedRef.current = true;
        getOrderIVR(order.id).then(({ ivr }) => {
          setIvrData(ivr ?? {});
          setLoadedTabs((prev) => new Set([...prev, "ivr"]));
          setResetIvrKey((k) => k + 1);
        });
        getForm1500(order.id).then((data) => {
          setHcfaData((data as Record<string, unknown>) ?? {});
          setLoadedTabs((prev) => new Set([...prev, "hcfa"]));
          setResetHcfaKey((k) => k + 1);
        });
      }
      return;
    }

    // order.ai_extracted is false — but guard against stale props after completion.
    // Delayed RSC payloads or out-of-order realtime events can briefly deliver
    // ai_extracted=false even after extraction finished. Once the latch is set,
    // never regress aiStatus back to "processing".
    if (aiCompletedRef.current) return;

    setOrderForm(null);
    // Only treat as "processing" if the order was created very recently (within 10 min)
    // AND it's not a manual-input order (those never receive AI extraction by design).
    // Older orders with ai_extracted=false had a failed/skipped extraction — show form as-is.
    const ageMs = Date.now() - new Date(order.created_at).getTime();
    const isRecentOrder = ageMs < 10 * 60 * 1000;
    setAiStatus(isRecentOrder && !order.manual_input ? "processing" : "idle");

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [open, order.id, order.ai_extracted]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── AI-generating window: show spinner for 30 s after ai_extracted_at ── */
  useEffect(() => {
    if (!open || !liveOrder.ai_extracted || !liveOrder.ai_extracted_at) {
      setAiWindowExpired(true);
      return;
    }
    const elapsed = Date.now() - new Date(liveOrder.ai_extracted_at).getTime();
    if (elapsed >= 30_000) {
      setAiWindowExpired(true);
      return;
    }
    setAiWindowExpired(false);
    const timer = setTimeout(() => setAiWindowExpired(true), 30_000 - elapsed);
    return () => clearTimeout(timer);
  }, [open, liveOrder.ai_extracted, liveOrder.ai_extracted_at]);

  /* ── Auto-scroll chat to latest message ── */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ── Realtime: append new messages while modal is open ── */
  useEffect(() => {
    if (!open) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`chat-${order.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "order_messages",
          filter: `order_id=eq.${order.id}`,
        },
        async (payload) => {
          const newMsg = payload.new as {
            id: string;
            order_id: string;
            sender_id: string;
            message: string;
            created_at: string;
          };

          // Own messages are added optimistically — skip to avoid duplicate
          if (newMsg.sender_id === currentUserIdRef.current) return;

          // Resolve sender profile
          const { data: profile } = await supabase
            .from("profiles")
            .select("first_name, last_name, role")
            .eq("id", newMsg.sender_id)
            .single();

          const resolvedMsg: IOrderMessage = {
            id: newMsg.id,
            orderId: newMsg.order_id,
            senderId: newMsg.sender_id,
            senderName: profile
              ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() ||
                "Unknown"
              : "Unknown",
            senderRole: profile?.role ?? "unknown",
            message: newMsg.message,
            createdAt: newMsg.created_at,
          };

          setMessages((prev) => [...prev, resolvedMsg]);

          // If chat is already open — mark as read immediately
          if (tab === "conversation") {
            markMessagesAsRead(order.id);
          }
          // Otherwise the badge in OrdersPageClient's Realtime will show it
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, order.id, tab, currentUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Realtime: live order status updates while modal is open ── */
  useEffect(() => {
    if (!open) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`order-status-${order.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `id=eq.${order.id}`,
        },
        async (payload) => {
          const updated = payload.new as Record<string, unknown>;
          const old = payload.old as Record<string, unknown>;

          const fullOrder = await getOrderById(order.id);
          if (!fullOrder) return;
          dispatch(updateOrderInStore(fullOrder));
          onOrderUpdated?.(fullOrder);

          // Refresh payment + invoice + shipment data whenever the order row changes
          const [newPayment, newInvoice, newShipment] = await Promise.all([
            getOrderPayment(order.id),
            getOrderInvoice(order.id),
            getOrderShipment(order.id),
          ]);
          setPaymentData(newPayment);
          setInvoiceData(newInvoice);
          setShipmentData(newShipment);

          // Toast: payment became paid
          if (
            updated.payment_status === "paid" &&
            old.payment_status !== "paid"
          ) {
            toast.success("Payment received! Order is now paid.", {
              duration: 4000,
            });
            return;
          }

          // Toast: order_status changed
          if (updated.order_status !== old.order_status) {
            const statusLabels: Record<string, string> = {
              pending_signature: "Pending Signature",
              manufacturer_review: "Manufacturer Review",
              additional_info_needed: "Additional Info Needed",
              approved: "Approved",
              shipped: "Shipped",
              canceled: "Canceled",
            };
            toast.success(
              `Order status updated to: ${statusLabels[updated.order_status as string] ?? updated.order_status}`,
              { duration: 4000 },
            );
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, order.id, dispatch]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Realtime: invoice updates while modal is open ── */
  useEffect(() => {
    if (!open) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`invoice-${order.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "invoices",
          filter: `order_id=eq.${order.id}`,
        },
        async (payload) => {
          const newInvoice = await getOrderInvoice(order.id);
          setInvoiceData(newInvoice);

          const fullOrder = await getOrderById(order.id);
          if (fullOrder) dispatch(updateOrderInStore(fullOrder));

          const newStatus = (payload.new as { status?: string }).status;
          if (newStatus === "paid") {
            toast.success("Invoice paid! Order payment complete.", {
              duration: 4000,
            });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, order.id, dispatch]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Realtime: append newly generated/uploaded documents while modal is open ── */
  useEffect(() => {
    if (!open) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`docs-${order.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "order_documents",
          filter: `order_id=eq.${order.id}`,
        },
        (payload) => {
          const raw = payload.new as {
            id: string;
            order_id: string;
            document_type: string;
            bucket: string;
            file_path: string;
            file_name: string;
            mime_type: string | null;
            file_size: number | null;
            uploaded_by: string | null;
            created_at: string;
          };

          const newDoc: IOrderDocument = {
            id: raw.id,
            orderId: raw.order_id,
            documentType: raw.document_type as DocumentType,
            bucket: raw.bucket,
            filePath: raw.file_path,
            fileName: raw.file_name,
            mimeType: raw.mime_type,
            fileSize: raw.file_size,
            uploadedBy: raw.uploaded_by,
            createdAt: raw.created_at,
          };

          setLocalDocuments((prev) => {
            // Avoid duplicates if polling already added this record
            if (prev.some((d) => d.id === newDoc.id)) return prev;
            return [...prev, newDoc];
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, order.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── PDF regeneration tracking (form save) ── */
  useEffect(() => {
    function handler(e: Event) {
      const { type, status } = (e as CustomEvent<{ type: string; status: "start" | "done" }>).detail;
      setGeneratingPdfTypes((prev) => {
        const next = new Set(prev);
        if (status === "start") next.add(type);
        else next.delete(type);
        return next;
      });
      // Belt-and-suspenders: even if the order_documents realtime insert is
      // missed (e.g. table not in the supabase_realtime publication on this
      // env, or RLS noise), refetch the docs list when a regen finishes so
      // the right-side cards flip from yellow to green without needing a
      // modal close/reopen. Small delay lets the upsert/INSERT settle.
      if (status === "done") {
        window.setTimeout(() => {
          void refreshDocuments();
        }, 400);
      }
    }
    window.addEventListener("pdf-regenerating", handler as EventListener);
    return () => window.removeEventListener("pdf-regenerating", handler as EventListener);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Handlers ── */

  async function handleTabChange(value: TabValue) {
    setTab(value);

    // Already loaded — don't reload
    if (loadedTabs.has(value)) {
      if (value === "conversation") {
        markMessagesAsRead(order.id).then(() => onClearUnread?.());
      }
      return;
    }

    if (value === "ivr") {
      const { ivr } = await getOrderIVR(order.id);
      setIvrData(ivr ?? {});
      setLoadedTabs((prev) => new Set([...prev, "ivr"]));
    }

    if (value === "hcfa") {
      const data = await getForm1500(order.id);
      setHcfaData((data as Record<string, unknown>) ?? {});
      setLoadedTabs((prev) => new Set([...prev, "hcfa"]));
    }

    if (value === "conversation") {
      const data = await getOrderMessages(order.id);
      setMessages(data ?? []);
      setLoadedTabs((prev) => new Set([...prev, "conversation"]));
      await markMessagesAsRead(order.id);
      onClearUnread?.();
    }

    if (value === "history") {
      const data = await getOrderHistory(order.id);
      setHistory(data ?? []);
      setLoadedTabs((prev) => new Set([...prev, "history"]));
    }
  }

  async function handleSendMessage() {
    if (!newMessage.trim()) return;
    setSendingMsg(true);
    const result = await sendOrderMessage(order.id, newMessage.trim());
    if (result.success) {
      const msgs = await getOrderMessages(order.id);
      setMessages(msgs);
      setNewMessage("");
    } else {
      toast.error(result.error ?? "Failed to send.");
    }
    setSendingMsg(false);
  }

  async function handleViewDoc(doc: IOrderDocument) {
    const { url, error } = await getDocumentSignedUrl(doc.filePath);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
    else toast.error(error ?? "Could not open document.");
  }

  async function handleViewDocByType(type: string) {
    const doc = documents.find((d) => d.documentType === type);
    if (!doc) {
      toast("No document uploaded yet.", {
        icon: <Info className="w-4 h-4 text-blue-500" />,
      });
      return;
    }
    handleViewDoc(doc);
  }

  async function handleViewDocument(docType: string) {
    const docs = localDocuments.filter((d: any) => d.documentType === docType);
    if (docs.length === 0) {
      toast.error("No document uploaded yet.");
      return;
    }
    // Prefer generated PDF (has /generated/ in path) over manually uploaded
    const doc =
      docs.find((d: any) => d.filePath?.includes("/generated/")) ?? docs[0];
    if (!doc?.filePath) {
      toast.error("Document path not found.");
      return;
    }
    setViewingDocId(doc.id);
    try {
      const { url, error } = await getDocumentSignedUrl(doc.filePath);
      if (!url) {
        toast.error(error ?? "Could not generate download link.");
        return;
      }
      window.open(url, "_blank");
    } catch (err) {
      console.error("[handleViewDocument]", err);
      toast.error("Failed to open document.");
    } finally {
      setViewingDocId(null);
    }
  }

  async function handleDeleteDoc(doc: IOrderDocument) {
    startTransition(async () => {
      const result = await deleteOrderDocument(doc.id, doc.filePath);
      if (result.success) {
        setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
        toast.success("Document deleted.");
      } else {
        toast.error(result.error ?? "Failed to delete.");
      }
    });
  }

  async function handleRegeneratePdf(docType: string) {
    const formTypeMap: Record<string, string> = {
      order_form: "order_form",
      form_1500: "hcfa_1500",
      additional_ivr: "ivr",
      delivery_invoice: "delivery_invoice",
    };
    const formType = formTypeMap[docType];
    if (!formType) return;

    setGeneratingPdfTypes((prev) => new Set([...prev, docType]));
    try {
      const res = await fetch("/api/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, formType }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        toast.error("Failed to generate PDF. Please try again.");
        return;
      }
      // Refresh documents so badge updates regardless of INSERT vs UPDATE
      await refreshDocuments();
    } catch {
      toast.error("Failed to generate PDF. Please try again.");
    } finally {
      setGeneratingPdfTypes((prev) => { const next = new Set(prev); next.delete(docType); return next; });
    }
  }

  async function handleUploadDoc(file: File, docType: string) {
    const fd = new FormData();
    fd.set("file", file);
    const result = await uploadOrderDocument(
      order.id,
      docType as DocumentType,
      fd,
    );
    if (result.success && result.document) {
      setDocuments((prev) => [result.document!, ...prev]);
      toast.success("Document uploaded.");
      // Start AI polling and explicitly trigger extraction for extractable doc types.
      // Manual-input orders never receive AI extraction — skip both the spinner and the trigger.
      // (auto-trigger was removed from uploadOrderDocument to prevent races on new orders)
      if (["facesheet", "clinical_docs"].includes(docType) && !order.manual_input) {
        setAiStatus("processing");
        pollCompletedRef.current = false;
        beginPolling();
        triggerDocumentExtraction(
          order.id,
          docType,
          result.document.filePath,
        ).catch((err) => console.error("[handleUploadDoc] AI trigger:", err));
      }
      if (docType === "wound_pictures") {
        const { url } = await getDocumentSignedUrl(result.document.filePath);
        if (url)
          setWoundPhotoUrls((prev) => ({
            ...prev,
            [result.document!.id]: url,
          }));
      }
    } else {
      toast.error(result.error ?? "Upload failed.");
    }
  }

  function handleAddProductToDraft(prod: ProductRecord) {
    const unitPrice = Number(prod.unit_price);
    setDraftItems((prev) => {
      const existing = prev.find((i) => i.productId === prod.id);
      if (existing) {
        return prev.map((i) =>
          i.productId === prod.id
            ? { ...i, quantity: i.quantity + 1, subtotal: i.unitPrice * (i.quantity + 1), totalAmount: i.unitPrice * (i.quantity + 1) }
            : i,
        );
      }
      return [
        ...prev,
        {
          id: `draft-${prod.id}-${Date.now()}`,
          productId: prod.id,
          productName: prod.name,
          productSku: prod.sku,
          hcpcsCode: prod.hcpcs_code ?? null,
          unitPrice,
          quantity: 1,
          subtotal: unitPrice,
          totalAmount: unitPrice,
          isNew: true,
        },
      ];
    });
  }

  async function handleSubmitOrder() {
    if (draftItems.length === 0) {
      toast.error("Add at least one product in the Order Form tab before submitting.", {
        duration: 4000,
      });
      setTab("order-form");
      return;
    }
    if (hasAnyUnsavedChanges) {
      toast.error(
        `You have unsaved changes in: ${dirtyTabs.join(", ")}. Please save or discard them before submitting.`,
        { duration: 5000 },
      );
      if (isOverviewDirty) setTab("overview");
      else if (isOrderFormDirty) setTab("order-form");
      else if (isIvrDirty) setTab("ivr");
      else if (isHcfaDirty) setTab("hcfa");
      return;
    }
    const hasFacesheet = documents.some((d) => d.documentType === "facesheet");
    const facesheetOk = order.manual_input || hasFacesheet;
    if (!facesheetOk || !order.date_of_service || !order.wound_type) {
      setCompletionOpen(true);
      return;
    }
    setSubmitting(true);
    const result = await submitForSignature(order.id);
    if (result.success) {
      toast.success("Order submitted for signature.");
      await refreshOrder();
    } else toast.error(result.error ?? "Failed to submit.");
    setSubmitting(false);
  }

  async function handleSignAndSubmit() {
    if (draftItems.length === 0) {
      toast.error("Add at least one product in the Order Form tab before signing.", { duration: 4000 });
      setTab("order-form");
      return;
    }
    if (hasAnyUnsavedChanges) {
      toast.error(
        `You have unsaved changes in: ${dirtyTabs.join(", ")}. Please save or discard them before signing.`,
        { duration: 5000 },
      );
      if (isOverviewDirty) setTab("overview");
      else if (isOrderFormDirty) setTab("order-form");
      else if (isIvrDirty) setTab("ivr");
      else if (isHcfaDirty) setTab("hcfa");
      return;
    }
    const hasFacesheet = documents.some((d) => d.documentType === "facesheet");
    const facesheetOk = order.manual_input || hasFacesheet;
    if (!facesheetOk || !order.date_of_service || !order.wound_type) {
      setCompletionOpen(true);
      return;
    }
    setSubmitting(true);
    const { unsignedForms } = await getUnsignedForms(order.id);
    if (unsignedForms.length > 0) {
      setSubmitting(false);
      setUnsignedFormsList(unsignedForms);
      setUnsignedFormsOpen(true);
      return;
    }
    const result = await submitSignedOrder(order.id);
    setSubmitting(false);
    if (result.success) {
      toast.success("Order submitted for review.");
      dispatch(updateOrderInStore({ ...liveOrder, order_status: "manufacturer_review" }));
      await refreshOrder();
    } else {
      toast.error(result.error ?? "Failed to submit order.");
    }
  }

  function handleClose() {
    if (hasAnyUnsavedChanges) {
      setCloseWarningOpen(true);
      return;
    }
    onClose();
  }

  async function handleDelete() {
    setIsDeleting(true);
    try {
      await deleteOrder(order.id);
      dispatch(removeOrderFromStore(order.id));
      toast.success(`Order ${order.order_number} deleted.`);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete.");
    } finally {
      setIsDeleting(false);
      setDeleteOpen(false);
    }
  }

  function draftQtyChange(itemId: string, newQty: number) {
    if (newQty < 1) return;
    setDraftItems((prev) =>
      prev.map((i) =>
        i.id === itemId
          ? {
              ...i,
              quantity: newQty,
              subtotal: newQty * i.unitPrice,
              totalAmount: newQty * i.unitPrice,
            }
          : i,
      ),
    );
  }

  function draftDeleteItem(itemId: string) {
    setDraftItems((prev) => prev.filter((i) => i.id !== itemId));
  }

  function handleDiscardOverview() {
    setDraftItems(savedItems);
    setDraftNotes(savedNotes);
  }

  async function handleSaveOverview() {
    setIsSavingOverview(true);
    try {
      const errors: string[] = [];

      // 1. Add NEW items (isNew = true)
      const newItems = draftItems.filter((i) => i.isNew);
      if (newItems.length > 0) {
        const result = await addOrderItems(
          order.id,
          newItems.map((item) => ({
            product_id: item.productId,
            product_name: item.productName,
            product_sku: item.productSku,
            hcpcs_code: item.hcpcsCode ?? null,
            unit_price: item.unitPrice,
            quantity: item.quantity,
          })),
        );
        if (!result.success) {
          errors.push(result.error ?? "Failed to add products");
        }
      }

      // 2. Update CHANGED quantities (existing items)
      const qtyChanges = draftItems.filter((draft) => {
        if (draft.isNew) return false;
        const saved = savedItems.find((s) => s.id === draft.id);
        return saved && saved.quantity !== draft.quantity;
      });
      for (const item of qtyChanges) {
        const result = await updateOrderItemQuantity(item.id, item.quantity);
        if (!result.success) {
          errors.push(`Failed to update qty: ${item.productName}`);
        }
      }

      // 3. Delete REMOVED items (in savedItems but not draftItems)
      const deletedIds = savedItems
        .filter((s) => !draftItems.find((d) => d.id === s.id))
        .map((s) => s.id);
      for (const id of deletedIds) {
        const result = await deleteOrderItem(id);
        if (!result.success) {
          errors.push("Failed to remove item");
        }
      }

      // 4. Save NOTES if changed
      if (draftNotes !== savedNotes) {
        const result = await updateOrderClinicalFields(order.id, {
          notes: draftNotes || null,
        });
        if (!result.success) {
          errors.push(result.error ?? "Failed to save notes");
        }
      }

      if (errors.length > 0) {
        toast.error(errors[0]);
      } else {
        toast.success("Changes saved");
        setSavedNotes(draftNotes);

        // Product changes alter what prints on the Order Form and the
        // Delivery Invoice — both draw their line items from order_items.
        // Regenerate fire-and-forget so the right-side cards show the
        // spinner via the pdf-regenerating listener, then flip green via
        // the regen-done refreshDocuments call. Skipped for notes-only
        // saves since neither PDF renders notes.
        const hasItemChanges =
          newItems.length > 0 || qtyChanges.length > 0 || deletedIds.length > 0;
        if (hasItemChanges) {
          for (const [cardType, formType] of [
            ["order_form", "order_form"],
            ["delivery_invoice", "delivery_invoice"],
          ] as const) {
            window.dispatchEvent(
              new CustomEvent("pdf-regenerating", {
                detail: { type: cardType, status: "start" },
              }),
            );
            fetch("/api/generate-pdf", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orderId: order.id, formType }),
            })
              .catch((err) =>
                console.error(`[Overview] ${formType} PDF regen failed:`, err),
              )
              .finally(() => {
                window.dispatchEvent(
                  new CustomEvent("pdf-regenerating", {
                    detail: { type: cardType, status: "done" },
                  }),
                );
              });
          }
        }

        await refreshOrder();
        // refreshOrder → updateOrderInStore → useEffect → setSavedItems + setDraftItems
        // (temp draft IDs replaced by real IDs from DB)
      }
    } finally {
      setIsSavingOverview(false);
    }
  }

  async function refreshOrder() {
    const updated = await getOrderById(order.id);
    if (updated) dispatch(updateOrderInStore(updated));
  }

  async function handleInitiatePayment(method: "pay_now" | "net_30") {
    setInitiatingPayment(method);

    try {
      const methodResult = await setOrderPaymentMethod(order.id, method);
      if (!methodResult.success) {
        toast.error(methodResult.error ?? "Failed to set payment method.");
        return;
      }

      const returnUrl = window.location.pathname + window.location.search;
      const result = await initiatePayment(order.id, returnUrl);

      if (!result.success) {
        toast.error(result.error ?? "Failed to initiate payment.");
        return;
      }

      if (method === "pay_now" && result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
        return;
      }

      if (method === "net_30") {
        toast.success("Invoice created. Payment due in 30 days.");
        const [newPayment, newInvoice] = await Promise.all([
          getOrderPayment(order.id),
          getOrderInvoice(order.id),
        ]);
        setPaymentData(newPayment);
        setInvoiceData(newInvoice);
        await refreshOrder();
      }
    } finally {
      setInitiatingPayment(false);
    }
  }

  async function handleMarkDelivered() {
    setMarkingDelivered(true);
    const result = await markOrderDelivered(liveOrder.id);
    setMarkingDelivered(false);
    if (result.success) {
      toast.success("Order marked as delivered.");
      await refreshOrder();
    } else {
      toast.error(result.error ?? "Failed to mark order as delivered.");
    }
  }

  async function refreshDocuments() {
    const docs = await getOrderDocuments(order.id);
    setDocuments(docs);
    setLocalDocuments(docs);
    const photos = docs.filter((d) => d.documentType === "wound_pictures");
    const urlMap: Record<string, string> = {};
    await Promise.all(
      photos.map(async (p) => {
        if (!woundPhotoUrls[p.id]) {
          const { url } = await getDocumentSignedUrl(p.filePath);
          if (url) urlMap[p.id] = url;
        } else {
          urlMap[p.id] = woundPhotoUrls[p.id];
        }
      }),
    );
    setWoundPhotoUrls(urlMap);
  }

  function handleAction(
    fn: () => Promise<{ success: boolean; error?: string }>,
    successMsg: string,
  ) {
    setIsActing(true);
    startTransition(async () => {
      try {
        const result = await fn();
        if (result.success) {
          toast.success(successMsg);
          await refreshOrder();
        } else {
          toast.error(result.error ?? "Action failed.");
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Unexpected error.");
      } finally {
        setIsActing(false);
      }
    });
  }

  /* ── Derived ── */
  const status = liveOrder.order_status;
  const displayStatus = getDisplayOrderStatus(liveOrder);
  // Invoice tab + doc card only show once the order is past the early
  // drafting stages — see INVOICE_VISIBLE_STATUSES.
  const invoiceUnlocked = isInvoiceVisibleForStatus(status);
  // HCFA / 1500 tab gate: only visible once the order has been delivered, and
  // only to roles that participate in the billing workflow. Sales reps are
  // intentionally excluded — they don't touch claim forms. The form is
  // pre-populated server-side when the order transitions to "delivered" and
  // editable by anyone who can see it (no separate edit-only check).
  const hcfaVisible =
    status === "delivered" && (isClinical || isAdmin || isSupport);
  const visibleTabs = TABS.filter((t) => {
    if (t.value === "hcfa") return hcfaVisible;
    if (t.value === "invoice") return invoiceUnlocked;
    return true;
  });
  const visibleRequiredDocTypes = (isProvider
    ? REQUIRED_DOC_TYPES.filter((d) => {
        if (d.type === "facesheet" || d.type === "clinical_docs") {
          return localDocuments.some((ld) => ld.documentType === d.type);
        }
        return true;
      })
    : REQUIRED_DOC_TYPES
  )
    .filter((d) => d.type !== "delivery_invoice" || invoiceUnlocked)
    // form_1500 doc card mirrors the HCFA tab visibility — only relevant
    // once the order is delivered, and only to billing-workflow roles. Sales
    // reps still don't reach this code path.
    .filter((d) => d.type !== "form_1500" || hcfaVisible);
  const isOverviewDirty =
    draftItems.some((i) => i.isNew) ||
    draftItems.some((draft) => {
      if (draft.isNew) return false;
      const saved = savedItems.find((s) => s.id === draft.id);
      return saved && saved.quantity !== draft.quantity;
    }) ||
    savedItems.some((s) => !draftItems.find((d) => d.id === s.id)) ||
    draftNotes !== savedNotes;
  const hasAnyUnsavedChanges =
    isOverviewDirty || isOrderFormDirty || isIvrDirty || isHcfaDirty;
  const dirtyTabs = [
    ...(isOverviewDirty ? ["Overview"] : []),
    ...(isOrderFormDirty ? ["Order Form"] : []),
    ...(isIvrDirty ? ["IVR Form"] : []),
    ...(isHcfaDirty ? ["HCFA/1500"] : []),
  ];
  const tabDirtyMap: Record<string, boolean> = {
    overview: isOverviewDirty,
    "order-form": isOrderFormDirty,
    ivr: isIvrDirty,
    hcfa: isHcfaDirty,
  };
  const orderTotal = draftItems.reduce((sum, item) => {
    return sum + (item.subtotal ?? item.unitPrice * item.quantity);
  }, 0);
  const docCount = documents.length;
  const msgCount = messages.length;
  const additionalDocs = documents.filter(
    (d) =>
      d.documentType === "other" ||
      !REQUIRED_DOC_TYPES.some((r) => r.type === d.documentType),
  );
  const woundPhotos = documents.filter(
    (d) => d.documentType === "wound_pictures",
  );
  const groupedDocs = documents.reduce<Record<string, IOrderDocument[]>>(
    (acc, d) => {
      if (!acc[d.documentType]) acc[d.documentType] = [];
      acc[d.documentType].push(d);
      return acc;
    },
    {},
  );

  /* ── Render ── */
  return (
    <>
      <OrderCompletionGuide
        open={completionOpen}
        onClose={() => setCompletionOpen(false)}
        onGoToTab={(t) => {
          setCompletionOpen(false);
          setTab(t as TabValue);
        }}
        order={order}
        documents={documents}
      />
      <ConfirmModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Order?"
        description={`Order ${order.order_number} will be permanently deleted.`}
        confirmLabel="Delete"
        isLoading={isDeleting}
        onConfirm={handleDelete}
      />
      <ConfirmModal
        open={!!itemToDelete}
        onOpenChange={(v) => {
          if (!v) setItemToDelete(null);
        }}
        title="Remove Product"
        description={`Remove "${itemToDelete?.name}" from this order?`}
        confirmLabel="Remove"
        onConfirm={() => {
          if (!itemToDelete) return;
          draftDeleteItem(itemToDelete.id);
          setItemToDelete(null);
        }}
      />
      <ConfirmModal
        open={closeWarningOpen}
        onOpenChange={setCloseWarningOpen}
        title="Unsaved Changes"
        description={`You have unsaved changes in: ${dirtyTabs.join(", ")}. Discard all changes and close?`}
        confirmLabel="Discard & Close"
        cancelLabel="Continue Editing"
        onConfirm={() => {
          handleDiscardOverview();
          setIsIvrDirty(false);
          setIsHcfaDirty(false);
          setIsOrderFormDirty(false);
          setResetIvrKey((k) => k + 1);
          setResetHcfaKey((k) => k + 1);
          setCloseWarningOpen(false);
          onClose();
        }}
      />
      <SignOrderModal
        open={signOpen}
        onOpenChange={setSignOpen}
        order={order}
        providerName={currentUserName ?? "Provider"}
        onSuccess={refreshOrder}
      />
      {/* Unsigned forms blocking modal */}
      <Dialog open={unsignedFormsOpen} onOpenChange={setUnsignedFormsOpen}>
        <DialogContent className="max-w-sm rounded-2xl border-0 shadow-2xl p-0 overflow-hidden">
          <div className="h-1 w-full bg-gradient-to-r from-amber-400 via-orange-400 to-red-400" />
          <div className="p-6 space-y-4">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-800">
                Forms Require Physician Signature
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-slate-600">
              All forms must be signed by the physician before the order can be submitted. The following forms are missing a physician signature:
            </p>
            <ul className="space-y-2">
              {unsignedFormsList.map((name) => (
                <li key={name} className="flex items-center gap-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                  {name} — not signed
                </li>
              ))}
            </ul>
            <p className="text-xs text-slate-500">
              Open each form, sign it using your provider PIN, and save the form before submitting.
            </p>
            <button
              onClick={() => setUnsignedFormsOpen(false)}
              className="w-full px-4 py-2.5 bg-slate-800 text-white text-sm font-medium rounded-xl hover:bg-slate-700 transition-colors"
            >
              OK, I&apos;ll sign the forms
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <ApproveOrderModal
        open={approveOpen}
        onOpenChange={setApproveOpen}
        order={order}
        onSuccess={refreshOrder}
      />
      <AddShippingModal
        open={shipOpen}
        onOpenChange={setShipOpen}
        order={order}
        onSuccess={refreshOrder}
      />

      {/* Raw Radix Root — no sizing constraints from shadcn DialogContent */}
      <RadixDialog.Root
        open={open}
        onOpenChange={(v) => {
          if (!v) handleClose();
        }}
      >
        <DialogPortal>
          <DialogOverlay />
          <RadixDialog.Content
            aria-describedby={undefined}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 outline-none"
          >
            <DialogTitle className="sr-only">
              Order {order.order_number}
            </DialogTitle>

            <div className="bg-[var(--surface)] w-[95vw] max-w-[1200px] h-[90vh] rounded-[14px] shadow-xl border border-[var(--border)] overflow-hidden flex flex-col">
              {/* ════════ FULL-WIDTH HEADER ════════ */}
              <div className="flex-shrink-0 px-6 py-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface)]">
                <div className="min-w-0">
                  <h2 className="text-[16px] font-semibold text-[var(--navy)] truncate">
                    {patientName ?? "No Patient"}
                  </h2>
                  <p
                    className="text-[12px] text-[var(--text3)] mt-0.5"
                    style={{ fontFamily: "var(--font-dm-mono), monospace" }}
                  >
                    {order.order_number}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <OrderStatusBadge status={displayStatus} />
                  <button
                    onClick={handleClose}
                    className="w-8 h-8 rounded-[7px] hover:bg-[var(--bg)] transition-colors flex items-center justify-center"
                  >
                    <X className="w-4 h-4 text-[var(--text2)]" />
                  </button>
                </div>
              </div>

              {/* ════════ TWO-COLUMN BODY ════════ */}
              <div className="flex flex-1 overflow-hidden">
                {/* ──── LEFT COLUMN: Tabs ──── */}
                <div className="flex-1 flex flex-col border-r border-[var(--border)] overflow-hidden min-w-0">
                  {aiStatus === "processing" ? (
                    /* Extraction in progress — block all tab interaction */
                    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-10">
                      <Loader2 className="w-10 h-10 text-[var(--navy)] animate-spin" />
                      <div className="text-center space-y-1">
                        <p className="text-[14px] font-semibold text-[var(--navy)]">AI is analyzing your documents</p>
                        <p className="text-[13px] text-[var(--text2)]">Forms will be auto-filled and ready shortly — please wait</p>
                        <p className="text-[11px] text-[var(--text3)] mt-2">This usually takes 30–60 seconds</p>
                      </div>
                    </div>
                  ) : (
                    <>
                  {/* Tab bar */}
                  <div className="flex-shrink-0 border-b border-[var(--border)] px-3 py-2">
                    <div
                      className="flex gap-[3px] overflow-x-auto rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)] p-1"
                      style={{ scrollbarWidth: "none" }}
                    >
                      {visibleTabs.map((t) => {
                        const isChat = t.value === "conversation";
                        const badge =
                          isChat && unreadCount > 0 ? unreadCount : 0;
                        const isDirtyTab = tabDirtyMap[t.value] ?? false;
                        return (
                          <button
                            key={t.value}
                            onClick={() => handleTabChange(t.value)}
                            className={cn(
                              "flex items-center gap-1.5 whitespace-nowrap rounded-[7px] px-3 py-[6px] text-[12px] font-medium transition-all duration-150 shrink-0",
                              tab === t.value
                                ? "bg-[var(--navy)] text-white"
                                : "text-[var(--text2)] hover:bg-[var(--bg)]",
                            )}
                          >
                            {t.label}
                            {isDirtyTab && (
                              <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold)] inline-block" />
                            )}
                            {badge > 0 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-[var(--red)] text-white">
                                {badge}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Tab content */}
                  <div className="flex-1 relative overflow-hidden">
                    <OrderOverviewTab
                      isActive={tab === "overview"}
                      order={order}
                      liveOrder={liveOrder}
                      documents={localDocuments}
                      orderForm={orderForm}
                      ivrData={ivrData}
                      history={history}
                    />
                    <OrderFormTab
                      isActive={tab === "order-form"}
                      aiStatus={aiStatus}
                      orderForm={orderForm}
                      order={liveOrder}
                      canEdit={effectiveCanEdit}
                      canSign={effectiveCanSign}
                      isAdmin={isAdmin}
                      currentUserName={currentUserName ?? null}
                      patientName={patientName}
                      onSaved={(updated) => {
                        setOrderForm(updated);
                        setIsOrderFormDirty(false);
                      }}
                      onDirtyChange={setIsOrderFormDirty}
                    />
                    <IVRTab
                      isActive={tab === "ivr"}
                      order={liveOrder}
                      canEdit={effectiveCanEdit}
                      canSign={effectiveCanSign}
                      currentUserName={currentUserName ?? null}
                      ivrData={ivrData}
                      resetIvrKey={resetIvrKey}
                      isReady={loadedTabs.has("ivr")}
                      isExtracting={false}
                      onDirtyChange={setIsIvrDirty}
                      onSave={async (saved) => {
                        setIvrData(saved);
                        setIsIvrDirty(false);
                      }}
                    />
                    <HCFATab
                      isActive={tab === "hcfa"}
                      order={liveOrder}
                      // HCFA edit/visibility is gated only by the role + status
                      // rule in `hcfaVisible`. Anyone who can see the tab can
                      // edit it. Box 31 (physician signature) is intentionally
                      // left blank — billers handle that downstream.
                      canEdit={hcfaVisible}
                      canSign={false}
                      currentUserName={currentUserName ?? null}
                      hcfaData={hcfaData}
                      resetHcfaKey={resetHcfaKey}
                      isReady={loadedTabs.has("hcfa")}
                      isExtracting={false}
                      onDirtyChange={setIsHcfaDirty}
                      onSave={async (saved) => {
                        setHcfaData(saved);
                        setIsHcfaDirty(false);
                      }}
                    />
                    {invoiceUnlocked && (
                      <InvoiceTab
                        isActive={tab === "invoice"}
                        order={liveOrder}
                        currentUserName={currentUserName ?? null}
                        isAdmin={isAdmin}
                        isProvider={isProvider}
                        // Clinical staff = anyone on the clinic side who isn't
                        // the provider themselves. They can capture the patient
                        // signature on the provider's behalf at hand-off.
                        isClinicalStaff={isClinical && !isProvider}
                      />
                    )}
                    <OrderChatTab
                      isActive={tab === "conversation"}
                      isReady={loadedTabs.has("conversation")}
                      messages={messages}
                      newMessage={newMessage}
                      sendingMsg={sendingMsg}
                      currentUserId={currentUserId}
                      isAdmin={isAdmin}
                      canSign={canSign}
                      isClinical={isClinical}
                      isRep={isRep}
                      messagesEndRef={messagesEndRef}
                      onNewMessageChange={setNewMessage}
                      onSend={handleSendMessage}
                    />
                    <OrderHistoryTab
                      isActive={tab === "history"}
                      isReady={loadedTabs.has("history")}
                      history={history}
                    />
                  </div>
                  {/* end tab content */}
                    </>
                  )}

                  {/* ── Footer: action buttons ── */}
                  <div className="flex-shrink-0 px-5 py-3 border-t border-[var(--border)] flex items-center justify-end bg-[var(--surface)]">
                    <div className="flex items-center gap-2">
                      {/* Delete Order — draft, clinic only */}
                      {isClinical && status === "draft" && (
                        <button
                          onClick={() => setDeleteOpen(true)}
                          className="px-4 py-[7px] text-[var(--red)] font-medium text-[13px] hover:bg-[var(--red-lt)] rounded-[7px] transition-colors"
                        >
                          Delete Order
                        </button>
                      )}

                      {/* Submit / Sign & Submit — draft, clinic only */}
                      {isClinical && status === "draft" && (
                        canSign ? (
                          /* Provider: single-step sign & submit */
                          <button
                            onClick={handleSignAndSubmit}
                            disabled={submitting}
                            className={cn(
                              "px-5 py-[7px] font-medium rounded-[7px] text-[13px] flex items-center gap-2 transition-all",
                              submitting
                                ? "bg-[var(--border)] text-[var(--text3)] cursor-not-allowed"
                                : "bg-[var(--navy)] text-white hover:bg-[var(--navy)]/90 active:scale-[0.98]",
                            )}
                          >
                            {submitting && (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            )}
                            Submit Order
                          </button>
                        ) : (
                          /* Staff: two-step submit (to pending_signature) */
                          <button
                            onClick={handleSubmitOrder}
                            disabled={submitting}
                            className={cn(
                              "px-5 py-[7px] font-medium rounded-[7px] text-[13px] flex items-center gap-2 transition-all",
                              submitting
                                ? "bg-[var(--border)] text-[var(--text3)] cursor-not-allowed"
                                : "bg-[var(--navy)] text-white hover:bg-[var(--navy)]/90 active:scale-[0.98]",
                            )}
                          >
                            {submitting && (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            )}
                            Submit Order
                          </button>
                        )
                      )}

                      {/* Recall to Draft — pending_signature, clinic only */}
                      {isClinical && status === "pending_signature" && (
                        <button
                          onClick={() =>
                            handleAction(
                              () => recallOrder(order.id),
                              "Order recalled to draft.",
                            )
                          }
                          disabled={isActing}
                          className="px-4 py-[7px] text-[var(--text2)] font-medium text-[13px] hover:text-[var(--text)] hover:bg-[var(--bg)] rounded-[7px] transition-colors disabled:opacity-60"
                        >
                          Recall to Draft
                        </button>
                      )}

                      {/* Sign Order — pending_signature, provider only */}
                      {canSign && status === "pending_signature" && (
                        <button
                          onClick={async () => {
                            setSubmitting(true);
                            const { unsignedForms } = await getUnsignedForms(order.id);
                            if (unsignedForms.length > 0) {
                              setSubmitting(false);
                              setUnsignedFormsList(unsignedForms);
                              setUnsignedFormsOpen(true);
                              return;
                            }
                            const result = await submitSignedOrder(order.id);
                            setSubmitting(false);
                            if (result.success) {
                              toast.success("Order signed and submitted for review.");
                              refreshOrder();
                            } else {
                              toast.error(result.error ?? "Failed to submit order.");
                            }
                          }}
                          disabled={submitting}
                          className={cn(
                            "px-5 py-[7px] font-medium rounded-[7px] text-[13px] flex items-center gap-2 transition-all",
                            submitting
                              ? "bg-[var(--border)] text-[var(--text3)] cursor-not-allowed"
                              : "bg-[var(--navy)] text-white hover:bg-[var(--navy)]/90 active:scale-[0.98]",
                          )}
                        >
                          {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          Sign Order
                        </button>
                      )}

                      {/* Resubmit for Review — additional_info_needed, clinic only */}
                      {isClinical && status === "additional_info_needed" && (
                        <button
                          onClick={() =>
                            handleAction(
                              () => resubmitForReview(order.id),
                              "Resubmitted for review.",
                            )
                          }
                          disabled={isActing}
                          className="px-5 py-[7px] bg-[var(--navy)] text-white font-medium rounded-[7px] hover:bg-[var(--navy)]/90 active:scale-[0.98] transition-all text-[13px] disabled:opacity-60"
                        >
                          Resubmit for Review
                        </button>
                      )}

                      {/* Admin: manufacturer_review actions */}
                      {isAdmin && status === "manufacturer_review" && (
                        <>
                          <button
                            onClick={() => {
                              setRequestInfoReason("");
                              setRequestInfoOpen(true);
                            }}
                            disabled={isActing}
                            className="px-4 py-[7px] text-[var(--text2)] font-medium text-[13px] hover:text-[var(--text)] hover:bg-[var(--bg)] rounded-[7px] transition-colors disabled:opacity-60 border border-[var(--border2)]"
                          >
                            Request Info
                          </button>
                          <button
                            onClick={() => setApproveOpen(true)}
                            className="px-5 py-[7px] bg-[var(--teal)] text-white font-medium rounded-[7px] hover:bg-[var(--teal)]/90 active:scale-[0.98] transition-all text-[13px]"
                          >
                            Approve Order
                          </button>
                        </>
                      )}

                      {/* Admin/support: add shipping */}
                      {(isAdmin || isSupport) && status === "approved" && (
                        <button
                          onClick={() => setShipOpen(true)}
                          className="px-5 py-[7px] bg-[var(--navy)] text-white font-medium rounded-[7px] hover:bg-[var(--navy)]/90 active:scale-[0.98] transition-all text-[13px]"
                        >
                          Add Shipping Info
                        </button>
                      )}

                      {/* Admin/support: mark delivered */}
                      {(isAdmin || isSupport) && status === "shipped" && (
                        <button
                          onClick={handleMarkDelivered}
                          disabled={markingDelivered}
                          className="px-5 py-[7px] bg-[var(--teal)] text-white font-medium rounded-[7px] hover:bg-[var(--teal)]/90 active:scale-[0.98] transition-all text-[13px] disabled:opacity-60 flex items-center gap-2"
                        >
                          {markingDelivered ? (
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : null}
                          {markingDelivered ? "Marking..." : "Mark as Delivered"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                {/* end left column */}

                {/* ──── RIGHT COLUMN: Summary panel ──── */}
                <div className="w-[360px] flex-shrink-0 flex flex-col bg-[var(--bg)] overflow-hidden">
                  {/* Right header */}
                  <div className="flex-shrink-0 p-5 border-b border-[var(--border)]">
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <OrderStatusBadge status={displayStatus} />
                    </div>
                    <div className="flex gap-5">
                      <div>
                        <p className="text-[10px] text-[var(--text3)] mb-[3px] flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> Date of Service
                        </p>
                        <p className="text-[12px] font-semibold text-[var(--text)]">
                          {order.date_of_service ?? "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[var(--text3)] mb-[3px] flex items-center gap-1">
                          <Building2 className="w-3 h-3" /> Clinic
                        </p>
                        <p className="text-[12px] font-semibold text-[var(--text)] truncate max-w-[140px]">
                          {order.facility_name || "—"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Right scrollable body */}
                  <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    {/* Document status buttons */}
                    <div>
                      <h3 className="text-[10px] font-semibold uppercase tracking-[0.6px] text-[var(--text3)] mb-3">
                        Documents
                      </h3>
                      {loadingDocs ? (
                        <div className="grid grid-cols-2 gap-2">
                          {visibleRequiredDocTypes.map((d) => (
                            <div
                              key={d.type}
                              className="h-10 rounded-[9px] bg-[var(--border)] animate-pulse"
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          {visibleRequiredDocTypes.map((doc) => {
                            const typeDocs = localDocuments.filter(
                              (d) => d.documentType === doc.type,
                            );
                            const uploaded = typeDocs.length > 0;
                            const docRecord =
                              typeDocs.find((d) =>
                                d.filePath?.includes("/generated/"),
                              ) ?? typeDocs[0];
                            const isViewLoading =
                              viewingDocId === docRecord?.id;
                            const isPdfGenerating =
                              generatingPdfTypes.has(doc.type);
                            const isRegenerableType = [
                              "order_form",
                              "form_1500",
                              "additional_ivr",
                              "delivery_invoice",
                            ].includes(doc.type);
                            const isAiGenerating =
                              isRegenerableType &&
                              !uploaded &&
                              !isPdfGenerating &&
                              liveOrder.ai_extracted &&
                              !aiWindowExpired;
                            return (
                              <div key={doc.type} className="relative">
                                <button
                                  type="button"
                                  disabled={
                                    (!uploaded &&
                                      !isPdfGenerating &&
                                      !isAiGenerating) ||
                                    isViewLoading ||
                                    isPdfGenerating ||
                                    isAiGenerating
                                  }
                                  onClick={() =>
                                    uploaded &&
                                    !isPdfGenerating &&
                                    !isAiGenerating &&
                                    handleViewDocument(doc.type)
                                  }
                                  className={cn(
                                    "flex items-center gap-2 px-2.5 py-2.5 rounded-[9px] border text-[11px] font-medium text-left w-full transition-colors",
                                    isPdfGenerating || isAiGenerating
                                      ? "bg-[var(--blue-lt)] border-[var(--blue-lt)] text-[var(--blue)] cursor-wait"
                                      : uploaded
                                        ? "bg-[var(--green-lt)] border-[var(--green-border)] text-[var(--green)] hover:opacity-80 cursor-pointer"
                                        : "bg-[var(--gold-lt)] border-[var(--gold-border)] text-[var(--gold)] cursor-default",
                                    isViewLoading && "opacity-60",
                                  )}
                                >
                                  {isPdfGenerating || isAiGenerating ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                                  ) : isViewLoading ? (
                                    <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
                                  ) : uploaded ? (
                                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                  ) : (
                                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                  )}
                                  <span className="truncate">
                                    {isPdfGenerating || isAiGenerating
                                      ? "Generating..."
                                      : doc.label}
                                  </span>
                                </button>
                                {!uploaded &&
                                  !isPdfGenerating &&
                                  !isAiGenerating &&
                                  isRegenerableType &&
                                  aiStatus !== "processing" && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleRegeneratePdf(doc.type)
                                      }
                                      className="absolute top-1.5 right-2 p-0.5 rounded hover:bg-[var(--gold-border)] transition-colors"
                                      title="Regenerate PDF"
                                    >
                                      <RefreshCw className="w-3 h-3 text-[var(--gold)]" />
                                    </button>
                                  )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Additional documentation */}
                    <div>
                      <h3 className="text-[10px] font-semibold uppercase tracking-[0.6px] text-[var(--text3)] mb-2">
                        Additional Documentation
                      </h3>
                      {additionalDocs.length === 0 ? (
                        <p className="text-[12px] text-[var(--text3)]">
                          No additional documentation uploaded
                        </p>
                      ) : (
                        <div className="space-y-1.5 mb-3">
                          {additionalDocs.map((doc) => (
                            <button
                              key={doc.id}
                              type="button"
                              onClick={() => handleViewDoc(doc)}
                              className="text-[12px] text-[var(--navy)] hover:underline block truncate max-w-full text-left font-medium"
                            >
                              {doc.fileName}
                            </button>
                          ))}
                        </div>
                      )}
                      {(canEdit || isAdmin) && (
                        <label className="mt-2 flex items-center gap-2 w-full px-3 py-2 rounded-[7px] bg-[var(--navy)] text-white text-[12px] font-medium hover:bg-[var(--navy)]/90 transition-colors cursor-pointer">
                          <Paperclip className="w-3.5 h-3.5" />
                          Attach Additional Documentation
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*,.pdf,.doc,.docx"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleUploadDoc(f, "other");
                              e.target.value = "";
                            }}
                          />
                        </label>
                      )}
                    </div>

                    {/* ── Payment Section — persists through approved → shipped → delivered ── */}
                    {(status === "approved" ||
                      status === "shipped" ||
                      status === "delivered") && (
                      <div className="border-t border-[var(--border)] pt-4 space-y-3">
                        <h3 className="text-[10px] font-semibold uppercase tracking-[0.6px] text-[var(--text3)]">
                          Payment
                        </h3>

                        {/* TWO BUTTONS — only while order is approved AND no payment yet */}
                        {status === "approved" &&
                          !paymentData &&
                          liveOrder.payment_status !== "paid" && (
                            <div className="grid grid-cols-2 gap-2">
                              {/* Pay Now */}
                              <button
                                type="button"
                                disabled={initiatingPayment !== false}
                                onClick={() => handleInitiatePayment("pay_now")}
                                className="flex flex-col items-center gap-1.5 px-3 py-3 rounded-[9px] border-[1.5px] border-[var(--blue-lt)] bg-[var(--blue-lt)] hover:opacity-80 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {initiatingPayment === "pay_now" ? (
                                  <div className="w-5 h-5 border-2 border-[var(--blue)] border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <CreditCard className="w-5 h-5 text-[var(--blue)]" />
                                )}
                                <span className="text-[11px] font-semibold text-[var(--blue)] text-center leading-tight">
                                  {initiatingPayment === "pay_now"
                                    ? "Processing..."
                                    : "Pay Now"}
                                </span>
                              </button>

                              {/* Pay Later / Net-30 */}
                              <button
                                type="button"
                                disabled={initiatingPayment !== false}
                                onClick={() => handleInitiatePayment("net_30")}
                                className="flex flex-col items-center gap-1.5 px-3 py-3 rounded-[9px] border-[1.5px] border-[var(--purple-lt)] bg-[var(--purple-lt)] hover:opacity-80 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {initiatingPayment === "net_30" ? (
                                  <div className="w-5 h-5 border-2 border-[var(--purple)] border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <FileText className="w-5 h-5 text-[var(--purple)]" />
                                )}
                                <span className="text-[11px] font-semibold text-[var(--purple)] text-center leading-tight whitespace-pre-line">
                                  {initiatingPayment === "net_30"
                                    ? "Processing..."
                                    : "Pay Later\nNet-30"}
                                </span>
                              </button>
                            </div>
                          )}

                        {/* Resume Payment — Pay Now method, payment initiated but not paid.
                            Creates a fresh Stripe checkout session; the abandoned one
                            expires on Stripe's side on its own. */}
                        {status === "approved" &&
                          paymentData &&
                          liveOrder.payment_method === "pay_now" &&
                          liveOrder.payment_status !== "paid" && (
                            <button
                              type="button"
                              disabled={initiatingPayment !== false}
                              onClick={() => handleInitiatePayment("pay_now")}
                              className="w-full flex items-center justify-center gap-2 px-3 py-3 rounded-[9px] border-[1.5px] border-[var(--blue-lt)] bg-[var(--blue-lt)] hover:opacity-80 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {initiatingPayment === "pay_now" ? (
                                <div className="w-4 h-4 border-2 border-[var(--blue)] border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <CreditCard className="w-4 h-4 text-[var(--blue)]" />
                              )}
                              <span className="text-[12px] font-semibold text-[var(--blue)]">
                                {initiatingPayment === "pay_now" ? "Processing..." : "Resume Payment"}
                              </span>
                            </button>
                          )}

                        {/* Payment info — show after payment initiated or paid */}
                        {(paymentData ||
                          liveOrder.payment_status === "paid") && (
                          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[9px] px-3 py-3 space-y-2">
                            {/* Method */}
                            <div className="flex items-center justify-between">
                              <span className="text-[12px] text-[var(--text2)]">
                                Method
                              </span>
                              <PillBadge
                                label={liveOrder.payment_method === "pay_now" ? "Pay Now" : "Net-30"}
                                variant={liveOrder.payment_method === "pay_now" ? "blue" : "purple"}
                              />
                            </div>

                            {/* Status */}
                            <div className="flex items-center justify-between">
                              <span className="text-[12px] text-[var(--text2)]">
                                Status
                              </span>
                              <PillBadge
                                label={liveOrder.payment_status === "paid" ? "Paid" : "Pending"}
                                variant={liveOrder.payment_status === "paid" ? "green" : "gold"}
                              />
                            </div>

                            {/* Amount */}
                            {paymentData && (
                              <div className="flex items-center justify-between">
                                <span className="text-[12px] text-[var(--text2)]">
                                  Amount
                                </span>
                                <span
                                  className="text-[12px] font-semibold text-[var(--text)]"
                                  style={{ fontFamily: "var(--font-dm-mono), monospace" }}
                                >
                                  ${paymentData.amount.toFixed(2)}
                                </span>
                              </div>
                            )}

                            {/* Net-30: Due Date */}
                            {liveOrder.payment_method === "net_30" &&
                              invoiceData?.dueAt && (
                                <div className="flex items-center justify-between">
                                  <span className="text-[12px] text-[var(--text2)]">
                                    Due Date
                                  </span>
                                  <span
                                    className={cn(
                                      "text-[12px] font-semibold",
                                      liveOrder.payment_status !== "paid"
                                        ? "text-[var(--red)]"
                                        : "text-[var(--text3)] line-through",
                                    )}
                                  >
                                    {new Date(
                                      invoiceData.dueAt,
                                    ).toLocaleDateString("en-US", {
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                    })}
                                  </span>
                                </div>
                              )}

                            {/* Invoice number */}
                            {invoiceData?.invoiceNumber && (
                              <div className="flex items-center justify-between">
                                <span className="text-[12px] text-[var(--text2)]">
                                  Invoice
                                </span>
                                <span className="text-[12px] font-medium text-[var(--text)]">
                                  {invoiceData.invoiceNumber}
                                </span>
                              </div>
                            )}
                            {/* Paid At */}
                            {liveOrder.paid_at && (
                              <div className="flex items-center justify-between">
                                <span className="text-[12px] text-[var(--text2)]">
                                  Paid On
                                </span>
                                <span className="text-[12px] font-medium text-[var(--text)]">
                                  {new Date(
                                    liveOrder.paid_at,
                                  ).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })}
                                </span>
                              </div>
                            )}
                            {/* View Invoice button — Net-30 only */}
                            {liveOrder.payment_method === "net_30" &&
                              invoiceData?.hostedInvoiceUrl && (
                                <a
                                  href={invoiceData.hostedInvoiceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center justify-center gap-2 w-full mt-2 px-3 py-2 rounded-[7px] border border-[var(--purple-lt)] bg-[var(--purple-lt)] text-[var(--purple)] text-[11px] font-semibold hover:opacity-80 transition-colors"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                  View Invoice
                                </a>
                              )}

                            {/* View Receipt button — Pay Now only */}
                            {liveOrder.payment_method === "pay_now" &&
                              paymentData?.receiptUrl && (
                                <a
                                  href={paymentData.receiptUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center justify-center gap-2 w-full mt-2 px-3 py-2 rounded-[7px] border border-[var(--blue-lt)] bg-[var(--blue-lt)] text-[var(--blue)] text-[11px] font-semibold hover:opacity-80 transition-colors"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                  View Receipt
                                </a>
                              )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── Shipping Section — visible to all roles once an order
                        is shipped or delivered. Surfaces every column on the
                        shipments row, plus a clickable tracking link if the
                        carrier provided a tracking_url. */}
                    {(status === "shipped" || status === "delivered") && (
                      <div className="border-t border-[var(--border)] pt-4 space-y-2">
                        <h3 className="text-[10px] font-semibold uppercase tracking-[0.6px] text-[var(--text3)]">
                          Shipping
                        </h3>
                        <div className="space-y-1.5 text-[12px] text-[var(--text2)]">
                          {shipmentData?.status && (
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[var(--text3)]">Status</span>
                              <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium"
                                style={
                                  shipmentData.status === "delivered"
                                    ? { background: "var(--green-lt)", color: "var(--green)" }
                                    : shipmentData.status === "in_transit"
                                      ? { background: "var(--blue-lt)", color: "var(--blue)" }
                                      : shipmentData.status === "exception" || shipmentData.status === "returned"
                                        ? { background: "var(--red-lt)", color: "var(--red)" }
                                        : { background: "var(--gold-lt)", color: "var(--gold)" }
                                }
                              >
                                {shipmentData.status.replace(/_/g, " ")}
                              </span>
                            </div>
                          )}
                          {shipmentData?.carrier && (
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[var(--text3)]">Carrier</span>
                              <span className="font-medium text-[var(--text)]">
                                {shipmentData.carrier}
                              </span>
                            </div>
                          )}
                          {shipmentData?.service_level && (
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[var(--text3)]">Service</span>
                              <span className="font-medium text-[var(--text)]">
                                {shipmentData.service_level}
                              </span>
                            </div>
                          )}
                          {(shipmentData?.tracking_number || liveOrder.tracking_number) && (
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[var(--text3)]">Tracking #</span>
                              {shipmentData?.tracking_url ? (
                                <a
                                  href={shipmentData.tracking_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  referrerPolicy="no-referrer"
                                  className="font-medium text-[var(--blue)] hover:underline break-all text-right"
                                >
                                  {shipmentData?.tracking_number ?? liveOrder.tracking_number}
                                </a>
                              ) : (
                                <span className="font-medium text-[var(--text)] break-all text-right">
                                  {shipmentData?.tracking_number ?? liveOrder.tracking_number}
                                </span>
                              )}
                            </div>
                          )}
                          {shipmentData?.created_at && !shipmentData.shipped_at && (
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[var(--text3)]">Label created</span>
                              <span className="font-medium text-[var(--text)]">
                                {new Date(shipmentData.created_at).toLocaleString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                          )}
                          {shipmentData?.shipped_at && (
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[var(--text3)]">Shipped on</span>
                              <span className="font-medium text-[var(--text)]">
                                {new Date(shipmentData.shipped_at).toLocaleString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                          )}
                          {status === "shipped" && shipmentData?.estimated_delivery_at && (
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[var(--text3)]">Est. delivery</span>
                              <span className="font-medium text-[var(--text)]">
                                {new Date(shipmentData.estimated_delivery_at).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                          {(liveOrder.delivered_at || shipmentData?.delivered_at) && (
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[var(--text3)]">Delivered on</span>
                              <span className="font-medium text-[var(--green)]">
                                {new Date(
                                  liveOrder.delivered_at ?? shipmentData?.delivered_at ?? "",
                                ).toLocaleString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                          )}
                          {!shipmentData && !liveOrder.tracking_number && (
                            <p className="text-[12px] text-[var(--text3)]">
                              Shipping details not recorded.
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Wound photos */}
                    <div>
                      <h3 className="text-[10px] font-semibold uppercase tracking-[0.6px] text-[var(--text3)] mb-2">
                        Wound Photos
                      </h3>
                      {woundPhotos.length === 0 ? (
                        <p className="text-[12px] text-[var(--text3)]">
                          No wound photos uploaded
                        </p>
                      ) : (
                        <div className="grid grid-cols-3 gap-1.5">
                          {woundPhotos.map((photo) =>
                            woundPhotoUrls[photo.id] ? (
                              <button
                                key={photo.id}
                                type="button"
                                onClick={() =>
                                  window.open(
                                    woundPhotoUrls[photo.id],
                                    "_blank",
                                    "noopener,noreferrer",
                                  )
                                }
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={woundPhotoUrls[photo.id]}
                                  alt={photo.fileName}
                                  className="w-full aspect-square object-cover rounded-[var(--r)] border border-[var(--border)]"
                                />
                              </button>
                            ) : (
                              <div
                                key={photo.id}
                                className="w-full aspect-square rounded-[var(--r)] border border-[var(--border)] bg-[var(--bg)] animate-pulse"
                              />
                            ),
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right footer */}
                  <div className="flex-shrink-0 px-5 py-3 border-t border-[var(--border)]">
                    <button
                      type="button"
                      onClick={() => toast("ZIP download coming soon.")}
                      className="flex items-center gap-2 text-[12px] text-[var(--text3)] hover:text-[var(--text2)] transition-colors font-medium"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download ZIP
                    </button>
                  </div>
                </div>
                {/* end right column */}
              </div>
              {/* end two-column body */}
            </div>
          </RadixDialog.Content>
        </DialogPortal>
      </RadixDialog.Root>

      {/* ── Request Info reason modal ── */}
      <RadixDialog.Root
        open={requestInfoOpen}
        onOpenChange={(v) => {
          if (!requestingInfo) setRequestInfoOpen(v);
        }}
      >
        <RadixDialog.Portal>
          <RadixDialog.Overlay className="fixed inset-0 z-[55] bg-black/40" />
          <RadixDialog.Content
            aria-describedby={undefined}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 outline-none"
          >
            <div className="bg-[var(--surface)] rounded-[14px] border border-[var(--border)] shadow-xl w-full max-w-md p-5 mx-4">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <RadixDialog.Title className="text-[15px] font-semibold text-[var(--navy)]">
                    Request Additional Info
                  </RadixDialog.Title>
                  <p className="text-[12px] text-[var(--text3)] mt-0.5">
                    Describe what information is needed from the provider.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRequestInfoOpen(false)}
                  disabled={requestingInfo}
                  className="w-8 h-8 rounded-[7px] hover:bg-[var(--bg)] flex items-center justify-center disabled:opacity-50"
                >
                  <X className="w-4 h-4 text-[var(--text2)]" />
                </button>
              </div>

              {/* Textarea */}
              <textarea
                autoFocus
                value={requestInfoReason}
                onChange={(e) =>
                  setRequestInfoReason(e.target.value.slice(0, 500))
                }
                maxLength={500}
                rows={4}
                placeholder="e.g. Missing wound measurements, incomplete patient history..."
                className="w-full border border-[var(--border2)] rounded-[7px] px-4 py-3 text-[13px] resize-none focus:outline-none focus:border-[var(--accent)] placeholder:text-[var(--text3)]"
              />
              <p className="text-[11px] text-[var(--text3)] text-right mt-1">
                {requestInfoReason.length}/500
              </p>

              {/* Actions */}
              <div className="flex gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setRequestInfoOpen(false)}
                  disabled={requestingInfo}
                  className="flex-1 px-4 py-[7px] rounded-[7px] border border-[var(--border2)] text-[13px] font-medium text-[var(--text2)] hover:bg-[var(--bg)] transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={requestingInfo || !requestInfoReason.trim()}
                  onClick={async () => {
                    setRequestingInfo(true);
                    try {
                      await requestAdditionalInfo(
                        order.id,
                        requestInfoReason.trim(),
                      );
                      toast.success("Additional info requested.");
                      setRequestInfoOpen(false);
                      refreshOrder();
                    } catch {
                      toast.error("Failed to send request.");
                    } finally {
                      setRequestingInfo(false);
                    }
                  }}
                  className="flex-1 px-4 py-[7px] rounded-[7px] bg-[var(--gold)] text-white text-[13px] font-medium hover:bg-[var(--gold)]/80 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {requestingInfo && (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  Send Request
                </button>
              </div>
            </div>
          </RadixDialog.Content>
        </RadixDialog.Portal>
      </RadixDialog.Root>
    </>
  );
}
