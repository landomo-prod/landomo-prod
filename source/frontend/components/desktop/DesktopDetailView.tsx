"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DetailScreen } from "@/components/screens/DetailScreen";
import { Property } from "@/types/property";

interface DesktopDetailViewProps {
  property: Property;
  onClose: () => void;
}

/**
 * DesktopDetailView - Full-screen detail view wrapper
 *
 * Wraps the mobile DetailScreen component for desktop display.
 * Shows property details in a full-screen overlay with close button.
 * Maintains mobile design language while optimizing for larger screens.
 */
export function DesktopDetailView({ property, onClose }: DesktopDetailViewProps) {
  return (
    <div className="fixed inset-0 z-[2000] bg-white">
      {/* Close Button - Top Right */}
      <div className="fixed top-6 right-6 z-[2001]">
        <Button
          onClick={onClose}
          size="icon"
          className="h-12 w-12 rounded-full border border-white/10 bg-black/20 text-white backdrop-blur-xl transition-transform hover:bg-black/30"
        >
          <X className="h-6 w-6" />
        </Button>
      </div>

      {/* Content Container - Centered with max-width for better readability */}
      <div className="h-full overflow-hidden">
        <div className="mx-auto h-full max-w-5xl">
          <DetailScreen
            propertyId={property.id}
            onNavigate={() => {
              // Desktop doesn't need navigation from detail view
              // Could implement if needed for filters, etc.
            }}
          />
        </div>
      </div>
    </div>
  );
}
