import { Link, useLocation } from "wouter";
import {
  MessageSquare, Settings, User, X, Plus, Cpu,
  Trash2, Pin, MoreHorizontal,
} from "lucide-react";
import { cn, truncate, timeAgo } from "../../lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../lib/queryClient";
import { useAuth } from "../../contexts/AuthContext";
import { useState, useRef, useEffect } from "react";

interface ConversationStub {
  id: number;
  title: string;
  updatedAt: string;
  pinned: boolean;
  model: string | null;
  provider: string | null;
}

const navItems = [
  { icon: Settings, label: "Settings", href: "/settings" },
  { icon: User, label: "Profile", href: "/profile" },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const [location, navigate] = useLocation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [contextMenu, setContextMenu] = useState<{ id: number; x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const { data: conversations = [] } = useQuery<ConversationStub[]>({
    queryKey: ["conversations", search],
    queryFn: () =>
      apiFetch<ConversationStub[]>(
        search
          ? `/api/chat/conversations?search=${encodeURIComponent(search)}`
          : "/api/chat/conversations"
      ),
  });

  const createConv = useMutation({
    mutationFn: () => apiFetch<{ id: number }>("/api/chat/conversations", "POST"),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      navigate(`/chat/${data.id}`);
    },
  });

  const deleteConv = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/chat/conversations/${id}`, "DELETE"),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      if (location === `/chat/${id}`) navigate("/chat");
    },
  });

  const pinConv = useMutation({
    mutationFn: ({ id, pinned }: { id: number; pinned: boolean }) =>
      apiFetch(`/api/chat/conversations/${id}`, "PATCH", { pinned }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["conversations"] }),
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const pinned = conversations.filter((c) => c.pinned);
  const unpinned = conversations.filter((c) => !c.pinned);

  const ConvItem = ({ conv }: { conv: ConversationStub }) => {
    const isActive = location === `/chat/${conv.id}`;
    return (
      <div
        className={cn(
          "group relative flex items-start gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-all",
          isActive
            ? "bg-brand-50 border border-brand-100"
            : "hover:bg-gray-100 border border-transparent"
        )}
        onClick={() => navigate(`/chat/${conv.id}`)}
      >
        <MessageSquare size={13} className={cn("shrink-0 mt-0.5", isActive ? "text-brand-500" : "text-gray-400")} />
        <div className="flex-1 min-w-0">
          <p className={cn("text-xs font-medium truncate", isActive ? "text-brand-700" : "text-gray-700")}>
            {truncate(conv.title, 34)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{timeAgo(conv.updatedAt)}</p>
        </div>
        <button
          className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-200 shrink-0 transition-all"
          onClick={(e) => {
            e.stopPropagation();
            const rect = (e.target as HTMLElement).getBoundingClientRect();
            setContextMenu({ id: conv.id, x: rect.right, y: rect.bottom });
          }}
        >
          <MoreHorizontal size={13} />
        </button>
      </div>
    );
  };

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 bg-black/20 z-20 lg:hidden" onClick={onClose} />
      )}

      {/* Sidebar — fixed overlay on mobile, flex item on desktop */}
      <aside className={cn(
        "flex flex-col h-full bg-white border-r border-gray-200 overflow-hidden shrink-0 transition-all duration-300",
        "fixed z-30 lg:relative lg:z-auto",
        open ? "w-64 translate-x-0" : "w-64 -translate-x-full lg:translate-x-0 lg:w-0"
      )}>
        {/* Inner wrapper keeps width fixed so content doesn't reflow while animating */}
        <div className="flex flex-col h-full w-64 min-w-[16rem]">
          {/* Logo */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center shadow-sm">
                <Cpu size={15} className="text-white" />
              </div>
              <div>
                <span className="font-bold text-gray-900 text-sm tracking-tight">iHeal AI</span>
                <p className="text-xs text-gray-400 leading-none">AI Assistant</p>
              </div>
            </div>
            <button onClick={onClose} className="lg:hidden p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
              <X size={16} />
            </button>
          </div>

          {/* New chat button */}
          <div className="px-3 pt-3 pb-2 shrink-0">
            <button
              onClick={() => createConv.mutate()}
              disabled={createConv.isPending}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 active:bg-brand-700 text-white text-xs font-semibold transition-colors shadow-sm disabled:opacity-60"
            >
              <Plus size={14} />
              New conversation
            </button>
          </div>

          {/* Search */}
          <div className="px-3 pb-3 shrink-0">
            <div className="relative">
              <input
                type="text"
                placeholder="Search conversations…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 text-gray-700 text-xs rounded-xl px-3 py-2 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 transition-all"
              />
            </div>
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
            {pinned.length > 0 && (
              <>
                <p className="text-[10px] text-gray-400 uppercase tracking-widest px-3 pt-2 pb-1 font-semibold">Pinned</p>
                {pinned.map((c) => <ConvItem key={c.id} conv={c} />)}
                <div className="border-t border-gray-100 my-2" />
              </>
            )}

            {unpinned.length === 0 && pinned.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                  <MessageSquare size={18} className="text-gray-400" />
                </div>
                <p className="text-xs text-gray-500 font-medium">No conversations yet</p>
                <p className="text-xs text-gray-400 mt-1">Click "New conversation" to start</p>
              </div>
            ) : (
              unpinned.map((c) => <ConvItem key={c.id} conv={c} />)
            )}
          </div>

          {/* Context menu */}
          {contextMenu && (
            <div
              ref={menuRef}
              className="fixed z-50 bg-white border border-gray-200 rounded-xl shadow-lg py-1 w-44"
              style={{ top: contextMenu.y + 4, left: Math.min(contextMenu.x, window.innerWidth - 180) }}
            >
              {(() => {
                const conv = conversations.find((c) => c.id === contextMenu.id);
                return (
                  <>
                    <button
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                      onClick={() => {
                        pinConv.mutate({ id: contextMenu.id, pinned: !conv?.pinned });
                        setContextMenu(null);
                      }}
                    >
                      <Pin size={12} className="text-gray-400" />
                      {conv?.pinned ? "Unpin" : "Pin to top"}
                    </button>
                    <div className="border-t border-gray-100 my-0.5" />
                    <button
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-red-500 hover:bg-red-50 transition-colors"
                      onClick={() => {
                        if (confirm("Delete this conversation?")) {
                          deleteConv.mutate(contextMenu.id);
                        }
                        setContextMenu(null);
                      }}
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  </>
                );
              })()}
            </div>
          )}

          {/* Bottom nav */}
          <div className="border-t border-gray-100 px-2 py-2 shrink-0">
            {navItems.map(({ icon: Icon, label, href }) => (
              <Link key={href} href={href}>
                <div className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium cursor-pointer transition-colors",
                  location === href
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                )}>
                  <Icon size={14} />
                  {label}
                </div>
              </Link>
            ))}

            <Link href="/profile">
              <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors mt-0.5">
                <div className="w-6 h-6 rounded-full bg-brand-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                  {user?.name?.[0]?.toUpperCase() ?? "G"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-700 truncate">{user?.name ?? "Guest"}</p>
                  <p className="text-xs text-gray-400 truncate">View profile</p>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}
