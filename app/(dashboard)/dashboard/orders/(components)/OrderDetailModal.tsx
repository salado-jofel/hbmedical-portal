"use client";

import { useState, useEffect, useTransition } from "react";
import { useAppDispatch } from "@/store/hooks";
import { removeOrderFromStore, updateOrderInStore } from "../(redux)/orders-slice";
// Use raw Radix primitive so we own 100% of the sizing — shadcn DialogContent
// bakes in `sm:max-w-sm` via @media which cannot be overridden with className.
import { Dialog as RadixDialog } from "radix-ui";
import { DialogPortal, DialogOverlay, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  X,
  Package,
  Send,
  Upload,
  Trash2,
  ExternalLink,
  Loader2,
  User,
  Lock,
  AlertCircle,
  Plus,
  Minus,
  Check,
  Calendar,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Paperclip,
  Download,
} from "lucide-react";
import type {
  DashboardOrder,
  IOrderHistory,
  IOrderMessage,
  IOrderDocument,
  DocumentType,
  ProductRecord,
} from "@/utils/interfaces/orders";
import {
  getOrderMessages,
  getOrderHistory,
  getOrderDocuments,
  sendOrderMessage,
  uploadOrderDocument,
  deleteOrderDocument,
  getDocumentSignedUrl,
  submitForSignature,
  getProducts,
  addOrderItems,
  recallOrder,
  resubmitForReview,
  deleteOrder,
  requestAdditionalInfo,
  getOrderById,
} from "../(services)/actions";
import { OrderStatusBadge } from "./OrderStatusBadge";
import { OrderIVRForm } from "./OrderIVRForm";
import { Form1500Tab } from "./Form1500Tab";
import { OrderCompletionGuide } from "./OrderCompletionGuide";
import { SignOrderModal } from "./SignOrderModal";
import { ApproveOrderModal } from "./ApproveOrderModal";
import { AddShippingModal } from "./AddShippingModal";
import ConfirmModal from "@/app/(components)/ConfirmModal";
import toast from "react-hot-toast";
import { cn } from "@/utils/utils";

/* ── Constants ── */

const REQUIRED_DOC_TYPES = [
  { type: "facesheet",      label: "Facesheet" },
  { type: "additional_ivr", label: "Additional IVR Info" },
  { type: "clinical_docs",  label: "Clinical Docs" },
  { type: "form_1500",      label: "1500 Form" },
  { type: "order_form",     label: "Order Form" },
] as const;

const ALL_DOC_TYPES: Array<{ type: string; label: string }> = [
  { type: "facesheet",      label: "Facesheet" },
  { type: "clinical_docs",  label: "Clinical Docs" },
  { type: "order_form",     label: "Order Form" },
  { type: "additional_ivr", label: "Additional IVR Info" },
  { type: "form_1500",      label: "1500 Form" },
  { type: "wound_pictures", label: "Wound Pictures" },
  { type: "other",          label: "Other" },
];

const TABS = [
  { value: "overview",      label: "Overview" },
  { value: "order-form",    label: "Order Form" },
  { value: "ivr",           label: "IVR Form" },
  { value: "hcfa",          label: "HCFA/1500" },
  { value: "documents",     label: "Documents" },
  { value: "conversation",  label: "Chat" },
  { value: "history",       label: "History" },
] as const;

type TabValue = (typeof TABS)[number]["value"];
type SaveStatus = "idle" | "saving" | "saved" | "error";

/* ── Props ── */

interface OrderDetailModalProps {
  open: boolean;
  onClose: () => void;
  order: DashboardOrder;
  canSign: boolean;
  isAdmin: boolean;
  isClinical: boolean;
  canEdit: boolean;
  currentUserName?: string;
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
  currentUserName,
}: OrderDetailModalProps) {
  const dispatch = useAppDispatch();
  const [, startTransition] = useTransition();

  const [tab, setTab] = useState<TabValue>("overview");
  const [ivrSaveStatus, setIvrSaveStatus] = useState<SaveStatus>("idle");

  /* -- Documents (shared between Docs tab and right panel) -- */
  const [documents, setDocuments] = useState<IOrderDocument[]>([]);
  const [woundPhotoUrls, setWoundPhotoUrls] = useState<Record<string, string>>({});
  const [loadingDocs, setLoadingDocs] = useState(false);

  /* -- Messages (lazy-loaded on first chat visit) -- */
  const [messages, setMessages] = useState<IOrderMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [msgLoaded, setMsgLoaded] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);

  /* -- History (lazy-loaded) -- */
  const [history, setHistory] = useState<IOrderHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  /* -- Product picker -- */
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [addingProducts, setAddingProducts] = useState(false);

  /* -- Sub-modal flags -- */
  const [signOpen, setSignOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [shipOpen, setShipOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [completionOpen, setCompletionOpen] = useState(false);

  /* -- Loading flags -- */
  const [isActing, setIsActing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  /* ── Load documents when modal opens ── */
  useEffect(() => {
    if (!open) return;
    setTab("overview");
    setMsgLoaded(false);
    setHistoryLoaded(false);
    setIvrSaveStatus("idle");
    setShowProductPicker(false);
    setQuantities({});

    setLoadingDocs(true);
    getOrderDocuments(order.id).then(async (docs) => {
      setDocuments(docs);
      setLoadingDocs(false);
      const photos = docs.filter((d) => d.documentType === "wound_pictures");
      const urlMap: Record<string, string> = {};
      await Promise.all(
        photos.map(async (p) => {
          const { url } = await getDocumentSignedUrl(p.filePath);
          if (url) urlMap[p.id] = url;
        }),
      );
      setWoundPhotoUrls(urlMap);
    });
  }, [open, order.id]);

  /* ── Lazy load messages / history on tab switch ── */
  useEffect(() => {
    if (tab === "conversation" && !msgLoaded) {
      setLoadingMessages(true);
      getOrderMessages(order.id).then((msgs) => {
        setMessages(msgs);
        setLoadingMessages(false);
        setMsgLoaded(true);
      });
    }
    if (tab === "history" && !historyLoaded) {
      setLoadingHistory(true);
      getOrderHistory(order.id).then((hist) => {
        setHistory(hist);
        setLoadingHistory(false);
        setHistoryLoaded(true);
      });
    }
  }, [tab, msgLoaded, historyLoaded, order.id]);

  /* ── Load products when picker opens ── */
  useEffect(() => {
    if (!showProductPicker) return;
    setLoadingProducts(true);
    getProducts().then((p) => { setProducts(p); setLoadingProducts(false); });
  }, [showProductPicker]);

  /* ── Handlers ── */

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
    if (!doc) { toast("No document uploaded yet.", { icon: "ℹ️" }); return; }
    handleViewDoc(doc);
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

  async function handleUploadDoc(file: File, docType: string) {
    const fd = new FormData();
    fd.set("file", file);
    const result = await uploadOrderDocument(order.id, docType as DocumentType, fd);
    if (result.success && result.document) {
      setDocuments((prev) => [result.document!, ...prev]);
      toast.success("Document uploaded.");
      if (docType === "wound_pictures") {
        const { url } = await getDocumentSignedUrl(result.document.filePath);
        if (url) setWoundPhotoUrls((prev) => ({ ...prev, [result.document!.id]: url }));
      }
    } else {
      toast.error(result.error ?? "Upload failed.");
    }
  }

  async function handleAddProducts() {
    const items = Object.entries(quantities)
      .filter(([, q]) => q > 0)
      .map(([productId, quantity]) => {
        const prod = products.find((p) => p.id === productId)!;
        return { product_id: prod.id, product_name: prod.name, product_sku: prod.sku, unit_price: Number(prod.unit_price), quantity };
      });
    if (!items.length) return;
    setAddingProducts(true);
    const result = await addOrderItems(order.id, items);
    if (result.success) {
      toast.success("Products added. Reload to see updated items.");
      setShowProductPicker(false);
      setQuantities({});
    } else {
      toast.error(result.error ?? "Failed to add products.");
    }
    setAddingProducts(false);
  }

  async function handleEditAndSubmit() {
    const hasFacesheet = documents.some((d) => d.documentType === "facesheet");
    const hasProducts = (order.all_items?.length ?? 0) > 0;
    if (!hasFacesheet || !hasProducts || !order.date_of_service || !order.wound_type) {
      setCompletionOpen(true);
      return;
    }
    setSubmitting(true);
    const result = await submitForSignature(order.id);
    if (result.success) { toast.success("Order submitted for signature."); onClose(); }
    else toast.error(result.error ?? "Failed to submit.");
    setSubmitting(false);
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

  async function refreshOrder() {
    const updated = await getOrderById(order.id);
    if (updated) dispatch(updateOrderInStore(updated));
  }

  function handleAction(fn: () => Promise<{ success: boolean; error?: string }>, successMsg: string) {
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
  const status = order.order_status;
  const docCount = documents.length;
  const msgCount = messages.length;
  const additionalDocs = documents.filter(
    (d) => d.documentType === "other" || !REQUIRED_DOC_TYPES.some((r) => r.type === d.documentType),
  );
  const woundPhotos = documents.filter((d) => d.documentType === "wound_pictures");
  const groupedDocs = documents.reduce<Record<string, IOrderDocument[]>>((acc, d) => {
    if (!acc[d.documentType]) acc[d.documentType] = [];
    acc[d.documentType].push(d);
    return acc;
  }, {});

  /* ── Render ── */
  return (
    <>
      <OrderCompletionGuide
        open={completionOpen}
        onClose={() => setCompletionOpen(false)}
        onGoToTab={(t) => { setCompletionOpen(false); setTab(t as TabValue); }}
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
      <SignOrderModal open={signOpen} onOpenChange={setSignOpen} order={order} providerName={currentUserName ?? "Provider"} onSuccess={refreshOrder} />
      <ApproveOrderModal open={approveOpen} onOpenChange={setApproveOpen} order={order} onSuccess={refreshOrder} />
      <AddShippingModal open={shipOpen} onOpenChange={setShipOpen} order={order} onSuccess={refreshOrder} />

      {/* Raw Radix Root — no sizing constraints from shadcn DialogContent */}
      <RadixDialog.Root open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
        <DialogPortal>
          <DialogOverlay />
          <RadixDialog.Content
            aria-describedby={undefined}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 outline-none"
          >
            <DialogTitle className="sr-only">Order {order.order_number}</DialogTitle>

            {/* ── Modal card ── */}
            <div className="bg-white w-[95vw] max-w-[1200px] h-[90vh] rounded-3xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col">

              {/* ════════ FULL-WIDTH HEADER ════════ */}
              <div className="flex-shrink-0 px-8 py-5 border-b border-gray-100 flex items-center justify-between bg-white">
                <div className="min-w-0">
                  <h2 className="text-2xl font-extrabold tracking-tight text-gray-900 truncate">
                    {order.patient_full_name ?? "No Patient"}
                  </h2>
                  <p className="text-gray-400 text-sm mt-0.5">
                    Order #{order.order_number}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <OrderStatusBadge status={order.order_status} />
                  <button
                    onClick={onClose}
                    className="w-9 h-9 rounded-full hover:bg-gray-100 transition-colors flex items-center justify-center"
                  >
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
              </div>

              {/* ════════ TWO-COLUMN BODY ════════ */}
              <div className="flex flex-1 overflow-hidden">

                {/* ──── LEFT COLUMN: Tabs ──── */}
                <div className="flex-1 flex flex-col border-r border-gray-100 overflow-hidden min-w-0">

                  {/* Tab bar */}
                  <div className="flex-shrink-0 border-b border-gray-100 px-6">
                    <div className="flex overflow-x-auto">
                      {TABS.map((t) => {
                        const badge =
                          t.value === "documents" ? docCount :
                          t.value === "conversation" ? msgCount : 0;
                        return (
                          <button
                            key={t.value}
                            onClick={() => setTab(t.value)}
                            className={cn(
                              "px-5 py-3.5 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors shrink-0 flex items-center gap-1.5",
                              tab === t.value
                                ? "border-[#15689E] text-[#15689E]"
                                : "border-transparent text-gray-500 hover:text-gray-800",
                            )}
                          >
                            {t.label}
                            {badge > 0 && (
                              <span className="text-[10px] bg-[#15689E] text-white px-1.5 py-0.5 rounded-full font-bold">
                                {badge}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Tab content — absolute-positioned so each tab fills space */}
                  <div className="flex-1 relative overflow-hidden">

                    {/* OVERVIEW */}
                    {tab === "overview" && (
                      <div className="absolute inset-0 overflow-y-auto px-6 py-6 space-y-5">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">
                          Order Items
                        </h3>
                        <div className="rounded-2xl border border-gray-100 overflow-hidden">
                          {(order.all_items?.length ?? 0) > 0 ? (
                            <div className="divide-y divide-gray-50">
                              {order.all_items.map((item) => (
                                <div key={item.id} className="flex items-center justify-between px-4 py-3">
                                  <div className="flex items-center gap-2.5">
                                    <Package className="w-4 h-4 text-gray-300" />
                                    <div>
                                      <p className="text-sm font-semibold text-gray-800">{item.productName}</p>
                                      <p className="text-xs text-gray-400">{item.productSku}</p>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm font-bold text-gray-700">×{item.quantity}</p>
                                    <p className="text-xs text-gray-400">${item.unitPrice.toFixed(2)} ea</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-400 text-center py-6">No products added yet.</p>
                          )}

                          {canEdit && status === "draft" && (
                            <div className="border-t border-gray-50 px-4 py-2.5">
                              {!showProductPicker ? (
                                <button
                                  type="button"
                                  onClick={() => setShowProductPicker(true)}
                                  className="text-xs text-[#15689E] hover:underline flex items-center gap-1 font-semibold"
                                >
                                  <Plus className="w-3 h-3" /> Add Product
                                </button>
                              ) : (
                                <div className="space-y-3 py-1">
                                  {loadingProducts ? (
                                    <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading products...
                                    </div>
                                  ) : products.length === 0 ? (
                                    <p className="text-xs text-gray-400">No products available.</p>
                                  ) : (
                                    products.map((prod) => {
                                      const qty = quantities[prod.id] ?? 0;
                                      return (
                                        <div
                                          key={prod.id}
                                          className={cn(
                                            "flex items-center gap-2 p-2 rounded-xl border transition-all",
                                            qty > 0 ? "border-[#15689E] bg-blue-50" : "border-gray-100",
                                          )}
                                        >
                                          <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold text-gray-800 truncate">{prod.name}</p>
                                            <p className="text-[11px] text-gray-400">${Number(prod.unit_price).toFixed(2)}</p>
                                          </div>
                                          <div className="flex items-center gap-1.5 shrink-0">
                                            <button
                                              type="button"
                                              disabled={qty === 0}
                                              onClick={() => setQuantities((p) => { const n = { ...p }; if (qty <= 1) delete n[prod.id]; else n[prod.id] = qty - 1; return n; })}
                                              className="w-6 h-6 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 disabled:opacity-40"
                                            >
                                              <Minus className="w-2.5 h-2.5" />
                                            </button>
                                            <span className="w-5 text-center text-xs font-bold">{qty}</span>
                                            <button
                                              type="button"
                                              onClick={() => setQuantities((p) => ({ ...p, [prod.id]: qty + 1 }))}
                                              className="w-6 h-6 rounded-full bg-[#15689E] flex items-center justify-center text-white"
                                            >
                                              <Plus className="w-2.5 h-2.5" />
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    })
                                  )}
                                  <div className="flex gap-2">
                                    <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => { setShowProductPicker(false); setQuantities({}); }}>Cancel</Button>
                                    <Button size="sm" className="flex-1 text-xs bg-[#15689E] text-white" disabled={!Object.values(quantities).some((q) => q > 0) || addingProducts} onClick={handleAddProducts}>
                                      {addingProducts ? <Loader2 className="w-3 h-3 animate-spin" /> : "Add to Order"}
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="space-y-2">
                          {isClinical && status === "draft" && (
                            <Button className="w-full bg-[#15689E] hover:bg-[#125d8e] text-white" disabled={submitting} onClick={handleEditAndSubmit}>
                              {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                              Edit and Submit Order
                            </Button>
                          )}
                          {canSign && status === "pending_signature" && (
                            <Button className="w-full bg-[#15689E] hover:bg-[#125d8e] text-white" onClick={() => setSignOpen(true)}>Sign Order</Button>
                          )}
                          {isClinical && status === "pending_signature" && (
                            <Button variant="outline" className="w-full" disabled={isActing} onClick={() => handleAction(() => recallOrder(order.id), "Order recalled to draft.")}>Recall to Draft</Button>
                          )}
                          {isClinical && status === "additional_info_needed" && (
                            <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white" disabled={isActing} onClick={() => handleAction(() => resubmitForReview(order.id), "Resubmitted for review.")}>Resubmit for Review</Button>
                          )}
                          {isAdmin && status === "manufacturer_review" && (
                            <>
                              <Button className="w-full bg-green-600 hover:bg-green-700 text-white" onClick={() => setApproveOpen(true)}>Approve Order</Button>
                              <Button variant="outline" className="w-full" disabled={isActing} onClick={() => handleAction(() => requestAdditionalInfo(order.id), "Additional info requested.")}>Request More Info</Button>
                            </>
                          )}
                          {isAdmin && status === "approved" && (
                            <Button className="w-full bg-teal-600 hover:bg-teal-700 text-white" onClick={() => setShipOpen(true)}>Add Shipping Info</Button>
                          )}
                          {isClinical && status === "draft" && (
                            <Button variant="ghost" className="w-full text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => setDeleteOpen(true)}>Delete Order</Button>
                          )}
                        </div>

                        {order.notes && (
                          <div>
                            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Notes</h3>
                            <p className="text-sm text-gray-600 whitespace-pre-wrap bg-gray-50 rounded-xl border border-gray-100 px-4 py-3">{order.notes}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ORDER FORM (AI-extracted, read-only) */}
                    {tab === "order-form" && (
                      <div className="absolute inset-0 overflow-y-auto px-6 py-6 space-y-5">
                        {!order.ai_extracted ? (
                          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
                            <div className="flex items-center gap-2 text-amber-700 font-semibold text-sm mb-1.5">
                              <AlertCircle className="w-4 h-4" />
                              AI extraction pending
                            </div>
                            <p className="text-amber-600 text-xs">
                              Upload the patient facesheet and doctor&apos;s note. The AI will automatically extract patient and clinical information.
                            </p>
                            {docCount > 0 && (
                              <p className="text-amber-600 text-xs mt-1 italic">
                                Documents uploaded. You can proceed to fill the IVR and HCFA forms.
                              </p>
                            )}
                          </div>
                        ) : (
                          <>
                            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">Patient Information (AI-extracted)</h3>
                            <div className="rounded-2xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
                              {[
                                { label: "Patient Name",          value: order.patient_full_name ?? "—" },
                                { label: "Date of Service",       value: order.date_of_service ?? "—" },
                                { label: "Wound Visit #",         value: order.wound_visit_number != null ? String(order.wound_visit_number) : "—" },
                                { label: "Chief Complaint",       value: order.chief_complaint ?? "—" },
                                { label: "Active Vasculitis/Burns?", value: order.has_vasculitis_or_burns ? "Yes" : "No" },
                                { label: "Receiving Home Health?",value: order.is_receiving_home_health ? "Yes" : "No" },
                                { label: "Patient at SNF?",       value: order.is_patient_at_snf ? "Yes" : "No" },
                                { label: "ICD-10 Code",           value: order.icd10_code ?? "—" },
                                { label: "Follow-up Days",        value: order.followup_days != null ? String(order.followup_days) : "—" },
                              ].map(({ label, value }) => (
                                <div key={label} className="flex items-center justify-between px-4 py-3">
                                  <span className="text-xs text-gray-400">{label}</span>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-sm font-semibold text-gray-800">{value}</span>
                                    <Lock className="w-3 h-3 text-gray-300" />
                                  </div>
                                </div>
                              ))}
                            </div>
                            <p className="text-xs text-gray-400 flex items-center gap-1">
                              <Lock className="w-3 h-3" />
                              AI-extracted. Corrections must be made in your clinic system.
                            </p>
                          </>
                        )}
                      </div>
                    )}

                    {/* IVR FORM */}
                    {tab === "ivr" && (
                      <div className="absolute inset-0 overflow-y-auto px-6 py-6">
                        <OrderIVRForm orderId={order.id} canEdit={canEdit} onSaveStatus={setIvrSaveStatus} />
                      </div>
                    )}

                    {/* HCFA / CMS-1500 */}
                    {tab === "hcfa" && (
                      <div className="absolute inset-0 overflow-y-auto px-6 py-6">
                        <Form1500Tab orderId={order.id} canEdit={canEdit} />
                      </div>
                    )}

                    {/* DOCUMENTS */}
                    {tab === "documents" && (
                      <div className="absolute inset-0 overflow-y-auto px-6 py-6 space-y-5">
                        {loadingDocs ? (
                          <div className="flex justify-center py-8">
                            <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
                          </div>
                        ) : (
                          ALL_DOC_TYPES.map(({ type, label }) => {
                            const typeDocs = groupedDocs[type] ?? [];
                            return (
                              <div key={type} className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400">{label}</p>
                                  {(canEdit || isAdmin) && (
                                    <label className="cursor-pointer text-xs text-[#15689E] hover:underline flex items-center gap-1 font-semibold">
                                      <Upload className="w-3 h-3" />
                                      Upload
                                      <input type="file" className="hidden" accept="image/*,.pdf,.doc,.docx"
                                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadDoc(f, type); e.target.value = ""; }}
                                      />
                                    </label>
                                  )}
                                </div>
                                {typeDocs.length === 0 ? (
                                  <p className="text-xs text-gray-300 italic">None uploaded</p>
                                ) : (
                                  typeDocs.map((doc) => (
                                    <div key={doc.id} className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5">
                                      <span className="text-sm text-gray-700 flex-1 truncate">{doc.fileName}</span>
                                      <span className="text-xs text-gray-400">{new Date(doc.createdAt).toLocaleDateString()}</span>
                                      <button type="button" onClick={() => handleViewDoc(doc)} className="text-[#15689E] hover:text-[#125d8e] transition-colors">
                                        <ExternalLink className="w-4 h-4" />
                                      </button>
                                      {(canEdit || isAdmin) && (
                                        <button type="button" onClick={() => handleDeleteDoc(doc)} className="text-gray-300 hover:text-red-500 transition-colors">
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      )}
                                    </div>
                                  ))
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}

                    {/* CHAT */}
                    {tab === "conversation" && (
                      <div className="absolute inset-0 flex flex-col">
                        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 min-h-0">
                          {loadingMessages ? (
                            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-300" /></div>
                          ) : messages.length === 0 ? (
                            <p className="text-sm text-gray-400 text-center py-8">No messages yet. Start the conversation.</p>
                          ) : (
                            messages.map((m) => (
                              <div key={m.id} className="space-y-1">
                                <div className="flex items-center gap-1.5">
                                  <User className="w-3.5 h-3.5 text-gray-400" />
                                  <span className="text-xs font-semibold text-gray-700">{m.senderName ?? "Unknown"}</span>
                                  <span className="text-xs text-gray-400">{new Date(m.createdAt).toLocaleString()}</span>
                                </div>
                                <div className="bg-gray-50 border border-gray-100 rounded-2xl px-3 py-2.5">
                                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{m.message}</p>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                        <div className="shrink-0 px-6 py-3 border-t border-gray-100 flex gap-2">
                          <Input
                            placeholder="Type a message..."
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                            disabled={sendingMsg}
                            className="flex-1"
                          />
                          <Button size="icon" disabled={sendingMsg || !newMessage.trim()} onClick={handleSendMessage} className="bg-[#15689E] hover:bg-[#125d8e] text-white shrink-0">
                            {sendingMsg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* HISTORY */}
                    {tab === "history" && (
                      <div className="absolute inset-0 overflow-y-auto px-6 py-6">
                        {loadingHistory ? (
                          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-300" /></div>
                        ) : history.length === 0 ? (
                          <p className="text-sm text-gray-400 text-center py-8">No history yet.</p>
                        ) : (
                          <div className="relative pl-5">
                            <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-gray-100" />
                            {history.map((h) => (
                              <div key={h.id} className="relative mb-5">
                                <div className="absolute -left-[17px] w-3 h-3 rounded-full bg-[#15689E] border-2 border-white top-1" />
                                <p className="text-sm font-semibold text-gray-800">{h.action}</p>
                                {h.oldStatus && h.newStatus && (
                                  <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                                    <span className="capitalize">{h.oldStatus.replace(/_/g, " ")}</span>
                                    <span>→</span>
                                    <span className="capitalize">{h.newStatus.replace(/_/g, " ")}</span>
                                  </p>
                                )}
                                {h.performedByName && (
                                  <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                                    <User className="w-3 h-3" />{h.performedByName}
                                  </p>
                                )}
                                <p className="text-xs text-gray-400 mt-0.5">{new Date(h.createdAt).toLocaleString()}</p>
                                {h.notes && (
                                  <p className="text-xs text-gray-500 mt-1 bg-gray-50 rounded-lg px-2 py-1">{h.notes}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                  </div>{/* end tab content */}

                  {/* ── Left footer: auto-save + action ── */}
                  <div className="flex-shrink-0 px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-white">
                    <div className="flex items-center gap-2">
                      {ivrSaveStatus !== "idle" && (
                        <>
                          <span className={cn(
                            "w-2 h-2 rounded-full shrink-0",
                            ivrSaveStatus === "saving" ? "bg-[#15689E] animate-pulse" : "bg-green-500",
                          )} />
                          <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                            {ivrSaveStatus === "saving" ? "Auto-saving..." : "Changes saved"}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="flex gap-3">
                      {isClinical && status === "draft" && (
                        <button
                          onClick={handleEditAndSubmit}
                          disabled={submitting}
                          className="px-8 py-2.5 bg-[#15689E] text-white font-bold rounded-xl shadow-lg shadow-[#15689E]/20 hover:bg-[#15689E]/90 active:scale-[0.98] transition-all text-sm disabled:opacity-60 flex items-center gap-2"
                        >
                          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                          Edit and Submit Order
                        </button>
                      )}
                      {canSign && status === "pending_signature" && (
                        <button
                          onClick={() => setSignOpen(true)}
                          className="px-8 py-2.5 bg-[#15689E] text-white font-bold rounded-xl shadow-lg shadow-[#15689E]/20 hover:bg-[#15689E]/90 active:scale-[0.98] transition-all text-sm"
                        >
                          Sign Order
                        </button>
                      )}
                    </div>
                  </div>

                </div>{/* end left column */}

                {/* ──── RIGHT COLUMN: Summary panel ──── */}
                <div className="w-[380px] flex-shrink-0 flex flex-col bg-gray-50/50 overflow-hidden">

                  {/* Right header */}
                  <div className="flex-shrink-0 p-6 border-b border-gray-100">
                    <p className="text-xs text-gray-400 font-mono mb-1">{order.order_number}</p>
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <span className="text-sm text-gray-500 border border-gray-200 rounded-full px-3 py-0.5 text-xs font-medium capitalize">
                        {status.replace(/_/g, " ")}
                      </span>
                      {isClinical && status === "draft" && (
                        <button
                          type="button"
                          onClick={() => setDeleteOpen(true)}
                          className="text-xs font-semibold text-red-400 hover:text-red-500 transition-colors"
                        >
                          Archive
                        </button>
                      )}
                    </div>
                    <div className="flex gap-5">
                      <div>
                        <p className="text-[10px] text-gray-400 mb-0.5 flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> Date of Service
                        </p>
                        <p className="text-xs font-semibold text-gray-700">{order.date_of_service ?? "—"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 mb-0.5 flex items-center gap-1">
                          <Building2 className="w-3 h-3" /> Clinic
                        </p>
                        <p className="text-xs font-semibold text-gray-700 truncate max-w-[140px]">{order.facility_name ?? "—"}</p>
                      </div>
                    </div>
                  </div>

                  {/* Right scrollable body */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-6">

                    {/* Document status buttons */}
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Documents</h3>
                      {loadingDocs ? (
                        <div className="grid grid-cols-2 gap-2">
                          {REQUIRED_DOC_TYPES.map((d) => (
                            <div key={d.type} className="h-11 rounded-xl bg-gray-100 animate-pulse" />
                          ))}
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          {REQUIRED_DOC_TYPES.map((doc) => {
                            const uploaded = documents.some((d) => d.documentType === doc.type);
                            return (
                              <button
                                key={doc.type}
                                type="button"
                                onClick={() => handleViewDocByType(doc.type)}
                                className={cn(
                                  "flex items-center gap-2 px-3 py-3 rounded-xl border text-xs font-bold text-left w-full transition-colors",
                                  uploaded
                                    ? "bg-green-50 border-green-200 text-green-800 hover:bg-green-100"
                                    : "bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100",
                                )}
                              >
                                {uploaded
                                  ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                                  : <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                }
                                <span className="truncate">{doc.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Additional documentation */}
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Additional Documentation</h3>
                      {additionalDocs.length === 0 ? (
                        <p className="text-xs text-gray-400">No additional documentation uploaded</p>
                      ) : (
                        <div className="space-y-1.5 mb-3">
                          {additionalDocs.map((doc) => (
                            <button key={doc.id} type="button" onClick={() => handleViewDoc(doc)}
                              className="text-xs text-[#15689E] hover:underline block truncate max-w-full text-left font-medium">
                              {doc.fileName}
                            </button>
                          ))}
                        </div>
                      )}
                      {(canEdit || isAdmin) && (
                        <label className="mt-2 flex items-center gap-2 w-full px-4 py-2.5 rounded-xl bg-[#15689E] text-white text-xs font-bold hover:bg-[#15689E]/90 transition-colors cursor-pointer">
                          <Paperclip className="w-3.5 h-3.5" />
                          Attach Additional Documentation
                          <input type="file" className="hidden" accept="image/*,.pdf,.doc,.docx"
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadDoc(f, "other"); e.target.value = ""; }}
                          />
                        </label>
                      )}
                    </div>

                    {/* Wound photos */}
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Wound Photos</h3>
                      {woundPhotos.length === 0 ? (
                        <p className="text-xs text-gray-400">No wound photos uploaded</p>
                      ) : (
                        <div className="grid grid-cols-3 gap-1.5">
                          {woundPhotos.map((photo) =>
                            woundPhotoUrls[photo.id] ? (
                              <button key={photo.id} type="button"
                                onClick={() => window.open(woundPhotoUrls[photo.id], "_blank", "noopener,noreferrer")}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={woundPhotoUrls[photo.id]} alt={photo.fileName}
                                  className="w-full aspect-square object-cover rounded-xl border border-gray-100"
                                />
                              </button>
                            ) : (
                              <div key={photo.id} className="w-full aspect-square rounded-xl border border-gray-100 bg-gray-100 animate-pulse" />
                            ),
                          )}
                        </div>
                      )}
                    </div>

                  </div>

                  {/* Right footer */}
                  <div className="flex-shrink-0 px-6 py-4 border-t border-gray-100">
                    <button type="button" onClick={() => toast("ZIP download coming soon.")}
                      className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600 transition-colors font-medium">
                      <Download className="w-3.5 h-3.5" />
                      Download ZIP
                    </button>
                  </div>

                </div>{/* end right column */}

              </div>{/* end two-column body */}
            </div>{/* end modal card */}
          </RadixDialog.Content>
        </DialogPortal>
      </RadixDialog.Root>
    </>
  );
}
