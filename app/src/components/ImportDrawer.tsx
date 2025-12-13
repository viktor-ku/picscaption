import { useRef, useEffect, useState } from "react";
import { useAtomValue } from "jotai";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import {
  X,
  Upload,
  Check,
  Settings,
  FileSpreadsheet,
  ArrowRight,
  Coffee,
  Ban,
} from "lucide-react";
import clsx from "clsx";
import {
  importStateAtom,
  importProgressAtom,
  importStatsAtom,
  type ImportState,
  type ImportProgress,
  type ImportStats,
} from "../lib/store";
import type { MetaObject } from "../lib/settings";

interface ImportDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onImportCsv: (files: File[]) => void;
  onCancelImport: () => void;
  onResetImport: () => void;
  onOpenMetaSettings: () => void;
  activeMetaObjects: MetaObject[];
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}s`;
}

function IdleView({
  onImportCsv,
  onOpenMetaSettings,
  activeMetaObjects,
  fileInputRef,
}: {
  onImportCsv: (files: File[]) => void;
  onOpenMetaSettings: () => void;
  activeMetaObjects: MetaObject[];
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onImportCsv(Array.from(files));
      e.target.value = "";
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto flex-1">
      {/* Hidden file input - supports multiple files */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Main import button */}
      <div className="flex flex-col items-center py-8">
        <button
          type="button"
          onMouseDownCapture={handleImportClick}
          className="flex items-center gap-3 px-8 py-4 text-lg font-medium text-white bg-primary rounded-xl hover:bg-primary-hover transition-all duration-200 shadow-lg hover:shadow-xl cursor-pointer"
        >
          <Upload className="w-6 h-6" />
          Select CSV Files
        </button>
        <p className="mt-4 text-sm text-gray-500">
          Import metadata from one or more CSV files
        </p>
      </div>

      {/* Expected format info */}
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex items-start gap-3">
          <FileSpreadsheet className="w-5 h-5 text-gray-400 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-gray-700">Expected CSV format</p>
            <p className="mt-1 text-gray-500">
              CSV must have a{" "}
              <code className="px-1.5 py-0.5 bg-gray-200 rounded text-xs">
                filename
              </code>
              ,{" "}
              <code className="px-1.5 py-0.5 bg-gray-200 rounded text-xs">
                file_name
              </code>
              ,{" "}
              <code className="px-1.5 py-0.5 bg-gray-200 rounded text-xs">
                file
              </code>
              , or{" "}
              <code className="px-1.5 py-0.5 bg-gray-200 rounded text-xs">
                image
              </code>{" "}
              column to match rows to images.
            </p>
          </div>
        </div>
      </div>

      {/* Active meta fields */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-700">
            Active meta fields to import
          </h4>
          <button
            type="button"
            onMouseDownCapture={onOpenMetaSettings}
            className="flex items-center gap-1.5 text-xs text-primary hover:text-primary-hover transition-colors cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5" />
            Configure
          </button>
        </div>

        {activeMetaObjects.length === 0 ? (
          <div className="p-4 text-center text-sm text-gray-500 bg-amber-50 border border-amber-200 rounded-lg">
            <p>No active meta fields configured.</p>
            <button
              type="button"
              onMouseDownCapture={onOpenMetaSettings}
              className="mt-2 inline-flex items-center gap-1 text-amber-700 hover:text-amber-800 font-medium cursor-pointer"
            >
              Add meta fields
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {activeMetaObjects.map((mo) => (
              <span
                key={mo._id}
                className={clsx(
                  "px-2.5 py-1 text-xs font-medium rounded-full",
                  mo.required
                    ? "bg-red-100 text-red-700"
                    : "bg-gray-100 text-gray-700",
                )}
              >
                {mo.name}
                {mo.required && <span className="ml-1">*</span>}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ImportingView({
  progress,
  stats,
  onCancel,
}: {
  progress: ImportProgress | null;
  stats: ImportStats | null;
  onCancel: () => void;
}) {
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    if (!stats?.startTime) return;

    const interval = setInterval(() => {
      setElapsedTime(Date.now() - stats.startTime);
    }, 100);

    return () => clearInterval(interval);
  }, [stats?.startTime]);

  const progressPercent = progress
    ? (progress.current / progress.total) * 100
    : 0;

  return (
    <div className="p-6 space-y-6 overflow-y-auto flex-1">
      {/* Coffee icon and message */}
      <div className="flex flex-col items-center py-4">
        <Coffee className="w-12 h-12 text-amber-500" />
        <p className="mt-3 text-sm text-gray-500 text-center">
          Kick back, relax, and grab a coffee while we get your data ready.
        </p>
      </div>

      {/* File progress indicator for multi-file imports */}
      {progress?.totalFiles && progress.totalFiles > 1 && (
        <div className="text-center text-sm text-gray-600">
          <span className="font-medium">
            File {progress.currentFile} of {progress.totalFiles}
          </span>
          {progress.currentFileName && (
            <span className="text-gray-400 ml-2 truncate max-w-[200px] inline-block align-bottom">
              ({progress.currentFileName})
            </span>
          )}
        </div>
      )}

      {/* Progress bar */}
      <div className="space-y-3">
        <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 tabular-nums">
            {progress
              ? `${progress.current} / ${progress.total} rows`
              : "Preparing..."}
          </span>
          <span className="text-gray-500 tabular-nums">
            {formatDuration(elapsedTime)}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center justify-center py-4">
        <div className="text-center w-24">
          <div className="text-3xl font-bold text-green-600 tabular-nums">
            {stats?.created ?? 0}
          </div>
          <div className="text-sm text-gray-500 mt-1">New rows</div>
        </div>
        <div className="w-px h-12 bg-gray-200" />
        <div className="text-center w-24">
          <div className="text-3xl font-bold text-blue-600 tabular-nums">
            {stats?.updated ?? 0}
          </div>
          <div className="text-sm text-gray-500 mt-1">Updated</div>
        </div>
        <div className="w-px h-12 bg-gray-200" />
        <div className="text-center w-24">
          <div className="text-3xl font-bold text-gray-400 tabular-nums">
            {stats?.errors?.length ?? 0}
          </div>
          <div className="text-sm text-gray-400 mt-1">Failed</div>
        </div>
      </div>

      {/* Cancel button */}
      <div className="flex justify-center pt-2">
        <button
          type="button"
          onMouseDownCapture={onCancel}
          className="px-6 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function CancelledView({
  progress,
  stats,
  onClose,
}: {
  progress: ImportProgress | null;
  stats: ImportStats | null;
  onClose: () => void;
}) {
  const duration =
    stats?.endTime && stats?.startTime ? stats.endTime - stats.startTime : 0;

  return (
    <div className="p-6 space-y-6 overflow-y-auto flex-1">
      {/* Cancelled icon */}
      <div className="flex justify-center py-4">
        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center">
          <Ban className="w-10 h-10 text-gray-500" />
        </div>
      </div>

      {/* Heading */}
      <div className="text-center">
        <h3 className="text-xl font-semibold text-gray-900">
          Import Cancelled
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          Stopped after {formatDuration(duration)}
        </p>
      </div>

      {/* Progress info */}
      <div className="py-6 text-center">
        <div className="text-4xl font-bold text-gray-900 tabular-nums">
          {progress?.current ?? 0}{" "}
          <span className="text-2xl font-normal text-gray-400">
            / {progress?.total ?? 0}
          </span>
        </div>
        <div className="text-sm text-gray-500 mt-2">rows processed</div>
        {stats?.totalFiles && stats.totalFiles > 1 && (
          <div className="text-sm text-gray-400 mt-1">
            ({stats.filesProcessed ?? 0} of {stats.totalFiles} files completed)
          </div>
        )}
      </div>

      {/* Close button */}
      <div className="flex justify-center pt-2">
        <button
          type="button"
          onMouseDownCapture={onClose}
          className="px-6 py-2.5 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-hover transition-colors cursor-pointer"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function DoneView({
  stats,
  onClose,
}: {
  stats: ImportStats | null;
  onClose: () => void;
}) {
  const duration =
    stats?.endTime && stats?.startTime ? stats.endTime - stats.startTime : 0;

  return (
    <div className="p-6 space-y-6 overflow-y-auto flex-1">
      {/* Success icon */}
      <div className="flex justify-center py-4">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center animate-[scaleIn_0.3s_ease-out]">
          <Check className="w-10 h-10 text-green-600" />
        </div>
      </div>

      {/* Heading */}
      <div className="text-center">
        <h3 className="text-xl font-semibold text-gray-900">Import Complete</h3>
        <p className="mt-1 text-sm text-gray-500">
          {stats?.totalFiles && stats.totalFiles > 1 && (
            <span>{stats.totalFiles} files processed in </span>
          )}
          {stats?.totalFiles && stats.totalFiles > 1
            ? formatDuration(duration)
            : `Completed in ${formatDuration(duration)}`}
        </p>
      </div>

      {/* Stats */}
      <div className="flex items-center justify-center py-4">
        <div className="text-center w-24">
          <div className="text-3xl font-bold text-green-600 tabular-nums">
            {stats?.created ?? 0}
          </div>
          <div className="text-sm text-gray-500 mt-1">New rows</div>
        </div>
        <div className="w-px h-12 bg-gray-200" />
        <div className="text-center w-24">
          <div className="text-3xl font-bold text-blue-600 tabular-nums">
            {stats?.updated ?? 0}
          </div>
          <div className="text-sm text-gray-500 mt-1">Updated</div>
        </div>
        <div className="w-px h-12 bg-gray-200" />
        <div className="text-center w-24">
          <div className="text-3xl font-bold text-gray-400 tabular-nums">
            {stats?.errors?.length ?? 0}
          </div>
          <div className="text-sm text-gray-400 mt-1">Failed</div>
        </div>
      </div>

      {/* Errors if any */}
      {stats?.errors && stats.errors.length > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm font-medium text-amber-800">
            {stats.errors.length} row{stats.errors.length !== 1 ? "s" : ""}{" "}
            failed
          </p>
          <p className="text-xs text-amber-700 mt-1">
            Check console for details
          </p>
        </div>
      )}

      {/* Close button */}
      <div className="flex justify-center pt-2">
        <button
          type="button"
          onMouseDownCapture={onClose}
          className="px-6 py-2.5 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-hover transition-colors cursor-pointer"
        >
          Close
        </button>
      </div>
    </div>
  );
}

export function ImportDrawer({
  isOpen,
  onClose,
  onImportCsv,
  onCancelImport,
  onResetImport,
  onOpenMetaSettings,
  activeMetaObjects,
}: ImportDrawerProps) {
  const importState = useAtomValue(importStateAtom);
  const importProgress = useAtomValue(importProgressAtom);
  const importStats = useAtomValue(importStatsAtom);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Determine title based on state
  const getTitle = (state: ImportState) => {
    switch (state) {
      case "importing":
        return "Importing...";
      case "done":
        return "Import Complete";
      case "cancelled":
        return "Import Cancelled";
      default:
        return "Import CSV";
    }
  };

  // Allow closing drawer anytime - import continues in background
  const handleClose = () => {
    onClose();
  };

  // Close and reset state when dismissing from cancelled state
  const handleDismissCancelled = () => {
    onResetImport();
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
              <Upload className="w-5 h-5 text-primary" />
              {getTitle(importState)}
            </DialogTitle>
            <button
              type="button"
              onMouseDownCapture={handleClose}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {importState === "idle" && (
            <IdleView
              onImportCsv={onImportCsv}
              onOpenMetaSettings={onOpenMetaSettings}
              activeMetaObjects={activeMetaObjects}
              fileInputRef={fileInputRef}
            />
          )}

          {importState === "importing" && (
            <ImportingView
              progress={importProgress}
              stats={importStats}
              onCancel={onCancelImport}
            />
          )}

          {importState === "done" && (
            <DoneView stats={importStats} onClose={handleClose} />
          )}

          {importState === "cancelled" && (
            <CancelledView
              progress={importProgress}
              stats={importStats}
              onClose={handleDismissCancelled}
            />
          )}
        </DialogPanel>
      </div>
    </Dialog>
  );
}
