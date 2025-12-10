import { useCallback } from "react";
import { useAtom } from "jotai";
import toast from "react-hot-toast";
import type { ImageData, PendingDeletion } from "../types";
import { deleteCaptions, makeKey } from "../lib/storage";
import { DeleteToast } from "../components/UndoToast";
import { pendingDeletionAtom } from "../lib/store";

interface UseImageDeletionOptions {
  images: ImageData[];
  selectedImageId: string | null;
  currentDirectory: string | null;
  allowDeletions: boolean;
  directoryHandleRef: React.RefObject<FileSystemDirectoryHandle | null>;
  setImages: (fn: (draft: ImageData[]) => void) => void;
  setSelectedImageId: (id: string | null) => void;
}

export function useImageDeletion({
  images,
  selectedImageId,
  currentDirectory,
  allowDeletions,
  directoryHandleRef,
  setImages,
  setSelectedImageId,
}: UseImageDeletionOptions) {
  const [pendingDeletion, setPendingDeletion] = useAtom(pendingDeletionAtom);

  const handleFinalizeDelete = useCallback(
    async (pending: PendingDeletion) => {
      toast.dismiss(pending.toastId);
      if (currentDirectory) {
        try {
          const key = makeKey(currentDirectory, pending.image.fileName);
          await deleteCaptions([key]);
        } catch (err) {
          console.error("Failed to delete from IndexedDB:", err);
        }
      }
      if (pending.image.thumbnailUrl)
        URL.revokeObjectURL(pending.image.thumbnailUrl);
      if (pending.image.fullImageUrl)
        URL.revokeObjectURL(pending.image.fullImageUrl);
    },
    [currentDirectory],
  );

  const handleUndoDelete = useCallback(
    async (pending: PendingDeletion) => {
      toast.dismiss(pending.toastId);
      if (directoryHandleRef.current) {
        try {
          const fileHandle = await directoryHandleRef.current.getFileHandle(
            pending.image.fileName,
            { create: true },
          );
          const writable = await fileHandle.createWritable();
          await writable.write(pending.fileData);
          await writable.close();
        } catch (err) {
          console.error("Failed to restore file to disk:", err);
        }
      }
      setImages((draft) => {
        draft.splice(pending.originalIndex, 0, pending.image);
      });
      setSelectedImageId(pending.image.id);
      setPendingDeletion(null);
    },
    [directoryHandleRef, setImages, setSelectedImageId, setPendingDeletion],
  );

  const handleDeleteImage = useCallback(async () => {
    if (!allowDeletions) return;
    if (!selectedImageId || images.length === 0) return;

    const imageIndex = images.findIndex((img) => img.id === selectedImageId);
    if (imageIndex === -1) return;

    const imageToDelete = images[imageIndex];

    if (pendingDeletion) {
      handleFinalizeDelete(pendingDeletion);
    }

    const fileData = await imageToDelete.file.arrayBuffer();

    if (directoryHandleRef.current) {
      try {
        await directoryHandleRef.current.removeEntry(imageToDelete.fileName);
      } catch (err) {
        console.error("Failed to delete file from disk:", err);
      }
    }

    setImages((draft) => {
      const idx = draft.findIndex((img) => img.id === selectedImageId);
      if (idx !== -1) draft.splice(idx, 1);
    });

    if (images.length > 1) {
      const nextIndex =
        imageIndex < images.length - 1 ? imageIndex : imageIndex - 1;
      const nextImage =
        images[nextIndex === imageIndex ? imageIndex + 1 : nextIndex];
      if (nextImage && nextImage.id !== selectedImageId) {
        setSelectedImageId(nextImage.id);
      } else if (images.length > 1) {
        const otherImage = images.find((img) => img.id !== selectedImageId);
        setSelectedImageId(otherImage?.id ?? null);
      }
    } else {
      setSelectedImageId(null);
    }

    const toastId = `delete-${imageToDelete.id}-${Date.now()}`;
    const pending: PendingDeletion = {
      image: imageToDelete,
      originalIndex: imageIndex,
      toastId,
      fileData,
    };
    setPendingDeletion(pending);

    toast.custom(
      (t) => (
        <DeleteToast
          t={t}
          pending={pending}
          onUndo={handleUndoDelete}
          onDismiss={(p) => {
            handleFinalizeDelete(p);
            setPendingDeletion(null);
          }}
        />
      ),
      { id: toastId, duration: 30000 },
    );

    setTimeout(() => {
      setPendingDeletion((current) => {
        if (current?.toastId === toastId) {
          handleFinalizeDelete(current);
          return null;
        }
        return current;
      });
    }, 30000);
  }, [
    selectedImageId,
    images,
    pendingDeletion,
    handleFinalizeDelete,
    handleUndoDelete,
    allowDeletions,
    directoryHandleRef,
    setImages,
    setSelectedImageId,
    setPendingDeletion,
  ]);

  return {
    pendingDeletion,
    setPendingDeletion,
    handleDeleteImage,
    handleUndoDelete,
    handleFinalizeDelete,
  };
}
