import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { History, X } from "lucide-react";

interface RestoreHistoryModalProps {
  isOpen: boolean;
  matchedCount: number;
  totalCount: number;
  onRestore: () => void;
  onDiscard: () => void;
}

export function RestoreHistoryModal({
  isOpen,
  matchedCount,
  totalCount,
  onRestore,
  onDiscard,
}: RestoreHistoryModalProps) {
  return (
    <Dialog open={isOpen} onClose={onDiscard} className="relative z-50">
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
            <DialogTitle className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <History className="w-5 h-5 text-amber-600" />
              </div>
              <span className="text-lg font-semibold text-gray-900">
                Previous History Found
              </span>
            </DialogTitle>
            <button
              type="button"
              onClick={onDiscard}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6">
            <p className="text-gray-700 text-center text-lg mb-2">
              <span className="font-semibold text-amber-600">
                {matchedCount}
              </span>{" "}
              out of <span className="font-semibold">{totalCount}</span> images
              have previous editing history
            </p>
            <p className="text-gray-500 text-center text-sm mb-6">
              Would you like to restore it?
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onDiscard}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
              >
                No, start fresh
              </button>
              <button
                type="button"
                onClick={onRestore}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors cursor-pointer"
              >
                Yes, restore
              </button>
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
