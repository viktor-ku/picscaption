import { Fragment } from "react";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import {
  FolderOpen,
  Download,
  Image,
  CircleHelp,
  Check,
  Loader2,
  PenLine,
  ChevronDown,
  Settings,
  MoreVertical,
  Trash2,
  Sparkles,
} from "lucide-react";
import clsx from "clsx";

type SaveStatus = "saving" | "saved" | null;
type ExportFormat = "json" | "jsonl";

interface BulkUpscaleProgress {
  current: number;
  total: number;
}

interface HeaderProps {
  imageCount: number;
  captionedCount: number;
  saveStatus: SaveStatus;
  onSelectFolder: () => void;
  onExport: (format: ExportFormat) => void;
  onShowHelp: () => void;
  onShowSettings: () => void;
  onBulkEdit: () => void;
  onBulkUpscale: () => void;
  onDeleteAllData: () => void;
  bulkUpscaleProgress?: BulkUpscaleProgress | null;
}

export function Header({
  imageCount,
  captionedCount,
  saveStatus,
  onSelectFolder,
  onExport,
  onShowHelp,
  onShowSettings,
  onBulkEdit,
  onBulkUpscale,
  onDeleteAllData,
  bulkUpscaleProgress,
}: HeaderProps) {
  const hasImages = imageCount > 0;
  const isUpscaling =
    bulkUpscaleProgress !== null && bulkUpscaleProgress !== undefined;
  const progressPercent = isUpscaling
    ? (bulkUpscaleProgress.current / bulkUpscaleProgress.total) * 100
    : 0;

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Image className="w-7 h-7 text-primary" />
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">
              PicsCaption
            </h1>
          </div>
          <button
            onClick={onShowSettings}
            className="p-1 text-gray-700 hover:text-gray-900 rounded-lg transition-colors cursor-pointer"
            title="Settings"
            type="button"
          >
            <Settings className="w-6 h-6" />
          </button>
          {hasImages && (
            <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
              {captionedCount}/{imageCount} done
            </span>
          )}
          {/* Save status indicator */}
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
          <button
            type="button"
            onClick={onBulkEdit}
            disabled={!hasImages}
            className={clsx(
              "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer",
              hasImages
                ? "text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
                : "bg-gray-200 text-gray-400 cursor-not-allowed border border-gray-200",
            )}
          >
            <PenLine className="w-4 h-4" />
            Bulk Edit
          </button>
          <button
            type="button"
            onClick={onBulkUpscale}
            disabled={!hasImages || isUpscaling}
            className={clsx(
              "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer",
              hasImages && !isUpscaling
                ? "text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
                : "bg-gray-200 text-gray-400 cursor-not-allowed border border-gray-200",
            )}
          >
            <Sparkles className="w-4 h-4" />
            Bulk Upscale
          </button>
          <button
            type="button"
            onClick={onSelectFolder}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
          >
            <FolderOpen className="w-4 h-4" />
            Select Folder
          </button>
          {/* Export dropdown */}
          <Menu as="div" className="relative">
            {({ open }) => (
              <Fragment>
                <MenuButton
                  disabled={!hasImages}
                  className={clsx(
                    "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer",
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
                        onClick={() => onExport("json")}
                        className={clsx(
                          "w-full px-4 py-2.5 text-left text-sm text-gray-700 flex items-center gap-2 transition-colors",
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
                        onClick={() => onExport("jsonl")}
                        className={clsx(
                          "w-full px-4 py-2.5 text-left text-sm text-gray-700 flex items-center gap-2 border-t border-gray-100 transition-colors",
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
          {/* More options dropdown */}
          <Menu as="div" className="relative">
            {() => (
              <Fragment>
                <MenuButton
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                  title="More options"
                >
                  <MoreVertical className="w-5 h-5" />
                </MenuButton>

                <MenuItems
                  transition
                  anchor="bottom end"
                  className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden z-50 focus:outline-none origin-top-right transition duration-100 ease-out data-[closed]:scale-95 data-[closed]:opacity-0"
                >
                  <MenuItem>
                    {({ focus }) => (
                      <button
                        type="button"
                        onClick={onDeleteAllData}
                        className={clsx(
                          "w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 transition-colors",
                          focus ? "bg-red-50" : "",
                          "text-red-600",
                        )}
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="font-medium">Delete All Data</span>
                      </button>
                    )}
                  </MenuItem>
                </MenuItems>
              </Fragment>
            )}
          </Menu>
          <button
            onClick={onShowHelp}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
            title="Keyboard shortcuts"
            type="button"
          >
            <CircleHelp className="w-5 h-5" />
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
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 tabular-nums whitespace-nowrap">
              {bulkUpscaleProgress.current}/{bulkUpscaleProgress.total} upscaled
            </span>
          </div>
        </div>
      )}
    </header>
  );
}
