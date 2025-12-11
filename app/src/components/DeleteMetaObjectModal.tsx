import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { X, AlertTriangle, Loader2 } from "lucide-react";

interface DeleteMetaObjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  metaObjectName: string;
  imageCount: number;
  isLoading?: boolean;
  isDeleting?: boolean;
}

export function DeleteMetaObjectModal({
  isOpen,
  onClose,
  onConfirm,
  metaObjectName,
  imageCount,
  isLoading = false,
  isDeleting = false,
}: DeleteMetaObjectModalProps) {
  const hasAssociations = imageCount > 0;

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-[60]">
      {/* Backdrop */}
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-black/50 transition-opacity duration-200 ease-out data-[closed]:opacity-0"
      />

      {/* Modal panel */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel
          transition
          className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden transition duration-200 ease-out data-[closed]:scale-95 data-[closed]:opacity-0"
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <DialogTitle className="text-lg font-semibold text-gray-900">
              Delete Meta Field
            </DialogTitle>
            <button
              type="button"
              onMouseDownCapture={onClose}
              disabled={isDeleting}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <>
                {/* Warning message */}
                {hasAssociations ? (
                  <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    <div className="text-sm text-red-800">
                      <p className="font-medium">
                        This action cannot be undone
                      </p>
                      <p className="mt-1 text-red-700">
                        The meta field "
                        <span className="font-semibold">{metaObjectName}</span>"
                        is connected to{" "}
                        <span className="font-semibold">{imageCount}</span>{" "}
                        {imageCount === 1 ? "image" : "images"}. Deleting it
                        will permanently remove all associated metadata values
                        from those images.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-800">
                      <p>
                        Are you sure you want to delete the meta field "
                        <span className="font-semibold">{metaObjectName}</span>
                        "?
                      </p>
                    </div>
                  </div>
                )}

                <p className="text-sm text-gray-500 italic">
                  Note: Your image files will not be affected, only the metadata
                  values.
                </p>
              </>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-200">
            <button
              type="button"
              onMouseDownCapture={onClose}
              disabled={isDeleting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onMouseDownCapture={onConfirm}
              disabled={isLoading || isDeleting}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 flex items-center gap-2"
            >
              {isDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
              {hasAssociations ? "Delete Field & Data" : "Delete Field"}
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
