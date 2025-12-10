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
      const imageToRestoreIdx = images.findIndex(
        (img) => img.id === pending.imageId,
      );
      if (imageToRestoreIdx === -1) {
        setPendingCrop(null);
        return;
      }
      const imageToRestore = images[imageToRestoreIdx];

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
        const idx = draft.findIndex((i) => i.id === pending.imageId);
        if (idx !== -1) {
          draft[idx].file = restoredFile;
          draft[idx].fullImageUrl = restoredFullImageUrl;
          draft[idx].width = pending.originalWidth;
          draft[idx].height = pending.originalHeight;
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
      const imageToUpdateIdx = images.findIndex((img) => img.id === imageId);
      if (imageToUpdateIdx === -1) return;
      const imageToUpdate = images[imageToUpdateIdx];

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
        const idx = draft.findIndex((i) => i.id === imageId);
        if (idx !== -1) {
          draft[idx].file = newFile;
          draft[idx].fullImageUrl = newFullImageUrl;
          draft[idx].width = newWidth;
          draft[idx].height = newHeight;
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
