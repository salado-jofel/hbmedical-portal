"use client";

import type { RefObject } from "react";
import { MessageSquare, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { IOrderMessage } from "@/utils/interfaces/orders";
import { cn } from "@/utils/utils";

const ROLE_COLOR: Record<string, string> = {
  admin: "bg-purple-100 text-purple-800",
  clinical_provider: "bg-blue-100 text-blue-800",
  clinical_staff: "bg-green-100 text-green-800",
  support_staff: "bg-orange-100 text-orange-800",
  sales_representative: "bg-gray-100 text-gray-700",
};

const ROLE_BADGE: Record<string, string> = {
  admin: "Admin",
  clinical_provider: "Provider",
  clinical_staff: "Staff",
  support_staff: "Support",
  sales_representative: "Rep",
};

function ChatSkeleton() {
  return (
    <div className="p-4 space-y-3 animate-pulse">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className={`flex gap-2 ${i % 2 === 0 ? "" : "flex-row-reverse"}`}
        >
          <div className="w-8 h-8 rounded-full bg-gray-200 shrink-0" />
          <div
            className={`space-y-1 flex-1 flex flex-col ${
              i % 2 === 0 ? "items-start" : "items-end"
            }`}
          >
            <div className="h-3 bg-gray-200 rounded w-20" />
            <div className="h-16 bg-gray-100 rounded-xl w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface OrderChatTabProps {
  isActive: boolean;
  isReady: boolean;
  messages: IOrderMessage[];
  newMessage: string;
  sendingMsg: boolean;
  currentUserId: string | undefined;
  isAdmin: boolean;
  canSign: boolean;
  isClinical: boolean;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  onNewMessageChange: (v: string) => void;
  onSend: () => void;
}

export function OrderChatTab({
  isActive,
  isReady,
  messages,
  newMessage,
  sendingMsg,
  currentUserId,
  isAdmin,
  canSign,
  isClinical,
  messagesEndRef,
  onNewMessageChange,
  onSend,
}: OrderChatTabProps) {
  return (
    <div
      className={cn(
        "absolute inset-0 flex flex-col",
        !isActive && "hidden",
      )}
    >
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 min-h-0">
        {!isReady ? (
          <ChatSkeleton />
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
              <MessageSquare className="w-6 h-6 text-gray-300" />
            </div>
            <p className="text-sm font-medium text-gray-400">No messages yet</p>
            <p className="text-xs text-gray-300 mt-1">
              Start the conversation with your team
            </p>
          </div>
        ) : (
          messages.map((m) => {
            const isMine = m.senderId === currentUserId;
            const roleColor =
              ROLE_COLOR[m.senderRole] ?? "bg-gray-100 text-gray-700";
            const roleBadge = ROLE_BADGE[m.senderRole] ?? m.senderRole;
            const initials = m.senderName
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();
            return (
              <div
                key={m.id}
                className={cn(
                  "flex gap-2 items-end",
                  isMine ? "flex-row-reverse" : "flex-row",
                )}
              >
                {/* Avatar */}
                <div
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mb-0.5",
                    roleColor,
                  )}
                >
                  {initials}
                </div>
                <div
                  className={cn(
                    "max-w-[75%] space-y-1 flex flex-col",
                    isMine ? "items-end" : "items-start",
                  )}
                >
                  {/* Name + badge + time */}
                  <div
                    className={cn(
                      "flex items-center gap-1.5 text-[10px]",
                      isMine ? "flex-row-reverse" : "flex-row",
                    )}
                  >
                    <span className="font-semibold text-gray-700">
                      {isMine ? "You" : m.senderName}
                    </span>
                    <span
                      className={cn(
                        "px-1.5 py-0.5 rounded text-[9px] font-bold",
                        roleColor,
                      )}
                    >
                      {roleBadge}
                    </span>
                    <span className="text-gray-400">
                      {new Date(m.createdAt).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  {/* Bubble */}
                  <div
                    className={cn(
                      "px-3 py-2 rounded-2xl text-sm leading-relaxed break-words",
                      isMine
                        ? "bg-[#15689E] text-white rounded-br-sm"
                        : "bg-gray-100 text-gray-800 rounded-bl-sm",
                    )}
                  >
                    {m.message}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="shrink-0 px-6 py-3 border-t border-gray-100 flex gap-2">
        <Input
          placeholder={
            isAdmin
              ? "Reply as Admin..."
              : canSign
                ? "Reply as Provider..."
                : isClinical
                  ? "Message your team..."
                  : "Send a message..."
          }
          value={newMessage}
          onChange={(e) => onNewMessageChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          disabled={sendingMsg}
          className="flex-1"
        />
        <Button
          size="icon"
          disabled={sendingMsg || !newMessage.trim()}
          onClick={onSend}
          className="bg-[#15689E] hover:bg-[#125d8e] text-white shrink-0"
        >
          {sendingMsg ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
