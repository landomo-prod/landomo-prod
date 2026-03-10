"use client";

import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/AuthProvider";

interface PortalNavigationProps {
  onLogoClick?: () => void;
  onMapExplorerClick?: () => void;
  onNotificationsClick?: () => void;
  /** @deprecated no longer has effect */
  hideMapExplorer?: boolean;
  /** @deprecated no longer has effect */
  fixed?: boolean;
}

export function PortalNavigation({
  onLogoClick,
  onMapExplorerClick,
  onNotificationsClick,
  hideMapExplorer = false,
}: PortalNavigationProps) {
  const router = useRouter();
  const { user, loading, signOut } = useAuth();

  return (
    <nav className="h-16 w-full flex items-center justify-between px-8 z-[100] bg-white border-b border-[#e2e8f0] flex-shrink-0">
      {/* Logo */}
      <div
        className="flex items-center cursor-pointer"
        onClick={onLogoClick}
      >
        <span className="text-[1.75rem] font-bold tracking-tight text-[#171717]">
          landomo<span className="text-[#84CC16]">.</span><span className="text-[#171717]">cz</span>
        </span>
      </div>

      {/* Center links */}
      <div className="hidden md:flex items-center gap-6 text-sm font-bold text-[#4a5568]">
        <a href="#" className="hover:text-[#84CC16] transition-colors">Buy</a>
        <a href="#" className="hover:text-[#84CC16] transition-colors">Rent</a>
        <a href="#" className="hover:text-[#84CC16] transition-colors">Sell</a>
        <a href="#" className="hover:text-[#84CC16] transition-colors">Home Loans</a>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-3">
        {!hideMapExplorer && onMapExplorerClick && (
          <button
            className="text-sm font-bold text-[#4a5568] hover:text-[#84CC16] transition-colors"
            onClick={onMapExplorerClick}
          >
            Map Explorer
          </button>
        )}
        {!loading && user ? (
          <div className="flex items-center gap-3">
            {onNotificationsClick && (
              <button
                onClick={onNotificationsClick}
                className="relative p-2 rounded-full text-[#4a5568] hover:bg-gray-100 transition-colors"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" />
              </button>
            )}
            <span className="text-sm font-medium text-[#4a5568] truncate max-w-[160px]">
              {user.user_metadata?.full_name || user.email}
            </span>
            <Button
              className="text-[#4a5568] px-4 py-2 rounded-full text-sm font-bold transition-colors border border-gray-200 bg-white hover:bg-gray-50"
              onClick={() => signOut()}
            >
              Log out
            </Button>
          </div>
        ) : (
          <Button
            className="text-white px-5 py-2 rounded-full text-sm font-bold transition-colors"
            style={{ backgroundColor: '#84CC16' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#6aaa10')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#84CC16')}
            onClick={() => router.push('/auth/login')}
          >
            Log in
          </Button>
        )}
      </div>
    </nav>
  );
}
