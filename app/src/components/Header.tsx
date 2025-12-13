import { Fragment, useState, useEffect, useRef } from "react";
import { useAtomValue } from "jotai";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import {
  Download,
  Upload,
  Image,
  Check,
  Loader2,
  ChevronDown,
  Settings,
  Sparkles,
  Wand2,
} from "lucide-react";
import clsx from "clsx";
import {
  importStateAtom,
  importProgressAtom,
  importStatsAtom,
  generateStateAtom,
  generateProgressAtom,
} from "../lib/store";

type SaveStatus = "saving" | "saved" | null;
type ExportFormat = "json" | "jsonl";

interface BulkUpscaleProgress {
  current: number;
  total: number;
}

interface BulkCaptionProgress {
  current: number;
  total: number;
}

interface HeaderProps {
  imageCount: number;
  captionedCount: number;
  saveStatus: SaveStatus;
  onExport: (format: ExportFormat) => void;
  onOpenImportModal: () => void;
  onShowSettings: () => void;
  onBulkEdit: () => void;
  onBulkUpscale: () => void;
  onBulkCaption: () => void;
  onBulkTags: () => void;
  onOpenGenerate: () => void;
  bulkUpscaleProgress?: BulkUpscaleProgress | null;
  bulkCaptionProgress?: BulkCaptionProgress | null;
}

export function Header({
  imageCount,
  captionedCount: _captionedCount,
  saveStatus,
  onExport,
  onOpenImportModal,
  onShowSettings,
  onBulkEdit,
  onBulkUpscale,
  onBulkCaption,
  onBulkTags,
  onOpenGenerate,
  bulkUpscaleProgress,
  bulkCaptionProgress,
}: HeaderProps) {
  const hasImages = imageCount > 0;
  const isUpscaling =
    bulkUpscaleProgress !== null && bulkUpscaleProgress !== undefined;
  const isCaptioning =
    bulkCaptionProgress !== null && bulkCaptionProgress !== undefined;
  const upscaleProgressPercent = isUpscaling
    ? (bulkUpscaleProgress.current / bulkUpscaleProgress.total) * 100
    : 0;
  const captionProgressPercent = isCaptioning
    ? (bulkCaptionProgress.current / bulkCaptionProgress.total) * 100
    : 0;
  const popoverRef = useRef<HTMLDivElement>(null);

  // Import state from Jotai
  const importState = useAtomValue(importStateAtom);
  const importProgress = useAtomValue(importProgressAtom);
  const importStats = useAtomValue(importStatsAtom);

  // Generation state from Jotai
  const generateState = useAtomValue(generateStateAtom);
  const generateProgress = useAtomValue(generateProgressAtom);
  const isGenerating = generateState === "generating";
  const generateDone = generateState === "done";
  const generateProgressPercent =
    generateProgress && generateProgress.total > 0
      ? (generateProgress.current / generateProgress.total) * 100
      : 0;

  // Track "done" state visibility for animation (10 seconds)
  const [showDone, setShowDone] = useState(false);
  // Track popover visibility
  const [showPopover, setShowPopover] = useState(false);

  useEffect(() => {
    if (importState === "done") {
      setShowDone(true);
      setShowPopover(true);
      const timer = setTimeout(() => {
        setShowDone(false);
        setShowPopover(false);
      }, 10000); // 10 seconds
      return () => clearTimeout(timer);
    }
  }, [importState]);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setShowPopover(false);
      }
    };

    if (showPopover) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showPopover]);

  const handleImportClick = () => {
    // Always open modal, regardless of state
    onOpenImportModal();
  };

  const isImporting = importState === "importing";

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="">
          <Image className="w-7 h-7 text-primary" />
        </div>
        <div className="flex items-center gap-4">
          {/* Generation progress badge */}
          {(isGenerating || generateDone) && (
            <button
              type="button"
              onClick={onOpenGenerate}
              className={clsx(
                "flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full transition-all duration-300 cursor-pointer",
                generateDone
                  ? "text-green-600 bg-green-50"
                  : "text-primary bg-primary/10",
              )}
            >
              {generateDone ? (
                <>
                  <Check className="w-3 h-3" />
                  Done
                </>
              ) : (
                <>
                  <Wand2 className="w-3 h-3" />
                  <span className="tabular-nums">
                    {generateProgress
                      ? `${generateProgress.current}/${generateProgress.total}`
                      : "0/0"}
                  </span>
                </>
              )}
            </button>
          )}

          {saveStatus && (
            <span
              className={clsx(
                "flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full transition-all duration-300",
                saveStatus === "saving"
                  ? "text-amber-600 bg-amber-50"
                  : "text-green-600 bg-green-50",
              )}
            >
              {saveStatus === "saving" ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-3 h-3" />
                  Saved
                </>
              )}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Menu as="div" className="relative">
            {({ open }) => (
              <Fragment>
                <MenuButton
                  disabled={!hasImages}
                  className={clsx(
                    "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer disabled:text-gray-500",
                    isCaptioning && "bg-primary/10 text-primary",
                  )}
                >
                  {isCaptioning ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="tabular-nums">
                        {bulkCaptionProgress.current}/
                        {bulkCaptionProgress.total}
                      </span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Bulk
                    </>
                  )}
                  <ChevronDown
                    className={clsx(
                      "w-4 h-4 transition-transform",
                      open && "rotate-180",
                    )}
                  />
                </MenuButton>

                <MenuItems
                  transition
                  anchor="bottom end"
                  className="absolute right-0 top-full mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden z-50 focus:outline-none origin-top-right transition duration-100 ease-out data-[closed]:scale-95 data-[closed]:opacity-0"
                >
                  <MenuItem>
                    {({ focus }) => (
                      <button
                        type="button"
                        onMouseDownCapture={() => onBulkCaption()}
                        className={clsx(
                          "w-full px-4 py-2.5 text-left text-sm text-gray-700 flex items-center gap-2 transition-colors cursor-pointer",
                          focus && "bg-gray-50",
                        )}
                      >
                        <span className="font-medium">Bulk Captions</span>
                      </button>
                    )}
                  </MenuItem>
                  <MenuItem>
                    {({ focus }) => (
                      <button
                        type="button"
                        onMouseDownCapture={() => onBulkUpscale()}
                        className={clsx(
                          "w-full px-4 py-2.5 text-left text-sm text-gray-700 flex items-center gap-2 border-t border-gray-100 transition-colors cursor-pointer",
                          focus && "bg-gray-50",
                        )}
                      >
                        <span className="font-medium">Bulk Upscale</span>
                      </button>
                    )}
                  </MenuItem>
                  <MenuItem>
                    {({ focus }) => (
                      <button
                        type="button"
                        onMouseDownCapture={() => onBulkEdit()}
                        className={clsx(
                          "w-full px-4 py-2.5 text-left text-sm text-gray-700 flex items-center gap-2 border-t border-gray-100 transition-colors cursor-pointer",
                          focus && "bg-gray-50",
                        )}
                      >
                        <span className="font-medium">Bulk Edit</span>
                      </button>
                    )}
                  </MenuItem>
                  <MenuItem>
                    {({ focus }) => (
                      <button
                        type="button"
                        onMouseDownCapture={() => onBulkTags()}
                        className={clsx(
                          "w-full px-4 py-2.5 text-left text-sm text-gray-700 flex items-center gap-2 border-t border-gray-100 transition-colors cursor-pointer",
                          focus && "bg-gray-50",
                        )}
                      >
                        <span className="font-medium">Bulk Tags</span>
                      </button>
                    )}
                  </MenuItem>
                </MenuItems>
              </Fragment>
            )}
          </Menu>

          {/* Import button with popover */}
          <div className="relative" ref={popoverRef}>
            <button
              type="button"
              onMouseDownCapture={handleImportClick}
              className={clsx(
                "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 cursor-pointer overflow-hidden",
                showDone
                  ? "bg-green-100 text-green-700"
                  : isImporting
                    ? "bg-primary/10 text-primary"
                    : "text-gray-700 hover:bg-gray-100",
              )}
            >
              <span
                className={clsx(
                  "flex items-center gap-2 transition-all duration-300",
                  showDone && "animate-[scaleIn_0.3s_ease-out]",
                )}
              >
                {showDone ? (
                  <>
                    <Check className="w-4 h-4 animate-[scaleIn_0.3s_ease-out]" />
                    <span>Done</span>
                  </>
                ) : isImporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="tabular-nums">
                      {importProgress
                        ? `${importProgress.current}/${importProgress.total}`
                        : "0/0"}
                    </span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Import CSV</span>
                  </>
                )}
              </span>
            </button>

            {/* Done state popover */}
            {showPopover && importStats && (
              <div className="absolute top-full right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-50 animate-[fadeIn_0.2s_ease-out]">
                <div className="flex items-center gap-2 text-green-600 mb-2">
                  <Check className="w-4 h-4" />
                  <span className="font-medium text-sm">Import complete</span>
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>
                    <span className="font-medium text-green-600">
                      {importStats.created}
                    </span>{" "}
                    new rows
                  </p>
                  <p>
                    <span className="font-medium text-blue-600">
                      {importStats.updated}
                    </span>{" "}
                    existing rows
                  </p>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Click button for details
                </p>
              </div>
            )}
          </div>

          <Menu as="div" className="relative">
            {({ open }) => (
              <Fragment>
                <MenuButton
                  disabled={!hasImages}
                  className={clsx(
                    "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer cursor-pointer",
                    hasImages
                      ? "bg-primary text-white hover:bg-primary-hover"
                      : "bg-gray-200 text-gray-400 cursor-not-allowed",
                  )}
                >
                  <Download className="w-4 h-4" />
                  Export
                  <ChevronDown
                    className={clsx(
                      "w-4 h-4 transition-transform",
                      open && "rotate-180",
                    )}
                  />
                </MenuButton>

                <MenuItems
                  transition
                  anchor="bottom end"
                  className="absolute right-0 top-full mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden z-50 focus:outline-none origin-top-right transition duration-100 ease-out data-[closed]:scale-95 data-[closed]:opacity-0"
                >
                  <MenuItem>
                    {({ focus }) => (
                      <button
                        type="button"
                        onMouseDownCapture={() => onExport("json")}
                        className={clsx(
                          "w-full px-4 py-2.5 text-left text-sm text-gray-700 flex items-center gap-2 transition-colors cursor-pointer",
                          focus && "bg-gray-50",
                        )}
                      >
                        <span className="font-medium">JSON</span>
                        <span className="text-gray-400 text-xs">.json</span>
                      </button>
                    )}
                  </MenuItem>
                  <MenuItem>
                    {({ focus }) => (
                      <button
                        type="button"
                        onMouseDownCapture={() => onExport("jsonl")}
                        className={clsx(
                          "w-full px-4 py-2.5 text-left text-sm text-gray-700 flex items-center gap-2 border-t border-gray-100 transition-colors cursor-pointer",
                          focus && "bg-gray-50",
                        )}
                      >
                        <span className="font-medium">JSON Lines</span>
                        <span className="text-gray-400 text-xs">.jsonl</span>
                      </button>
                    )}
                  </MenuItem>
                </MenuItems>
              </Fragment>
            )}
          </Menu>
          <button
            onMouseDownCapture={onShowSettings}
            className="pl-2 text-gray-600 cursor-pointer"
            title="Settings"
            type="button"
          >
            <Settings className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Bulk upscale progress bar */}
      {isUpscaling && (
        <div className="px-6 pb-3">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300 ease-out"
                style={{ width: `${upscaleProgressPercent}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 tabular-nums whitespace-nowrap">
              {bulkUpscaleProgress.current}/{bulkUpscaleProgress.total} upscaled
            </span>
          </div>
        </div>
      )}

      {/* Bulk caption progress bar */}
      {isCaptioning && (
        <div className="px-6 pb-3">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300 ease-out"
                style={{ width: `${captionProgressPercent}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 tabular-nums whitespace-nowrap">
              {bulkCaptionProgress.current}/{bulkCaptionProgress.total}{" "}
              captioned
            </span>
          </div>
        </div>
      )}

      {/* Generation progress bar */}
      {isGenerating && generateProgress && (
        <div className="px-6 pb-3">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300 ease-out"
                style={{ width: `${generateProgressPercent}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 tabular-nums whitespace-nowrap">
              {generateProgress.current}/{generateProgress.total} generated
            </span>
          </div>
        </div>
      )}
    </header>
  );
}
