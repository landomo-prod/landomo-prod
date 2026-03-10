"use client";

import { useState } from "react";
import Image from "next/image";
import { Lightbox } from "@/components/Lightbox";

interface PropertyGalleryProps {
  images: string[];
  alt: string;
}

export function PropertyGallery({ images, alt }: PropertyGalleryProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  if (images.length === 0) return null;

  // Layout: 1 large + up to 4 small thumbnails
  const mainImage = images[0];
  const thumbImages = images.slice(1, 5);
  const remainingCount = images.length - 5;

  return (
    <>
      <div className="grid grid-cols-4 grid-rows-2 gap-2 rounded-2xl overflow-hidden" style={{ height: "420px" }}>
        {/* Main image — spans 2 cols + 2 rows */}
        <div
          className="col-span-2 row-span-2 relative cursor-pointer bg-gray-100"
          onClick={() => openLightbox(0)}
        >
          <Image
            src={mainImage}
            alt={alt}
            fill
            priority
            className="object-cover"
            sizes="(max-width: 1024px) 60vw, 480px"
          />
        </div>

        {/* Thumbnails */}
        {thumbImages.map((img, i) => (
          <div
            key={i}
            className="relative cursor-pointer bg-gray-100"
            onClick={() => openLightbox(i + 1)}
          >
            <Image
              src={img}
              alt={`${alt} - foto ${i + 2}`}
              fill
              loading="lazy"
              className="object-cover"
              sizes="(max-width: 1024px) 30vw, 240px"
            />
            {/* "Show all" overlay on last thumbnail */}
            {i === thumbImages.length - 1 && remainingCount > 0 && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <span className="text-white font-bold text-sm">+{remainingCount} more</span>
              </div>
            )}
          </div>
        ))}

        {/* Fill empty slots if fewer than 4 thumbnails */}
        {thumbImages.length < 4 &&
          Array.from({ length: 4 - thumbImages.length }).map((_, i) => (
            <div key={`empty-${i}`} className="bg-gray-100" />
          ))}
      </div>

      {lightboxOpen && (
        <Lightbox
          images={images}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
          onNavigate={setLightboxIndex}
        />
      )}
    </>
  );
}
