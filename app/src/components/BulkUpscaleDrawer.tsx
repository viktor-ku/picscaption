import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { X, Sparkles } from "lucide-react";

interface BulkUpscaleDrawerProps {
  isOpen: boolean;
  imageCount: number;
  onClose: () => void;
  onStart: (width: number, height: number) => void;
}

export function BulkUpscaleDrawer({
  isOpen,
  imageCount,
  onClose,
  onStart,
}: BulkUpscaleDrawerProps) {
  const [width, setWidth] = useState(
    () => localStorage.getItem("picscaption-bulk-upscale-width") ?? "",
  );
  const [height, setHeight] = useState(
    () => localStorage.getItem("picscaption-bulk-upscale-height") ?? "",
  );
  const widthInputRef = useRef<HTMLInputElement>(null);

  // Focus width input when drawer opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => widthInputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  const handleStart = () => {
    const w = Number.parseInt(width, 10);
    const h = Number.parseInt(height, 10);
    if (w > 0 && h > 0) {
      // Save to localStorage
      localStorage.setItem("picscaption-bulk-upscale-width", width);
      localStorage.setItem("picscaption-bulk-upscale-height", height);
      onStart(w, h);
      onClose();
    }
  };

  const handleClose = () => {
    onClose();
  };

  const isValid =
    width &&
    height &&
    Number.parseInt(width, 10) > 0 &&
    Number.parseInt(height, 10) > 0;

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
              <Sparkles className="w-5 h-5 text-primary" />
              Bulk Upscale
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
            <p className="text-sm text-gray-600">
              Upscale all {imageCount} image{imageCount !== 1 ? "s" : ""} to the
              specified dimensions.
            </p>

            {/* Dimension inputs */}
            <div className="flex items-center gap-4">
              <label className="flex-1">
                <span className="block text-sm font-medium text-gray-700 mb-1">
                  Width
                </span>
                <input
                  ref={widthInputRef}
                  type="number"
                  value={width}
                  onChange={(e) => setWidth(e.target.value)}
                  placeholder="px"
                  min={1}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </label>
              <label className="flex-1">
                <span className="block text-sm font-medium text-gray-700 mb-1">
                  Height
                </span>
                <input
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  placeholder="px"
                  min={1}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </label>
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
              onMouseDownCapture={handleStart}
              disabled={!isValid}
              className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-hover transition-colors cursor-pointer disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Start
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
