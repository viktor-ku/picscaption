import { useEffect, useCallback, useRef } from "react";
import { Wand2, Loader2, Check, AlertCircle, Save } from "lucide-react";
import type { ImageData } from "../types";
import {
  useCaptionsWorkflow,
  type CaptionResult,
} from "../hooks/useCaptionsWorkflow";
import { useCaption } from "../hooks/useCaption";
import { useUser } from "../hooks/useUser";
import { CAPTION_MODEL_INFO, type CaptionModelId } from "../lib/settings";

interface CaptionsTabProps {
  selectedImage: ImageData | null;
  onCaptionChange: (caption: string) => void;
}

export function CaptionsTab({
  selectedImage,
  onCaptionChange,
}: CaptionsTabProps) {
  const { userId } = useUser();
  const { availableModels } = useCaption();
  const {
    systemPrompt,
    setSystemPrompt,
    saveSystemPrompt,
    isSavingPrompt,
    selectedModels,
    toggleModel,
    generateCaptions,
    isGenerating,
    results,
    clearResults,
    isLoading,
  } = useCaptionsWorkflow({ userId });

  // Track if prompt has been modified
  const promptModified = useRef(false);

  // Debounced save on blur
  const handlePromptBlur = useCallback(async () => {
    if (promptModified.current && userId) {
      await saveSystemPrompt();
      promptModified.current = false;
    }
  }, [saveSystemPrompt, userId]);

  // Handle prompt change
  const handlePromptChange = useCallback(
    (value: string) => {
      setSystemPrompt(value);
      promptModified.current = true;
    },
    [setSystemPrompt],
  );

  // Clear results when image changes
  useEffect(() => {
    clearResults();
  }, [selectedImage?.id, clearResults]);

  // Handle generate
  const handleGenerate = useCallback(async () => {
    if (!selectedImage?.file || selectedModels.length === 0) return;
    await generateCaptions(selectedImage.file);
  }, [selectedImage?.file, selectedModels.length, generateCaptions]);

  // Handle applying a caption
  const handleApplyCaption = useCallback(
    (result: CaptionResult) => {
      if (result.error) return;
      onCaptionChange(result.caption);
    },
    [onCaptionChange],
  );

  // Get available OpenRouter models only
  const openRouterModels = Array.from(availableModels).filter((modelId) => {
    const info = CAPTION_MODEL_INFO[modelId];
    return info?.provider === "openrouter";
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-6 gap-5">
      {/* System Prompt Section */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label
            htmlFor="system-prompt"
            className="text-sm font-medium text-gray-700"
          >
            System Prompt
          </label>
          {userId && (
            <button
              type="button"
              onClick={handlePromptBlur}
              disabled={isSavingPrompt}
              className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
            >
              {isSavingPrompt ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Save className="w-3 h-3" />
              )}
              Save
            </button>
          )}
        </div>
        <textarea
          id="system-prompt"
          value={systemPrompt}
          onChange={(e) => handlePromptChange(e.target.value)}
          onBlur={handlePromptBlur}
          placeholder="Enter a system prompt for caption generation..."
          className="min-h-24 px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        />
      </div>

      {/* Model Selection Section */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-gray-700">Models</span>
        {openRouterModels.length === 0 ? (
          <p className="text-sm text-gray-500">
            No caption models available. Configure OpenRouter API key in
            settings.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {openRouterModels.map((modelId) => {
              const info = CAPTION_MODEL_INFO[modelId];
              const isSelected = selectedModels.includes(modelId);
              return (
                <label
                  key={modelId}
                  className="flex items-center gap-3 px-3 py-2 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleModel(modelId)}
                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-800 block truncate">
                      {info.name}
                    </span>
                    {info.description && info.description !== "TODO" && (
                      <span className="text-xs text-gray-500 block truncate">
                        {info.description}
                      </span>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Generate Button */}
      <button
        type="button"
        onClick={handleGenerate}
        disabled={isGenerating || selectedModels.length === 0 || !selectedImage}
        className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Wand2 className="w-4 h-4" />
            Generate Captions
          </>
        )}
      </button>

      {/* Results Section */}
      {results.length > 0 && (
        <div className="flex flex-col gap-2 flex-1 overflow-auto">
          <span className="text-sm font-medium text-gray-700">Results</span>
          <div className="flex flex-col gap-2">
            {results.map((result) => {
              const info = CAPTION_MODEL_INFO[result.modelId as CaptionModelId];
              return (
                <button
                  type="button"
                  key={result.modelId}
                  onClick={() => handleApplyCaption(result)}
                  disabled={!!result.error}
                  className="text-left p-3 border border-gray-200 rounded-lg hover:border-primary hover:bg-primary/5 disabled:opacity-60 disabled:cursor-not-allowed transition-colors group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-800">
                      {info?.name || result.modelId}
                    </span>
                    {result.error ? (
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    ) : (
                      <Check className="w-4 h-4 text-gray-400 group-hover:text-primary" />
                    )}
                  </div>
                  {result.error ? (
                    <p className="text-xs text-red-500">{result.error}</p>
                  ) : (
                    <p className="text-sm text-gray-600 line-clamp-3">
                      {result.caption}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
