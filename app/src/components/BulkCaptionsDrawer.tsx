import { useState, useEffect, useRef, useCallback } from "react";
import { useAtomValue } from "jotai";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import {
  X,
  Wand2,
  Loader2,
  Check,
  XCircle,
  AlertCircle,
  Save,
} from "lucide-react";
import {
  bulkCaptionStateAtom,
  bulkCaptionProgressAtom,
  bulkCaptionStatsAtom,
} from "../lib/store";
import { useConvexAvailable } from "./ConvexClientProvider";

interface BulkCaptionsDrawerProps {
  isOpen: boolean;
  imageCount: number;
  onClose: () => void;
  onStart: (modelId: string, systemPrompt: string) => void;
  onCancel: () => void;
  onReset: () => void;
  availableModels: Array<{ id: string; name: string; description: string }>;
  isAvailable: boolean;
  userId: Id<"users"> | null;
}

const DEFAULT_SYSTEM_PROMPT = `Describe this image concisely but thoroughly. Focus on the main subjects, their actions, setting, colors, and mood. Write a single paragraph caption suitable for image training datasets.`;

export function BulkCaptionsDrawer({
  isOpen,
  imageCount,
  onClose,
  onStart,
  onCancel,
  onReset,
  availableModels,
  isAvailable,
  userId,
}: BulkCaptionsDrawerProps) {
  const isConvexAvailable = useConvexAvailable();

  // Local form state
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [isSaving, setIsSaving] = useState(false);
  const promptModified = useRef(false);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  // Convex queries and mutations for system prompt
  const userSettings = useQuery(
    api.userSettings.get,
    isConvexAvailable && userId ? { userId } : "skip",
  );
  const upsertSystemPrompt = useMutation(api.userSettings.upsertSystemPrompt);

  // Sync local state with Convex data when it loads
  useEffect(() => {
    if (userSettings?.captionSystemPrompt) {
      setSystemPrompt(userSettings.captionSystemPrompt);
    }
  }, [userSettings?.captionSystemPrompt]);

  // Save system prompt to Convex
  const saveSystemPrompt = useCallback(async () => {
    if (!isConvexAvailable || !userId || !promptModified.current) return;

    setIsSaving(true);
    try {
      await upsertSystemPrompt({
        userId,
        systemPrompt,
      });
      promptModified.current = false;
    } catch (error) {
      console.error("Failed to save system prompt:", error);
    } finally {
      setIsSaving(false);
    }
  }, [isConvexAvailable, userId, systemPrompt, upsertSystemPrompt]);

  // Handle prompt change
  const handlePromptChange = useCallback((value: string) => {
    setSystemPrompt(value);
    promptModified.current = true;
  }, []);

  // Save on blur
  const handlePromptBlur = useCallback(() => {
    saveSystemPrompt();
  }, [saveSystemPrompt]);

  // Global state from atoms
  const state = useAtomValue(bulkCaptionStateAtom);
  const progress = useAtomValue(bulkCaptionProgressAtom);
  const stats = useAtomValue(bulkCaptionStatsAtom);

  // Set default model when models become available
  useEffect(() => {
    if (availableModels.length > 0 && !selectedModel) {
      setSelectedModel(availableModels[0].id);
    }
  }, [availableModels, selectedModel]);

  // Focus prompt when drawer opens
  useEffect(() => {
    if (isOpen && state === "idle") {
      setTimeout(() => promptRef.current?.focus(), 100);
    }
  }, [isOpen, state]);

  const handleStart = useCallback(() => {
    if (!selectedModel || !systemPrompt.trim()) return;
    onStart(selectedModel, systemPrompt.trim());
  }, [selectedModel, systemPrompt, onStart]);

  const handleClose = useCallback(() => {
    // Allow closing while captioning (work continues in background)
    // Only reset state when done/cancelled
    if (state === "done" || state === "cancelled") {
      onReset();
    }
    onClose();
  }, [state, onClose, onReset]);

  const handleDone = useCallback(() => {
    onReset();
    onClose();
  }, [onReset, onClose]);

  const progressPercent =
    progress && progress.total > 0
      ? (progress.current / progress.total) * 100
      : 0;

  const elapsedTime = stats
    ? ((stats.endTime ?? Date.now()) - stats.startTime) / 1000
    : 0;

  const isValid = selectedModel && systemPrompt.trim().length > 0;

  return (
    <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-black/50 transition-opacity duration-300 ease-out data-[closed]:opacity-0"
      />

      {/* Drawer from left - full width on mobile, 50% on larger screens */}
      <div className="fixed inset-0">
        <DialogPanel
          transition
          className="fixed inset-y-0 left-0 w-full sm:w-1/2 lg:max-w-2xl bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-out data-[closed]:-translate-x-full"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-gray-900">
              <Wand2 className="w-5 h-5 text-primary" />
              Bulk Captions
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
          <div className="p-6 space-y-5 overflow-y-auto flex-1">
            {state === "idle" && (
              <>
                {/* Info */}
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    Generate AI captions for all{" "}
                    <span className="font-semibold">{imageCount}</span> image
                    {imageCount !== 1 ? "s" : ""} in your filmstrip.
                  </p>
                </div>

                {/* Model Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Model
                  </label>
                  {!isAvailable ? (
                    <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <p className="text-sm text-amber-800">
                        OpenRouter API key not configured. Add it in Settings →
                        Integrations.
                      </p>
                    </div>
                  ) : availableModels.length === 0 ? (
                    <p className="text-sm text-gray-500">
                      No caption models available.
                    </p>
                  ) : (
                    <select
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      {availableModels.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* System Prompt */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">
                      System Prompt
                    </label>
                    {userId && (
                      <button
                        type="button"
                        onClick={saveSystemPrompt}
                        disabled={isSaving}
                        className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
                      >
                        {isSaving ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Save className="w-3 h-3" />
                        )}
                        Save
                      </button>
                    )}
                  </div>
                  <textarea
                    ref={promptRef}
                    value={systemPrompt}
                    onChange={(e) => handlePromptChange(e.target.value)}
                    onBlur={handlePromptBlur}
                    placeholder="Enter instructions for how to caption images..."
                    rows={5}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                  />
                </div>
              </>
            )}

            {state === "captioning" && progress && (
              <>
                {/* Progress */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Progress</span>
                    <span className="font-medium text-gray-900 tabular-nums">
                      {progress.current} / {progress.total}
                    </span>
                  </div>

                  <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300 ease-out"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>

                  {stats && (
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <span>
                        <span className="text-green-600 font-medium">
                          {stats.success}
                        </span>{" "}
                        success
                        {stats.errors > 0 && (
                          <>
                            ,{" "}
                            <span className="text-red-600 font-medium">
                              {stats.errors}
                            </span>{" "}
                            errors
                          </>
                        )}
                      </span>
                      <span className="tabular-nums">
                        {elapsedTime.toFixed(1)}s
                      </span>
                    </div>
                  )}
                </div>

                {/* Currently processing indicator */}
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                  <Loader2 className="w-5 h-5 text-primary animate-spin shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Generating captions...
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {progress.total - progress.current} remaining (3
                      concurrent)
                    </p>
                  </div>
                </div>
              </>
            )}

            {state === "done" && stats && (
              <>
                {/* Success state */}
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                    <Check className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Captions Generated
                  </h3>
                  <p className="text-sm text-gray-600 text-center">
                    Successfully captioned{" "}
                    <span className="font-medium text-green-600">
                      {stats.success}
                    </span>{" "}
                    image{stats.success !== 1 ? "s" : ""}
                    {stats.errors > 0 && (
                      <>
                        {" "}
                        with{" "}
                        <span className="font-medium text-red-600">
                          {stats.errors}
                        </span>{" "}
                        error{stats.errors !== 1 ? "s" : ""}
                      </>
                    )}
                  </p>
                  <p className="text-xs text-gray-400 mt-2 tabular-nums">
                    Completed in {elapsedTime.toFixed(1)}s
                  </p>
                </div>
              </>
            )}

            {state === "cancelled" && stats && (
              <>
                {/* Cancelled state */}
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
                    <XCircle className="w-8 h-8 text-amber-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Cancelled
                  </h3>
                  <p className="text-sm text-gray-600 text-center">
                    Captioned{" "}
                    <span className="font-medium">{stats.success}</span> of{" "}
                    {progress?.total ?? 0} images before cancellation
                    {stats.errors > 0 && (
                      <>
                        {" "}
                        with{" "}
                        <span className="font-medium text-red-600">
                          {stats.errors}
                        </span>{" "}
                        error{stats.errors !== 1 ? "s" : ""}
                      </>
                    )}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 shrink-0">
            <div className="flex items-center justify-end gap-3">
              {state === "idle" && (
                <>
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
                    disabled={!isValid || !isAvailable || imageCount === 0}
                    className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-hover transition-colors cursor-pointer disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <Wand2 className="w-4 h-4" />
                    Generate {imageCount} Caption{imageCount !== 1 ? "s" : ""}
                  </button>
                </>
              )}

              {state === "captioning" && (
                <>
                  <button
                    type="button"
                    onMouseDownCapture={onCancel}
                    className="px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-300 rounded-lg hover:bg-red-50 transition-colors cursor-pointer flex items-center gap-2"
                  >
                    <XCircle className="w-4 h-4" />
                    Stop
                  </button>
                  <button
                    type="button"
                    onMouseDownCapture={handleClose}
                    className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-hover transition-colors cursor-pointer"
                  >
                    Minimize
                  </button>
                </>
              )}

              {(state === "done" || state === "cancelled") && (
                <button
                  type="button"
                  onMouseDownCapture={handleDone}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-hover transition-colors cursor-pointer"
                >
                  Done
                </button>
              )}
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
