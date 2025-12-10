import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { X, Trash2 } from "lucide-react";

interface DeleteAllDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteAllDataModal({
  isOpen,
  onClose,
  onConfirm,
}: DeleteAllDataModalProps) {
  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
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
              Delete All Data
            </DialogTitle>
            <button
              type="button"
              onMouseDownCapture={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-4">
            {/* Warning message */}
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <Trash2 className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="text-sm text-red-800">
                <p className="font-medium">This action cannot be undone</p>
                <p className="mt-1 text-red-700">
                  All saved captions and settings will be permanently deleted.
                  You'll need to start over from scratch.
                </p>
              </div>
            </div>

            <p className="text-sm text-gray-600">
              Are you sure you want to delete all your data?
            </p>

            <p className="text-sm text-gray-500 italic">
              Note: Your image files will not be affected.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-200">
            <button
              type="button"
              onMouseDownCapture={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onMouseDownCapture={onConfirm}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors cursor-pointer"
            >
              Delete All Data
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
