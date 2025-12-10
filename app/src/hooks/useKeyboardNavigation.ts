import { useEffect } from "react";
import type { ImageData, PendingDeletion, PendingCrop } from "../types";

interface UseKeyboardNavigationOptions {
  images: ImageData[];
  currentIndex: number;
  isCropping: boolean;
  pendingCrop: PendingCrop | null;
  pendingDeletion: PendingDeletion | null;
  setSelectedImageId: React.Dispatch<React.SetStateAction<string | null>>;
  handleDeleteImage: () => void;
  handleUndoCrop: (pending: PendingCrop) => void;
  handleUndoDelete: (pending: PendingDeletion) => void;
}

export function useKeyboardNavigation({
  images,
  currentIndex,
  isCropping,
  pendingCrop,
  pendingDeletion,
  setSelectedImageId,
  handleDeleteImage,
  handleUndoCrop,
  handleUndoDelete,
}: UseKeyboardNavigationOptions) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInInput =
        target.tagName === "INPUT" || target.tagName === "TEXTAREA";
      const key = e.key.toLowerCase();
      const isCtrl = e.ctrlKey || e.metaKey;

      if (key === "z" && isCtrl) {
        if (pendingCrop) {
          e.preventDefault();
          handleUndoCrop(pendingCrop);
          return;
        }
        if (pendingDeletion) {
          e.preventDefault();
          handleUndoDelete(pendingDeletion);
          return;
        }
        return;
      }

      if (isInInput) return;
      if (images.length === 0) return;

      const isShift = e.shiftKey;

      if (key === "h") {
        if (isShift) {
          for (let i = currentIndex - 1; i >= 0; i--) {
            if (images[i].caption.trim() === "") {
              setSelectedImageId(images[i].id);
              break;
            }
          }
        } else {
          if (currentIndex > 0) {
            setSelectedImageId(images[currentIndex - 1].id);
          }
        }
      } else if (key === "l") {
        if (isShift) {
          for (let i = currentIndex + 1; i < images.length; i++) {
            if (images[i].caption.trim() === "") {
              setSelectedImageId(images[i].id);
              break;
            }
          }
        } else {
          if (currentIndex < images.length - 1) {
            setSelectedImageId(images[currentIndex + 1].id);
          }
        }
      } else if (key === "enter") {
        // Skip Enter handling when in crop mode (Enter applies the crop there)
        if (isCropping) return;
        const captionField = document.getElementById("caption");
        if (captionField) {
          e.preventDefault();
          captionField.focus();
        }
      } else if (key === "delete" || key === "d") {
        e.preventDefault();
        handleDeleteImage();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    images,
    currentIndex,
    isCropping,
    handleDeleteImage,
    pendingCrop,
    pendingDeletion,
    handleUndoCrop,
    handleUndoDelete,
    setSelectedImageId,
  ]);
}
