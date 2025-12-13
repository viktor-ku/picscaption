import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { X, Keyboard } from "lucide-react";

interface KeybindingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const KEYBINDINGS = [
  { keys: "h", description: "Go to previous image" },
  { keys: "l", description: "Go to next image" },
  { keys: "Shift + H", description: "Jump to previous uncaptioned image" },
  { keys: "Shift + L", description: "Jump to next uncaptioned image" },
  { keys: "Enter", description: "Focus caption field" },
  { keys: "Escape", description: "Blur caption field" },
  { keys: "r", description: "Start cropping / Apply crop" },
  { keys: "d / Delete", description: "Delete current image" },
  { keys: "Ctrl + Z", description: "Undo (delete/crop)" },
];

export function KeybindingsDrawer({ isOpen, onClose }: KeybindingsDrawerProps) {
  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
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
              <Keyboard className="w-5 h-5 text-primary" />
              Keyboard Shortcuts
            </DialogTitle>
            <button
              type="button"
              onMouseDownCapture={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto flex-1">
            <table className="w-full">
              <tbody className="divide-y divide-gray-100">
                {KEYBINDINGS.map(({ keys, description }) => (
                  <tr key={keys}>
                    <td className="py-3 pr-4">
                      <kbd className="px-2 py-1 text-sm font-mono bg-gray-100 border border-gray-300 rounded text-gray-700">
                        {keys}
                      </kbd>
                    </td>
                    <td className="py-3 text-sm text-gray-600">
                      {description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
