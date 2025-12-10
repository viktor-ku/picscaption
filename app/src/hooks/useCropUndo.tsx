import { useCallback } from "react";
import { useAtom } from "jotai";
import toast from "react-hot-toast";
import type { ImageData, PendingCrop } from "../types";
import { CropToast } from "../components/UndoToast";
import { pendingCropAtom } from "../lib/store";

interface UseCropUndoOptions {
  images: ImageData[];
  directoryHandleRef: React.RefObject<FileSystemDirectoryHandle | null>;
  setImages: (fn: (draft: ImageData[]) => void) => void;
}

export function useCropUndo({
  images,
  directoryHandleRef,
  setImages,
}: UseCropUndoOptions) {
  const [pendingCrop, setPendingCrop] = useAtom(pendingCropAtom);

  const handleUndoCrop = useCallback(
    async (pending: PendingCrop) => {
      toast.dismiss(pending.toastId);
      const imageToRestore = images.find((img) => img.id === pending.imageId);
      if (!imageToRestore) {
        setPendingCrop(null);
        return;
      }

      const restoredBlob = new Blob([pending.originalData], {
        type: pending.originalType,
      });
      const restoredFile = new File([restoredBlob], imageToRestore.fileName, {
        type: pending.originalType,
      });
      const restoredFullImageUrl = URL.createObjectURL(restoredFile);

      if (imageToRestore.fullImageUrl) {
        URL.revokeObjectURL(imageToRestore.fullImageUrl);
      }

      setImages((draft) => {
        const img = draft.find((i) => i.id === pending.imageId);
        if (img) {
          img.file = restoredFile;
          img.fullImageUrl = restoredFullImageUrl;
          img.width = pending.originalWidth;
          img.height = pending.originalHeight;
        }
      });

      if (directoryHandleRef.current) {
        try {
          const fileHandle = await directoryHandleRef.current.getFileHandle(
            imageToRestore.fileName,
            { create: false },
          );
          const writable = await fileHandle.createWritable();
          await writable.write(restoredBlob);
          await writable.close();
        } catch (err) {
          console.error("Failed to restore original image to disk:", err);
        }
      }

      setPendingCrop(null);
    },
    [images, directoryHandleRef, setImages, setPendingCrop],
  );

  const handleCancelCrop = useCallback(() => {
    if (pendingCrop) {
      handleUndoCrop(pendingCrop);
    }
  }, [pendingCrop, handleUndoCrop]);

  const handleCropConfirm = useCallback(
    async (
      imageId: string,
      newBlob: Blob,
      newWidth: number,
      newHeight: number,
    ) => {
      const imageToUpdate = images.find((img) => img.id === imageId);
      if (!imageToUpdate) return;

      if (pendingCrop) {
        toast.dismiss(pendingCrop.toastId);
        setPendingCrop(null);
      }

      const originalData = await imageToUpdate.file.arrayBuffer();
      const originalType = imageToUpdate.file.type || "image/png";
      const originalWidth = imageToUpdate.width ?? 0;
      const originalHeight = imageToUpdate.height ?? 0;

      const newFile = new File([newBlob], imageToUpdate.fileName, {
        type: newBlob.type || "image/png",
      });
      const newFullImageUrl = URL.createObjectURL(newFile);

      if (imageToUpdate.fullImageUrl) {
        URL.revokeObjectURL(imageToUpdate.fullImageUrl);
      }

      setImages((draft) => {
        const img = draft.find((i) => i.id === imageId);
        if (img) {
          img.file = newFile;
          img.fullImageUrl = newFullImageUrl;
          img.width = newWidth;
          img.height = newHeight;
        }
      });

      if (directoryHandleRef.current) {
        try {
          const fileHandle = await directoryHandleRef.current.getFileHandle(
            imageToUpdate.fileName,
            { create: false },
          );
          const writable = await fileHandle.createWritable();
          await writable.write(newBlob);
          await writable.close();
        } catch (err) {
          console.error("Failed to save cropped image to disk:", err);
        }
      }

      const toastId = `crop-${imageId}-${Date.now()}`;
      const pending: PendingCrop = {
        imageId,
        originalData,
        originalType,
        originalWidth,
        originalHeight,
        newWidth,
        newHeight,
        toastId,
      };
      setPendingCrop(pending);

      toast.custom(
        (t) => (
          <CropToast
            t={t}
            pending={pending}
            onUndo={handleUndoCrop}
            onDismiss={() => setPendingCrop(null)}
          />
        ),
        { id: toastId, duration: 5000 },
      );

      setTimeout(() => {
        setPendingCrop((current) => {
          if (current?.toastId === toastId) {
            return null;
          }
          return current;
        });
      }, 5000);
    },
    [
      images,
      pendingCrop,
      handleUndoCrop,
      directoryHandleRef,
      setImages,
      setPendingCrop,
    ],
  );

  return {
    pendingCrop,
    setPendingCrop,
    handleUndoCrop,
    handleCancelCrop,
    handleCropConfirm,
  };
}
