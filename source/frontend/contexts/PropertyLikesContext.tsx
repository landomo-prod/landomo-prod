"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";

const STORAGE_KEY = "landomo_liked_properties";

interface PropertyLikesContextValue {
  likedProperties: Set<string>;
  toggleLike: (propertyId: string) => void;
  isLiked: (propertyId: string) => boolean;
  getLikedPropertyIds: () => string[];
  clearAllLikes: () => void;
}

const PropertyLikesContext = createContext<PropertyLikesContextValue | null>(null);

export function PropertyLikesProvider({ children }: { children: ReactNode }) {
  const [likedProperties, setLikedProperties] = useState<Set<string>>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          return new Set(JSON.parse(stored));
        }
      } catch (error) {
        console.error("Failed to load liked properties from localStorage:", error);
      }
    }
    return new Set();
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(likedProperties)));
      } catch (error) {
        console.error("Failed to save liked properties to localStorage:", error);
      }
    }
  }, [likedProperties]);

  const toggleLike = useCallback((propertyId: string) => {
    setLikedProperties((prev) => {
      const next = new Set(prev);
      if (next.has(propertyId)) {
        next.delete(propertyId);
      } else {
        next.add(propertyId);
      }
      return next;
    });
  }, []);

  const isLiked = useCallback(
    (propertyId: string) => likedProperties.has(propertyId),
    [likedProperties]
  );

  const getLikedPropertyIds = useCallback(
    () => Array.from(likedProperties),
    [likedProperties]
  );

  const clearAllLikes = useCallback(() => {
    setLikedProperties(new Set());
  }, []);

  return (
    <PropertyLikesContext.Provider
      value={{ likedProperties, toggleLike, isLiked, getLikedPropertyIds, clearAllLikes }}
    >
      {children}
    </PropertyLikesContext.Provider>
  );
}

export function usePropertyLikesContext() {
  const context = useContext(PropertyLikesContext);
  if (!context) {
    throw new Error("usePropertyLikesContext must be used within a PropertyLikesProvider");
  }
  return context;
}
