import { X, Undo2 } from "lucide-react";
import toast from "react-hot-toast";
import type { PendingDeletion, PendingCrop } from "../types";

interface DeleteToastProps {
  t: { visible: boolean; id: string };
  pending: PendingDeletion;
  onUndo: (pending: PendingDeletion) => void;
  onDismiss: (pending: PendingDeletion) => void;
}

export function DeleteToast({
  t,
  pending,
  onUndo,
  onDismiss,
}: DeleteToastProps) {
  return (
    <div
      className={`${
        t.visible ? "animate-enter" : "animate-leave"
      } max-w-md w-full bg-gray-900 shadow-lg rounded-lg pointer-events-auto flex items-center gap-3 px-4 py-3`}
    >
      <p className="flex-1 text-sm text-white">
        Deleted <span className="font-medium">{pending.image.fileName}</span>
      </p>
      <button
        type="button"
        onMouseDownCapture={() => {
          toast.dismiss(t.id);
          onUndo(pending);
        }}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-gray-700 hover:bg-gray-600 rounded-md transition-colors cursor-pointer"
      >
        <Undo2 className="w-4 h-4" />
        Undo
      </button>
      <button
        type="button"
        onMouseDownCapture={() => {
          toast.dismiss(t.id);
          onDismiss(pending);
        }}
        className="p-1.5 text-gray-400 hover:text-white transition-colors cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

interface CropToastProps {
  t: { visible: boolean; id: string };
  pending: PendingCrop;
  onUndo: (pending: PendingCrop) => void;
  onDismiss: () => void;
}

export function CropToast({ t, pending, onUndo, onDismiss }: CropToastProps) {
  return (
    <div
      className={`${
        t.visible ? "animate-enter" : "animate-leave"
      } max-w-md w-full bg-gray-900 shadow-lg rounded-lg pointer-events-auto flex items-center gap-3 px-4 py-3`}
    >
      <p className="flex-1 text-sm text-white">
        Cropped to{" "}
        <span className="font-medium">
          {pending.newWidth}×{pending.newHeight}
        </span>
      </p>
      <button
        type="button"
        onMouseDownCapture={() => {
          toast.dismiss(t.id);
          onUndo(pending);
        }}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-gray-700 hover:bg-gray-600 rounded-md transition-colors cursor-pointer"
      >
        <Undo2 className="w-4 h-4" />
        Undo
      </button>
      <button
        type="button"
        onMouseDownCapture={() => {
          toast.dismiss(t.id);
          onDismiss();
        }}
        className="p-1.5 text-gray-400 hover:text-white transition-colors cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
