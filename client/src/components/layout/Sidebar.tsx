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
    enabled: !!user,
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

  // Close context menu on outside click
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
          "group relative flex items-start gap-2 px-2 py-2 rounded-lg cursor-pointer transition-colors",
          isActive ? "bg-gray-800" : "hover:bg-gray-900"
        )}
        onClick={() => navigate(`/chat/${conv.id}`)}
      >
        <MessageSquare size={13} className="shrink-0 mt-0.5 text-gray-600" />
        <div className="flex-1 min-w-0">
          <p className={cn("text-xs font-medium truncate", isActive ? "text-gray-100" : "text-gray-400")}>
            {truncate(conv.title, 36)}
          </p>
          <p className="text-xs text-gray-600">{timeAgo(conv.updatedAt)}</p>
        </div>
        <button
          className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-600 hover:text-gray-400 shrink-0 transition-all"
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
        <div className="fixed inset-0 bg-black/60 z-20 lg:hidden" onClick={onClose} />
      )}

      <aside className={cn(
        "fixed lg:relative z-30 lg:z-auto flex flex-col w-64 h-full bg-gray-950 border-r border-gray-800 transition-transform duration-200",
        open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        {/* Logo */}
        <div className="flex items-center justify-between px-4 h-13 py-3 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center">
              <Cpu size={15} className="text-white" />
            </div>
            <span className="font-bold text-white text-base tracking-tight">iHeal AI</span>
          </div>
          <button onClick={onClose} className="lg:hidden p-1 rounded text-gray-600 hover:text-gray-300">
            <X size={17} />
          </button>
        </div>

        {/* New chat button */}
        <div className="px-3 pt-3 pb-2 shrink-0">
          <button
            onClick={() => createConv.mutate()}
            disabled={createConv.isPending}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium transition-colors"
          >
            <Plus size={14} />
            New conversation
          </button>
        </div>

        {/* Search */}
        <div className="px-3 pb-2 shrink-0">
          <input
            type="text"
            placeholder="Search conversations…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-gray-900 border border-gray-800 text-gray-300 text-xs rounded-lg px-3 py-1.5 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
          />
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
          {pinned.length > 0 && (
            <>
              <p className="text-xs text-gray-700 uppercase tracking-wider px-2 pt-2 pb-1 font-semibold">Pinned</p>
              {pinned.map((c) => <ConvItem key={c.id} conv={c} />)}
              <div className="border-t border-gray-800 mt-2 mb-1" />
            </>
          )}

          {unpinned.length === 0 && pinned.length === 0 ? (
            <p className="text-xs text-gray-700 text-center py-8">No conversations yet</p>
          ) : (
            unpinned.map((c) => <ConvItem key={c.id} conv={c} />)
          )}
        </div>

        {/* Context menu */}
        {contextMenu && (
          <div
            ref={menuRef}
            className="fixed z-50 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl py-1 w-40"
            style={{ top: contextMenu.y + 4, left: Math.min(contextMenu.x, window.innerWidth - 170) }}
          >
            {(() => {
              const conv = conversations.find((c) => c.id === contextMenu.id);
              return (
                <>
                  <button
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-300 hover:bg-gray-800 transition-colors"
                    onClick={() => {
                      pinConv.mutate({ id: contextMenu.id, pinned: !conv?.pinned });
                      setContextMenu(null);
                    }}
                  >
                    <Pin size={12} /> {conv?.pinned ? "Unpin" : "Pin"}
                  </button>
                  <button
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-gray-800 transition-colors"
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
        <div className="border-t border-gray-800 px-2 py-2 shrink-0">
          {navItems.map(({ icon: Icon, label, href }) => (
            <Link key={href} href={href}>
              <div className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors",
                location === href ? "bg-gray-800 text-gray-200" : "text-gray-600 hover:bg-gray-900 hover:text-gray-300"
              )}>
                <Icon size={14} />
                {label}
              </div>
            </Link>
          ))}
          <Link href="/profile">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer hover:bg-gray-900 transition-colors mt-1">
              <div className="w-5 h-5 rounded-full bg-brand-700 flex items-center justify-center text-xs font-bold text-white shrink-0">
                {user?.name?.[0]?.toUpperCase()}
              </div>
              <span className="text-xs text-gray-600 truncate flex-1">{user?.name}</span>
            </div>
          </Link>
        </div>
      </aside>
    </>
  );
}
