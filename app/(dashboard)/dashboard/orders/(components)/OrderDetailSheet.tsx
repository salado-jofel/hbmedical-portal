"use client";

import { useState, useEffect, useTransition } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FileText,
  Clock,
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
} from "../(services)/actions";
import { OrderStatusBadge } from "./OrderStatusBadge";
import { OrderIVRForm } from "./OrderIVRForm";
import { OrderCompletionGuide } from "./OrderCompletionGuide";
import toast from "react-hot-toast";
import { cn } from "@/utils/utils";

const DOC_TYPE_CONFIG: Array<{ type: string; label: string; emoji: string }> = [
  { type: "facesheet", label: "Facesheet", emoji: "📋" },
  { type: "clinical_docs", label: "Clinical Docs", emoji: "📄" },
  { type: "order_form", label: "Order Form", emoji: "📝" },
  { type: "additional_ivr", label: "Additional IVR Info", emoji: "📎" },
  { type: "form_1500", label: "1500 Form", emoji: "🧾" },
  { type: "wound_pictures", label: "Wound Pictures", emoji: "🖼" },
  { type: "other", label: "Other", emoji: "📌" },
];

interface OrderDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: DashboardOrder;
  canCreate: boolean;
  isAdmin: boolean;
  canSign?: boolean;
  isSupport?: boolean;
}

export function OrderDetailSheet({
  open,
  onOpenChange,
  order,
  canCreate,
  isAdmin,
  canSign,
  isSupport,
}: OrderDetailSheetProps) {
  const [messages, setMessages] = useState<IOrderMessage[]>([]);
  const [history, setHistory] = useState<IOrderHistory[]>([]);
  const [documents, setDocuments] = useState<IOrderDocument[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);
  const [tab, setTab] = useState("overview");
  const [, startTransition] = useTransition();

  // Product picker state
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [addingProducts, setAddingProducts] = useState(false);

  // Completion guide + submit state
  const [completionOpen, setCompletionOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canEditIvr = canCreate || canSign || isSupport;
  const canEditDocs = canCreate || isAdmin;

  useEffect(() => {
    if (!open) return;
    setTab("overview");

    async function loadAll() {
      setLoadingMessages(true);
      setLoadingHistory(true);
      setLoadingDocs(true);

      const [msgs, hist, docs] = await Promise.all([
        getOrderMessages(order.id),
        getOrderHistory(order.id),
        getOrderDocuments(order.id),
      ]);

      setMessages(msgs);
      setLoadingMessages(false);
      setHistory(hist);
      setLoadingHistory(false);
      setDocuments(docs);
      setLoadingDocs(false);
    }

    loadAll();
  }, [open, order.id]);

  // Load products when picker opens
  useEffect(() => {
    if (!showProductPicker) return;
    setLoadingProducts(true);
    getProducts().then((p) => {
      setProducts(p);
      setLoadingProducts(false);
    });
  }, [showProductPicker]);

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
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      toast.error(error ?? "Could not generate link.");
    }
  }

  async function handleDeleteDoc(doc: IOrderDocument) {
    startTransition(async () => {
      const result = await deleteOrderDocument(doc.id, doc.filePath);
      if (result.success) {
        setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
        toast.success("Document deleted.");
      } else {
        toast.error(result.error ?? "Failed to delete document.");
      }
    });
  }

  async function handleUploadDoc(file: File, docType: DocumentType) {
    const fd = new FormData();
    fd.set("file", file);
    const result = await uploadOrderDocument(order.id, docType, fd);
    if (result.success && result.document) {
      setDocuments((prev) => [result.document!, ...prev]);
      toast.success("Document uploaded.");
    } else {
      toast.error(result.error ?? "Upload failed.");
    }
  }

  async function handleAddProducts() {
    const items = Object.entries(quantities)
      .filter(([, q]) => q > 0)
      .map(([productId, quantity]) => {
        const prod = products.find((p) => p.id === productId)!;
        return {
          product_id: prod.id,
          product_name: prod.name,
          product_sku: prod.sku,
          unit_price: Number(prod.unit_price),
          quantity,
        };
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
    const hasDate = !!order.date_of_service;
    const hasWoundType = !!order.wound_type;

    if (!hasFacesheet || !hasProducts || !hasDate || !hasWoundType) {
      setCompletionOpen(true);
      return;
    }

    setSubmitting(true);
    const result = await submitForSignature(order.id);
    if (result.success) {
      toast.success("Order submitted for signature.");
      onOpenChange(false);
    } else {
      toast.error(result.error ?? "Failed to submit.");
    }
    setSubmitting(false);
  }

  const groupedDocs = documents.reduce<Record<string, IOrderDocument[]>>(
    (acc, d) => {
      const key = d.documentType;
      if (!acc[key]) acc[key] = [];
      acc[key].push(d);
      return acc;
    },
    {}
  );

  const msgCount = messages.length;
  const docCount = documents.length;

  return (
    <>
      <OrderCompletionGuide
        open={completionOpen}
        onClose={() => setCompletionOpen(false)}
        onGoToTab={(t) => {
          setCompletionOpen(false);
          setTab(t);
        }}
        order={order}
        documents={documents}
      />

      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full md:max-w-[600px] p-0 flex flex-col overflow-hidden">
          <SheetHeader className="px-6 py-4 border-b border-slate-200 shrink-0">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-lg font-bold text-slate-800">
                {order.order_number}
              </SheetTitle>
              <OrderStatusBadge status={order.order_status} />
            </div>
          </SheetHeader>

          <Tabs
            value={tab}
            onValueChange={setTab}
            className="flex flex-col flex-1 min-h-0"
          >
            <TabsList className="shrink-0 flex mx-4 mt-3 mb-0 bg-slate-100 rounded-lg overflow-x-auto p-1 gap-0.5">
              <TabsTrigger
                value="overview"
                className="text-xs flex-1 whitespace-nowrap"
              >
                Overview
              </TabsTrigger>
              <TabsTrigger
                value="order-form"
                className="text-xs flex-1 whitespace-nowrap"
              >
                Order Form
              </TabsTrigger>
              <TabsTrigger
                value="ivr"
                className="text-xs flex-1 whitespace-nowrap"
              >
                IVR Form
              </TabsTrigger>
              <TabsTrigger
                value="documents"
                className="text-xs flex-1 whitespace-nowrap"
              >
                Docs{" "}
                {docCount > 0 && (
                  <Badge className="ml-1 h-4 text-[10px] px-1.5 py-0">
                    {docCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="conversation"
                className="text-xs flex-1 whitespace-nowrap"
              >
                Chat{" "}
                {msgCount > 0 && (
                  <Badge className="ml-1 h-4 text-[10px] px-1.5 py-0">
                    {msgCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="history"
                className="text-xs flex-1 whitespace-nowrap"
              >
                History
              </TabsTrigger>
            </TabsList>

            {/* ── OVERVIEW ── */}
            <TabsContent
              value="overview"
              className="flex-1 overflow-y-auto px-6 py-4 space-y-4"
            >
              {/* Order info */}
              <Section title="Order Info">
                <Row
                  label="Order #"
                  value={
                    <span className="font-mono text-sm font-bold text-[#15689E]">
                      {order.order_number}
                    </span>
                  }
                />
                <Row
                  label="Wound Type"
                  value={order.wound_type?.replace("_", " ") ?? "—"}
                  capitalize
                />
                <Row
                  label="Date of Service"
                  value={order.date_of_service ?? "—"}
                />
                <Row
                  label="Status"
                  value={<OrderStatusBadge status={order.order_status} />}
                />
                <Row label="Facility" value={order.facility_name ?? "—"} />
                {order.created_by_name && (
                  <Row label="Created By" value={order.created_by_name} />
                )}
                {order.signed_by_name && (
                  <Row label="Signed By" value={order.signed_by_name} />
                )}
                {order.signed_at && (
                  <Row
                    label="Signed At"
                    value={new Date(order.signed_at).toLocaleDateString()}
                  />
                )}
                {order.payment_method && (
                  <Row
                    label="Payment Method"
                    value={order.payment_method.replace("_", " ")}
                    capitalize
                  />
                )}
              </Section>

              {/* Products */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                  Products
                </h4>
                <div className="rounded-xl border border-slate-200 bg-white">
                  {order.all_items?.length > 0 ? (
                    <div className="divide-y divide-slate-100">
                      {order.all_items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between px-3 py-2.5"
                        >
                          <div className="flex items-center gap-2">
                            <Package className="w-3.5 h-3.5 text-slate-400" />
                            <div>
                              <p className="text-sm font-medium text-slate-800">
                                {item.productName}
                              </p>
                              <p className="text-xs text-slate-500">
                                {item.productSku}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold">
                              ×{item.quantity}
                            </p>
                            <p className="text-xs text-slate-500">
                              ${item.unitPrice.toFixed(2)} ea
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400 text-center py-4">
                      No products added yet.
                    </p>
                  )}

                  {/* Add product */}
                  {canCreate && order.order_status === "draft" && (
                    <div className="border-t border-slate-100 px-3 py-2">
                      {!showProductPicker ? (
                        <button
                          type="button"
                          onClick={() => setShowProductPicker(true)}
                          className="text-xs text-[#15689E] hover:underline flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          Add Product
                        </button>
                      ) : (
                        <div className="space-y-3 py-1">
                          {loadingProducts ? (
                            <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Loading products...
                            </div>
                          ) : products.length === 0 ? (
                            <p className="text-xs text-slate-400">
                              No products available.
                            </p>
                          ) : (
                            products.map((prod) => {
                              const qty = quantities[prod.id] ?? 0;
                              return (
                                <div
                                  key={prod.id}
                                  className={cn(
                                    "flex items-center gap-2 p-2 rounded-lg border transition-all",
                                    qty > 0
                                      ? "border-[#15689E] bg-blue-50"
                                      : "border-slate-200"
                                  )}
                                >
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-slate-800 truncate">
                                      {prod.name}
                                    </p>
                                    <p className="text-[11px] text-slate-500">
                                      ${Number(prod.unit_price).toFixed(2)}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                      type="button"
                                      disabled={qty === 0}
                                      onClick={() =>
                                        setQuantities((p) => {
                                          const next = { ...p };
                                          if (qty <= 1) delete next[prod.id];
                                          else next[prod.id] = qty - 1;
                                          return next;
                                        })
                                      }
                                      className="w-6 h-6 rounded-full border border-slate-300 flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                                    >
                                      <Minus className="w-2.5 h-2.5" />
                                    </button>
                                    <span className="w-6 text-center text-xs font-bold">
                                      {qty}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setQuantities((p) => ({
                                          ...p,
                                          [prod.id]: qty + 1,
                                        }))
                                      }
                                      className="w-6 h-6 rounded-full bg-[#15689E] flex items-center justify-center text-white hover:bg-[#125d8e]"
                                    >
                                      <Plus className="w-2.5 h-2.5" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })
                          )}
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 text-xs border-[#E2E8F0]"
                              onClick={() => {
                                setShowProductPicker(false);
                                setQuantities({});
                              }}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              className="flex-1 text-xs bg-[#15689E] hover:bg-[#125d8e] text-white"
                              disabled={
                                !Object.values(quantities).some((q) => q > 0) ||
                                addingProducts
                              }
                              onClick={handleAddProducts}
                            >
                              {addingProducts ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                "Add to Order"
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Submit button */}
              {order.order_status === "draft" && canCreate && (
                <Button
                  className="w-full bg-[#15689E] hover:bg-[#125d8e] text-white"
                  disabled={submitting}
                  onClick={handleEditAndSubmit}
                >
                  {submitting && (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  )}
                  Edit and Submit Order →
                </Button>
              )}

              {order.notes && (
                <Section title="Notes">
                  <p className="text-sm text-slate-700 whitespace-pre-wrap px-3 py-2.5">
                    {order.notes}
                  </p>
                </Section>
              )}
            </TabsContent>

            {/* ── ORDER FORM (read-only AI data) ── */}
            <TabsContent
              value="order-form"
              className="flex-1 overflow-y-auto px-6 py-4 space-y-4"
            >
              {!order.ai_extracted ? (
                <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-sm">
                  <div className="flex items-center gap-2 text-amber-700">
                    <AlertCircle className="w-4 h-4" />
                    <span className="font-medium">AI extraction pending</span>
                  </div>
                  <p className="text-amber-600 mt-1 text-xs">
                    Upload the patient facesheet and doctor&apos;s note. The AI
                    will automatically extract patient and clinical information
                    from your documents.
                  </p>
                  <p className="text-amber-600 mt-2 text-xs italic">
                    Documents uploaded. You can proceed to fill the IVR and HCFA
                    forms.
                  </p>
                </div>
              ) : (
                <>
                  <Section title="Patient Information (AI-extracted)">
                    <AiRow
                      label="Patient Name"
                      value={order.patient_full_name ?? "—"}
                    />
                    <AiRow
                      label="Date of Service"
                      value={order.date_of_service ?? "—"}
                    />
                    <AiRow
                      label="Wound Visit #"
                      value={
                        order.wound_visit_number != null
                          ? String(order.wound_visit_number)
                          : "—"
                      }
                    />
                    <AiRow
                      label="Chief Complaint"
                      value={order.chief_complaint ?? "—"}
                    />
                    <AiRow
                      label="Active Vasculitis/Burns?"
                      value={order.has_vasculitis_or_burns ? "Yes" : "No"}
                    />
                    <AiRow
                      label="Receiving Home Health?"
                      value={order.is_receiving_home_health ? "Yes" : "No"}
                    />
                    <AiRow
                      label="Patient at SNF?"
                      value={order.is_patient_at_snf ? "Yes" : "No"}
                    />
                    <AiRow
                      label="ICD-10 Code"
                      value={order.icd10_code ?? "—"}
                    />
                    <AiRow
                      label="Follow-up Days"
                      value={
                        order.followup_days != null
                          ? String(order.followup_days)
                          : "—"
                      }
                    />
                  </Section>
                  <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    These fields are populated by AI extraction and cannot be
                    modified. If corrections are needed, please update on your
                    clinic system.
                  </p>
                </>
              )}
            </TabsContent>

            {/* ── IVR FORM ── */}
            <TabsContent
              value="ivr"
              className="flex-1 overflow-y-auto px-6 py-4"
            >
              <OrderIVRForm orderId={order.id} canEdit={!!canEditIvr} />
            </TabsContent>

            {/* ── DOCUMENTS ── */}
            <TabsContent
              value="documents"
              className="flex-1 overflow-y-auto px-6 py-4 space-y-5"
            >
              {loadingDocs ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                </div>
              ) : (
                DOC_TYPE_CONFIG.map(({ type, label, emoji }) => {
                  const typeDocs = groupedDocs[type] ?? [];
                  return (
                    <div key={type} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-700">
                          {emoji} {label}
                        </p>
                        {canEditDocs && (
                          <label className="cursor-pointer text-xs text-[#15689E] hover:underline flex items-center gap-1">
                            <Upload className="w-3 h-3" />
                            Upload
                            <input
                              type="file"
                              className="hidden"
                              accept="image/*,.pdf,.doc,.docx"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file)
                                  handleUploadDoc(file, type as DocumentType);
                                e.target.value = "";
                              }}
                            />
                          </label>
                        )}
                      </div>
                      {typeDocs.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">
                          {type === "wound_pictures"
                            ? "No wound photos uploaded"
                            : "No additional documentation uploaded"}
                        </p>
                      ) : (
                        typeDocs.map((doc) => (
                          <div
                            key={doc.id}
                            className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                          >
                            <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                            <span className="text-sm text-slate-700 flex-1 truncate">
                              {doc.fileName}
                            </span>
                            <span className="text-xs text-slate-400">
                              {new Date(doc.createdAt).toLocaleDateString()}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleViewDoc(doc)}
                              className="text-[#15689E] hover:text-[#125d8e] transition-colors"
                              title="View"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </button>
                            {canEditDocs && (
                              <button
                                type="button"
                                onClick={() => handleDeleteDoc(doc)}
                                className="text-slate-400 hover:text-red-500 transition-colors"
                                title="Delete"
                              >
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
            </TabsContent>

            {/* ── CONVERSATION ── */}
            <TabsContent
              value="conversation"
              className="flex flex-col flex-1 min-h-0 px-6 py-4 gap-3"
            >
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {loadingMessages ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                  </div>
                ) : messages.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-8">
                    No messages yet. Start the conversation.
                  </p>
                ) : (
                  messages.map((m) => (
                    <div key={m.id} className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-xs font-semibold text-slate-700">
                          {m.senderName ?? "Unknown"}
                        </span>
                        <span className="text-xs text-slate-400">
                          {new Date(m.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
                        <p className="text-sm text-slate-700 whitespace-pre-wrap">
                          {m.message}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="shrink-0 flex gap-2">
                <Input
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  disabled={sendingMsg}
                  className="flex-1"
                />
                <Button
                  size="icon"
                  disabled={sendingMsg || !newMessage.trim()}
                  onClick={handleSendMessage}
                  className="bg-[#15689E] hover:bg-[#125d8e] text-white shrink-0"
                >
                  {sendingMsg ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </TabsContent>

            {/* ── HISTORY ── */}
            <TabsContent
              value="history"
              className="flex-1 overflow-y-auto px-6 py-4 space-y-4"
            >
              {loadingHistory ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                </div>
              ) : history.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">
                  No history yet.
                </p>
              ) : (
                <div className="relative pl-5">
                  <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-slate-200" />
                  {history.map((h) => (
                    <div key={h.id} className="relative mb-5">
                      <div className="absolute -left-[17px] w-3 h-3 rounded-full bg-[#15689E] border-2 border-white top-1" />
                      <p className="text-sm font-semibold text-slate-800">
                        {h.action}
                      </p>
                      {h.oldStatus && h.newStatus && (
                        <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                          <span className="capitalize">
                            {h.oldStatus.replace(/_/g, " ")}
                          </span>
                          <span>→</span>
                          <span className="capitalize">
                            {h.newStatus.replace(/_/g, " ")}
                          </span>
                        </p>
                      )}
                      {h.performedByName && (
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <User className="w-3 h-3" />
                          {h.performedByName}
                        </p>
                      )}
                      <p className="text-xs text-slate-400 mt-0.5">
                        {new Date(h.createdAt).toLocaleString()}
                      </p>
                      {h.notes && (
                        <p className="text-xs text-slate-600 mt-1 bg-slate-50 rounded-lg px-2 py-1">
                          {h.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>
    </>
  );
}

/* ── Helpers ── */
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
        {title}
      </h4>
      <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
        {children}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  capitalize,
}: {
  label: string;
  value: React.ReactNode;
  capitalize?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5">
      <span className="text-xs text-slate-500">{label}</span>
      {typeof value === "string" ? (
        <span
          className={`text-sm font-semibold text-slate-800 ${
            capitalize ? "capitalize" : ""
          }`}
        >
          {value}
        </span>
      ) : (
        value
      )}
    </div>
  );
}

function AiRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5">
      <span className="text-xs text-slate-500">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-semibold text-slate-800">{value}</span>
        <Lock className="w-3 h-3 text-slate-300" />
      </div>
    </div>
  );
}
