import { useState } from "react";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { X, AlertTriangle } from "lucide-react";

interface BulkEditModalProps {
  isOpen: boolean;
  imageCount: number;
  onClose: () => void;
  onOverwrite: (caption: string) => void;
}

export function BulkEditModal({
  isOpen,
  imageCount,
  onClose,
  onOverwrite,
}: BulkEditModalProps) {
  const [caption, setCaption] = useState("");

  const handleOverwrite = () => {
    onOverwrite(caption);
    onClose();
  };

  // Reset caption when modal closes
  const handleClose = () => {
    setCaption("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
      {/* Backdrop */}
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-black/50 transition-opacity duration-200 ease-out data-[closed]:opacity-0"
      />

      {/* Modal panel */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel
          transition
          className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden transition duration-200 ease-out data-[closed]:scale-95 data-[closed]:opacity-0"
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <DialogTitle className="text-lg font-semibold text-gray-900">
              Bulk Edit Captions
            </DialogTitle>
            <button
              type="button"
              onClick={handleClose}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-4">
            {/* Warning message */}
            <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-medium">
                  This will overwrite all existing captions
                </p>
                <p className="mt-1 text-amber-700">
                  {imageCount} caption{imageCount !== 1 ? "s" : ""} will be
                  replaced with the text below.
                </p>
              </div>
            </div>

            {/* Caption input */}
            <div>
              <label
                htmlFor="bulk-caption"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Caption
              </label>
              <textarea
                id="bulk-caption"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Enter caption for all images..."
                className="w-full h-32 p-3 text-sm border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                autoFocus
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-200">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleOverwrite}
              className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors cursor-pointer"
            >
              Overwrite {imageCount} caption{imageCount !== 1 ? "s" : ""}
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
