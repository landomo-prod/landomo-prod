"use client";

import { useEffect, useRef, useState } from "react";
import { Home } from "lucide-react";
import { GridCard } from "@/components/ui/GridCard";
import { Property } from "@/types/property";

interface CardGridProps {
  properties: Property[];
  isLiked: (id: string) => boolean;
  onToggleLike: (id: string) => void;
  onPropertyClick: (property: Property) => void;
  onMouseEnter?: (id: string) => void;
  onMouseLeave?: () => void;
  hoveredPropertyId?: string | null;
  minCardWidth?: number;
  className?: string;
}

export function CardGrid({
  properties,
  isLiked,
  onToggleLike,
  onPropertyClick,
  onMouseEnter,
  onMouseLeave,
  hoveredPropertyId,
  minCardWidth = 300,
  className = "",
}: CardGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const calculate = (width: number) => {
      const gap = 20; // gap-5 = 20px
      const cols = Math.max(1, Math.floor((width + gap) / (minCardWidth + gap)));
      setColumns(cols);
    };

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) calculate(width);
    });

    observer.observe(el);
    calculate(el.getBoundingClientRect().width);

    return () => observer.disconnect();
  }, [minCardWidth]);

  if (properties.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Home className="h-12 w-12 text-gray-300 mb-4" />
        <p className="text-lg font-semibold text-gray-500">No properties found</p>
        <p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`grid gap-5 ${className}`}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {properties.map((property, index) => (
        <GridCard
          key={property.id}
          property={property}
          isLiked={isLiked(property.id)}
          onToggleLike={onToggleLike}
          onClick={() => onPropertyClick(property)}
          onMouseEnter={() => onMouseEnter?.(property.id)}
          onMouseLeave={onMouseLeave}
          isHovered={hoveredPropertyId === property.id}
          index={index}
        />
      ))}
    </div>
  );
}
