import { useState } from "react";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
  RadioGroup,
} from "@headlessui/react";
import { X, Tags, Info } from "lucide-react";
import type { Id } from "../../convex/_generated/dataModel";
import { TagInput } from "./TagInput";

export type BulkTagMode = "add" | "replace";

interface BulkTagsDrawerProps {
  isOpen: boolean;
  imageCount: number;
  onClose: () => void;
  onApply: (tags: string[], mode: BulkTagMode) => void;
  userId: Id<"users"> | null;
}

export function BulkTagsDrawer({
  isOpen,
  imageCount,
  onClose,
  onApply,
  userId,
}: BulkTagsDrawerProps) {
  const [tags, setTags] = useState<string[]>([]);
  const [mode, setMode] = useState<BulkTagMode>("add");

  const handleApply = () => {
    if (tags.length > 0) {
      onApply(tags, mode);
      onClose();
    }
  };

  // Reset state when drawer closes
  const handleClose = () => {
    setTags([]);
    setMode("add");
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
              <Tags className="w-5 h-5 text-primary" />
              Bulk Add Tags
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
          <div className="p-6 space-y-6 overflow-y-auto flex-1">
            {/* Info message */}
            <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium">Apply tags to {imageCount} images</p>
                <p className="mt-1 text-blue-700">
                  Choose whether to add these tags to existing tags or replace
                  all tags.
                </p>
              </div>
            </div>

            {/* Mode selection */}
            <div>
              <span className="block text-sm font-medium text-gray-700 mb-3">
                Mode
              </span>
              <RadioGroup value={mode} onChange={setMode} className="space-y-2">
                <RadioGroup.Option
                  value="add"
                  className={({ checked }) =>
                    `flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                      checked
                        ? "border-primary bg-primary/5"
                        : "border-gray-200 hover:bg-gray-50"
                    }`
                  }
                >
                  {({ checked }) => (
                    <>
                      <div
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          checked ? "border-primary" : "border-gray-300"
                        }`}
                      >
                        {checked && (
                          <div className="w-2 h-2 rounded-full bg-primary" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          Add to existing
                        </p>
                        <p className="text-xs text-gray-500">
                          Keep existing tags and add these new ones
                        </p>
                      </div>
                    </>
                  )}
                </RadioGroup.Option>
                <RadioGroup.Option
                  value="replace"
                  className={({ checked }) =>
                    `flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                      checked
                        ? "border-primary bg-primary/5"
                        : "border-gray-200 hover:bg-gray-50"
                    }`
                  }
                >
                  {({ checked }) => (
                    <>
                      <div
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          checked ? "border-primary" : "border-gray-300"
                        }`}
                      >
                        {checked && (
                          <div className="w-2 h-2 rounded-full bg-primary" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          Replace all
                        </p>
                        <p className="text-xs text-gray-500">
                          Remove existing tags and set only these
                        </p>
                      </div>
                    </>
                  )}
                </RadioGroup.Option>
              </RadioGroup>
            </div>

            {/* Tag input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tags
              </label>
              <TagInput
                tags={tags}
                onTagsChange={setTags}
                userId={userId}
                placeholder="Add tags to apply..."
              />
              <p className="mt-2 text-xs text-gray-500">
                Press comma or enter to add a tag
              </p>
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
              onMouseDownCapture={handleApply}
              disabled={tags.length === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {mode === "add" ? "Add" : "Replace"} tags on {imageCount} image
              {imageCount !== 1 ? "s" : ""}
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
