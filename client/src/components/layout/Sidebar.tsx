import { Link, useLocation } from "wouter";
import {
  Cpu, Inbox, MessageSquare, Satellite, Settings, User, X,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../../lib/queryClient";
import { useAuth } from "../../contexts/AuthContext";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

interface InboxCounts {
  counts: { new: number };
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const [location] = useLocation();
  const { user } = useAuth();

  const { data: inboxData } = useQuery<InboxCounts>({
    queryKey: ["inbox", "all"],
    queryFn: () => apiFetch("/api/inbox?status=all&limit=1"),
    refetchInterval: 15000,
    select: (d: any) => d,
  });

  const newCount = (inboxData as any)?.counts?.new ?? 0;

  const primaryNav = [
    { icon: Inbox, label: "Inbox", href: "/inbox", badge: newCount },
    { icon: MessageSquare, label: "AI Chat", href: "/chat" },
    { icon: Satellite, label: "Collectors", href: "/collectors" },
  ];

  const secondaryNav = [
    { icon: Settings, label: "Settings", href: "/settings" },
    { icon: User, label: "Profile", href: "/profile" },
  ];

  function NavLink({
    icon: Icon,
    label,
    href,
    badge,
  }: {
    icon: React.ElementType;
    label: string;
    href: string;
    badge?: number;
  }) {
    const active = location === href || (href !== "/inbox" && location.startsWith(href));
    return (
      <Link href={href}>
        <div
          onClick={onClose}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium cursor-pointer transition-colors relative",
            active
              ? "bg-brand-50 text-brand-700 border border-brand-100"
              : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 border border-transparent"
          )}
        >
          <Icon size={15} className={active ? "text-brand-600" : "text-gray-400"} />
          <span>{label}</span>
          {badge != null && badge > 0 && (
            <span className="ml-auto bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
              {badge}
            </span>
          )}
        </div>
      </Link>
    );
  }

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 bg-black/20 z-20 lg:hidden" onClick={onClose} />
      )}

      <aside
        className={cn(
          "flex flex-col h-full bg-white border-r border-gray-200 overflow-hidden shrink-0 transition-all duration-300",
          "fixed z-30 lg:relative lg:z-auto",
          open ? "w-56 translate-x-0" : "w-56 -translate-x-full lg:translate-x-0 lg:w-0"
        )}
      >
        <div className="flex flex-col h-full w-56 min-w-[14rem]">
          {/* Logo */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center shadow-sm">
                <Cpu size={15} className="text-white" />
              </div>
              <div>
                <span className="font-bold text-gray-900 text-sm tracking-tight">iHeal AI</span>
                <p className="text-[10px] text-gray-400 leading-none">Intelligence Platform</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="lg:hidden p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            >
              <X size={16} />
            </button>
          </div>

          {/* Primary nav */}
          <nav className="px-2 pt-3 pb-2 space-y-0.5 shrink-0">
            <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 px-3 pb-1.5">Platform</p>
            {primaryNav.map((item) => (
              <NavLink key={item.href} {...item} />
            ))}
          </nav>

          <div className="mx-3 border-t border-gray-100 my-1" />

          {/* Spacer */}
          <div className="flex-1" />

          {/* Bottom nav */}
          <div className="border-t border-gray-100 px-2 py-2 shrink-0">
            {secondaryNav.map((item) => (
              <NavLink key={item.href} {...item} />
            ))}

            <Link href="/profile">
              <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors mt-1">
                <div className="w-6 h-6 rounded-full bg-brand-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                  {user?.name?.[0]?.toUpperCase() ?? "G"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-700 truncate">{user?.name ?? "Guest"}</p>
                  <p className="text-[10px] text-gray-400">View profile</p>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}
