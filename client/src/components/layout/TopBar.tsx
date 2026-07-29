import { Menu, Settings } from "lucide-react";
import { Link, useLocation } from "wouter";

interface TopBarProps {
  onMenuClick: () => void;
}

export default function TopBar({ onMenuClick }: TopBarProps) {
  const [location] = useLocation();

  return (
    <header className="h-12 bg-gray-900 border-b border-gray-800 flex items-center px-3 gap-3 shrink-0">
      <button
        onClick={onMenuClick}
        className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
      >
        <Menu size={18} />
      </button>

      <div className="flex-1" />

      <Link href="/settings">
        <button
          className={`p-1.5 rounded-lg transition-colors ${
            location === "/settings"
              ? "text-brand-400 bg-brand-950"
              : "text-gray-500 hover:text-gray-300 hover:bg-gray-800"
          }`}
          title="Settings"
        >
          <Settings size={16} />
        </button>
      </Link>
    </header>
  );
}
