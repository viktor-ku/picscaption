import { useRef, useEffect, useState } from "react";
import clsx from "clsx";
import type { ImageData } from "../types";

interface FilmstripProps {
  images: ImageData[];
  selectedImageId: string | null;
  onSelectImage: (id: string) => void;
  onRemoveBrokenImage?: (id: string) => void;
}

function EyeIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="w-6 h-6 text-primary drop-shadow-md"
      aria-hidden="true"
    >
      <title>Selected</title>
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path
        fillRule="evenodd"
        d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113-1.487 4.471-5.705 7.697-10.677 7.697-4.97 0-9.186-3.223-10.675-7.69a1.762 1.762 0 0 1 0-1.113ZM17.25 12a5.25 5.25 0 1 1-10.5 0 5.25 5.25 0 0 1 10.5 0Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function Filmstrip({
  images,
  selectedImageId,
  onSelectImage,
  onRemoveBrokenImage,
}: FilmstripProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const selectedThumbnailRef = useRef<HTMLButtonElement>(null);
  // Track images that failed to load (locally hidden until parent removes them)
  const [brokenImageIds, setBrokenImageIds] = useState<Set<string>>(
    () => new Set(),
  );

  // Clear broken image tracking when images array changes (new folder loaded)
  // biome-ignore lint/correctness/useExhaustiveDependencies: Intentionally depends on images to reset when folder changes
  useEffect(() => {
    setBrokenImageIds(new Set());
  }, [images]);

  // Scroll selected thumbnail into view when selection changes
  useEffect(() => {
    if (!selectedThumbnailRef.current || !scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    const thumbnail = selectedThumbnailRef.current;

    const containerRect = container.getBoundingClientRect();
    const thumbnailRect = thumbnail.getBoundingClientRect();

    // Check if thumbnail is outside the visible area
    const isOutOfViewLeft = thumbnailRect.left < containerRect.left;
    const isOutOfViewRight = thumbnailRect.right > containerRect.right;

    if (isOutOfViewLeft || isOutOfViewRight) {
      thumbnail.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  });

  // Filter out broken images for display
  const visibleImages = images.filter((img) => !brokenImageIds.has(img.id));

  if (visibleImages.length === 0) {
    return null;
  }

  const handleImageError = (imageId: string) => {
    // Immediately hide in local state
    setBrokenImageIds((prev) => new Set(prev).add(imageId));
    // Notify parent to remove from state
    onRemoveBrokenImage?.(imageId);
  };

  return (
    <div className="bg-gray-100 border-t border-gray-200 px-4 py-3">
      <div ref={scrollContainerRef} className="flex gap-2 overflow-x-auto py-1">
        {visibleImages.map((image) => {
          const isSelected = image.id === selectedImageId;
          const hasCaption = image.caption.trim().length > 0;

          return (
            <button
              type="button"
              key={image.id}
              ref={isSelected ? selectedThumbnailRef : undefined}
              onClick={() => onSelectImage(image.id)}
              className={clsx(
                "relative flex-shrink-0 w-20 h-20 overflow-hidden cursor-pointer",
                "border-2 transition-colors",
                "focus:outline-none",
                hasCaption ? "border-caption-ready" : "border-transparent",
              )}
            >
              {image.thumbnailUrl ? (
                <img
                  src={image.thumbnailUrl}
                  alt={image.fileName}
                  className="w-full h-full object-cover transition-opacity duration-200"
                  loading="lazy"
                  onError={() => handleImageError(image.id)}
                />
              ) : (
                <div className="w-full h-full bg-gray-300 animate-pulse" />
              )}
              {isSelected && (
                <div className="absolute inset-0 bg-white/40 flex items-center justify-center">
                  <EyeIcon />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
