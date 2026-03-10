"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface SearchBarProps {
  value?: string;
  onChange?: (value: string) => void;
  onClick?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  variant?: "mobile" | "desktop";
  className?: string;
}

/**
 * SearchBar - Unified search component for mobile and desktop
 *
 * Supports two modes:
 * 1. Interactive mode (value + onChange): Actual search input
 * 2. Click mode (onClick): Non-interactive, navigates to search screen
 *
 * Mobile variant: rounded-full, shadow-xl (MapScreen, ListScreen)
 * Desktop variant: rounded-lg, focus ring (DesktopExplorer)
 */
export function SearchBar({
  value = "",
  onChange,
  onClick,
  placeholder = "Search address, city...",
  autoFocus = false,
  variant = "mobile",
  className = "",
}: SearchBarProps) {
  const isInteractive = !onClick;

  const baseStyles = "flex items-center gap-2 bg-white px-5 py-3";
  const variantStyles = {
    mobile: "rounded-full border border-gray-50 shadow-xl transition-transform",
    desktop: "rounded-lg border border-transparent bg-gray-50 focus-within:bg-white focus-within:border-blue-100 focus-within:ring-4 focus-within:ring-blue-50/50 transition-all",
  };

  const containerClasses = `${baseStyles} ${variantStyles[variant]} ${onClick ? "cursor-pointer" : ""} ${className}`;

  const iconClasses = variant === "desktop"
    ? "h-4 w-4 text-gray-400 transition-colors group-focus-within:text-blue-500"
    : "h-5 w-5 text-gray-400";

  const inputClasses = variant === "desktop"
    ? "h-auto border-0 bg-transparent p-0 text-sm font-medium text-gray-800 placeholder:text-gray-400 focus-visible:ring-0 outline-none"
    : "h-auto border-0 bg-transparent p-0 text-[15px] font-medium text-gray-800 placeholder:text-gray-400 focus-visible:ring-0";

  return (
    <div className={containerClasses} onClick={onClick}>
      <Search className={iconClasses} />
      <Input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={isInteractive ? (e) => onChange?.(e.target.value) : undefined}
        autoFocus={autoFocus}
        readOnly={!isInteractive}
        className={`${inputClasses} ${!isInteractive ? "pointer-events-none text-gray-400" : ""}`}
      />
    </div>
  );
}
