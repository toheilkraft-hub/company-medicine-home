import { Menu, Settings } from "lucide-react";
import { Link, useLocation } from "wouter";

interface TopBarProps {
  onMenuClick: () => void;
}

export default function TopBar({ onMenuClick }: TopBarProps) {
  const [location] = useLocation();

  return (
    <header className="h-12 bg-white border-b border-gray-200 flex items-center px-3 gap-3 shrink-0">
      <button
        onClick={onMenuClick}
        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
      >
        <Menu size={18} />
      </button>

      <div className="flex-1" />

      <Link href="/settings">
        <button
          className={`p-1.5 rounded-lg transition-colors ${
            location === "/settings"
              ? "text-brand-600 bg-brand-50"
              : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"
          }`}
          title="Settings"
        >
          <Settings size={16} />
        </button>
      </Link>
    </header>
  );
}
