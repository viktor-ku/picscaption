import { useState } from "react";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { X, AlertTriangle, Edit3 } from "lucide-react";

interface BulkEditDrawerProps {
  isOpen: boolean;
  imageCount: number;
  onClose: () => void;
  onOverwrite: (caption: string) => void;
}

export function BulkEditDrawer({
  isOpen,
  imageCount,
  onClose,
  onOverwrite,
}: BulkEditDrawerProps) {
  const [caption, setCaption] = useState("");

  const handleOverwrite = () => {
    onOverwrite(caption);
    onClose();
  };

  // Reset caption when drawer closes
  const handleClose = () => {
    setCaption("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
      {/* Backdrop */}
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-black/50 transition-opacity duration-300 ease-out data-[closed]:opacity-0"
      />

      {/* Drawer from left */}
      <div className="fixed inset-0">
        <DialogPanel
          transition
          className="fixed inset-y-0 left-0 w-full sm:w-1/2 lg:max-w-2xl bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-out data-[closed]:-translate-x-full"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-gray-900">
              <Edit3 className="w-5 h-5 text-primary" />
              Bulk Edit Captions
            </DialogTitle>
            <button
              type="button"
              onMouseDownCapture={handleClose}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4 overflow-y-auto flex-1">
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

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-200 shrink-0">
            <button
              type="button"
              onMouseDownCapture={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onMouseDownCapture={handleOverwrite}
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
