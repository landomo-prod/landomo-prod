"use client";

import { PropertyCard } from "@/components/PropertyCard";
import { Property } from "@/types/property";

interface PropertyCardCompactProps {
  property: Property;
  isLiked: boolean;
  onToggleLike: (propertyId: string) => void;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  isHovered?: boolean;
}

/**
 * PropertyCardCompact - Desktop wrapper for PropertyCard
 *
 * Wraps the existing PropertyCard component with desktop-list variant for
 * use in desktop split view layouts. Features:
 * - Condensed sizing: 280px width (container controlled), 180px image height
 * - Desktop hover states (hover:shadow-xl)
 * - Maintains carousel, like button, mobile design language
 * - Preserves PropertyCard's 158 lines of logic (no duplication)
 * - Supports onClick for detail panel integration
 */
export function PropertyCardCompact({
  property,
  isLiked,
  onToggleLike,
  onClick,
  onMouseEnter,
  onMouseLeave,
  isHovered,
}: PropertyCardCompactProps) {
  return (
    <div
      className={`group w-full rounded-3xl p-2 transition-all duration-300 cursor-pointer ${
        isHovered
          ? "card-pulse"
          : "hover:shadow-xl"
      }`}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <PropertyCard
        property={property}
        isLiked={isLiked}
        onToggleLike={onToggleLike}
        variant="desktop-list"
        onClick={onClick}
      />
      <style jsx>{`
        @keyframes card-pulse {
          0%, 100% {
            box-shadow: 0 4px 12px rgba(0,0,0,0.1), 0 0 0 0 rgba(28, 28, 30, 0.3);
            transform: scale(1);
          }
          50% {
            box-shadow: 0 8px 24px rgba(0,0,0,0.15), 0 0 0 4px rgba(28, 28, 30, 0);
            transform: scale(1.02);
          }
        }
        .card-pulse {
          animation: card-pulse 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
