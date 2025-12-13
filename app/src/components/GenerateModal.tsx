import { useState, useRef, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import {
  X,
  Sparkles,
  Loader2,
  FolderOpen,
  HelpCircle,
  Check,
  Cloud,
  Server,
} from "lucide-react";
import { useAtom, useAtomValue } from "jotai";
import clsx from "clsx";
import {
  generateSelectedModelsAtom,
  generateStateAtom,
  generateProgressAtom,
} from "../lib/store";
import {
  GENERATE_MODELS,
  getStabilityModels,
  getLocalModels,
  type GenerateModelId,
  type MultiGenerateOptions,
} from "../lib/generate-models";
import type { LocalGenerateModel } from "../lib/ai3-upscale-client";

const ASPECT_RATIOS = [
  { value: "1:1", label: "1:1 (Square)" },
  { value: "16:9", label: "16:9 (Landscape)" },
  { value: "9:16", label: "9:16 (Portrait)" },
  { value: "4:3", label: "4:3" },
  { value: "3:4", label: "3:4" },
  { value: "21:9", label: "21:9 (Ultra-wide)" },
];

interface GenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (options: MultiGenerateOptions) => Promise<void>;
  availableLocalModels?: LocalGenerateModel[];
  saveDirName?: string | null;
  onSelectFolder?: () => Promise<boolean> | void;
}

// Re-export for backwards compatibility
export type { MultiGenerateOptions as GenerateOptions };

export function GenerateModal({
  isOpen,
  onClose,
  onGenerate,
  availableLocalModels = [],
  saveDirName,
  onSelectFolder,
}: GenerateModalProps) {
  // Jotai atoms for selected models (persisted) and generation state
  const [selectedModels, setSelectedModels] = useAtom(
    generateSelectedModelsAtom,
  );
  const generateState = useAtomValue(generateStateAtom);
  const generateProgress = useAtomValue(generateProgressAtom);

  const isGenerating = generateState === "generating";

  // Generation parameters
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [width, setWidth] = useState("1024");
  const [height, setHeight] = useState("1024");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [seed, setSeed] = useState("0");
  const [repeat, setRepeat] = useState("1");
  const [steps, setSteps] = useState("30");
  const [cfgScale, setCfgScale] = useState("7");

  // UI state
  const promptRef = useRef<HTMLTextAreaElement>(null);

  // Get models grouped by provider
  const stabilityModels = getStabilityModels();
  const localModels = getLocalModels();

  // Check if a local model is available
  const isLocalModelAvailable = useCallback(
    (modelId: GenerateModelId) => {
      const apiModelId = modelId.split(":")[1];
      return availableLocalModels.includes(apiModelId as LocalGenerateModel);
    },
    [availableLocalModels],
  );

  // Toggle model selection
  const toggleModel = useCallback(
    (modelId: GenerateModelId) => {
      setSelectedModels((prev) => {
        if (prev.includes(modelId)) {
          return prev.filter((id) => id !== modelId);
        }
        return [...prev, modelId];
      });
    },
    [setSelectedModels],
  );

  // Check if any selected model supports negative prompt
  const anySupportsNegativePrompt = selectedModels.some((id) => {
    const model = GENERATE_MODELS.find((m) => m.id === id);
    return model?.supportsNegativePrompt;
  });

  // Check if any selected model supports dimensions
  const anyModelSupportsDimensions = selectedModels.some((id) => {
    const model = GENERATE_MODELS.find((m) => m.id === id);
    return model?.supportsDimensions;
  });

  // Check if any selected model supports aspect ratio
  const anyModelSupportsAspectRatio = selectedModels.some((id) => {
    const model = GENERATE_MODELS.find((m) => m.id === id);
    return model?.supportsAspectRatio;
  });

  // Focus prompt input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => promptRef.current?.focus(), 0);
    }
  }, [isOpen]);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || selectedModels.length === 0) return;

    const options: MultiGenerateOptions = {
      models: selectedModels as GenerateModelId[],
      prompt: prompt.trim(),
    };

    if (anySupportsNegativePrompt && negativePrompt.trim()) {
      options.negativePrompt = negativePrompt.trim();
    }

    if (anyModelSupportsDimensions) {
      const w = Number.parseInt(width, 10);
      const h = Number.parseInt(height, 10);
      if (w > 0) options.width = w;
      if (h > 0) options.height = h;
    }

    if (anyModelSupportsAspectRatio) {
      options.aspectRatio = aspectRatio;
    }

    const s = Number.parseInt(seed, 10);
    if (s > 0) options.seed = s;

    const st = Number.parseInt(steps, 10);
    if (st > 0) options.steps = st;

    const cfg = Number.parseFloat(cfgScale);
    if (cfg > 0) options.cfgScale = cfg;

    const rep = Number.parseInt(repeat, 10);
    if (rep > 1) options.repeat = rep;

    await onGenerate(options);
  }, [
    selectedModels,
    prompt,
    negativePrompt,
    width,
    height,
    aspectRatio,
    seed,
    steps,
    cfgScale,
    repeat,
    anySupportsNegativePrompt,
    anyModelSupportsDimensions,
    anyModelSupportsAspectRatio,
    onGenerate,
  ]);

  // Allow closing even during generation (background generation continues)
  const handleClose = () => {
    onClose();
  };

  const isValid = prompt.trim().length > 0 && selectedModels.length > 0;
  const hasLocalModels = availableLocalModels.length > 0;

  // Calculate total jobs
  const repeatCount = Math.max(1, Number.parseInt(repeat, 10) || 1);
  const totalJobs = selectedModels.length * repeatCount;

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
              <Sparkles className="w-5 h-5 text-primary" />
              Generate Image
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
            {/* Model Selection with Checkboxes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Models{" "}
                <span className="text-gray-400 font-normal">
                  (select one or more)
                </span>
              </label>

              {/* Stability AI Models */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Cloud className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-medium text-gray-600">
                    Stability AI
                  </span>
                </div>
                <div className="space-y-1">
                  {stabilityModels.map((model) => (
                    <label
                      key={model.id}
                      className={clsx(
                        "flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors",
                        selectedModels.includes(model.id)
                          ? "bg-primary/10 border border-primary/30"
                          : "bg-gray-50 border border-transparent hover:bg-gray-100",
                      )}
                    >
                      <div
                        className={clsx(
                          "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                          selectedModels.includes(model.id)
                            ? "bg-primary border-primary"
                            : "border-gray-300",
                        )}
                      >
                        {selectedModels.includes(model.id) && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </div>
                      <input
                        type="checkbox"
                        checked={selectedModels.includes(model.id)}
                        onChange={() => toggleModel(model.id)}
                        className="sr-only"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900">
                          {model.name}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {model.description}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Local Models */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Server className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-medium text-gray-600">
                    Local (ai3)
                  </span>
                  {!hasLocalModels && (
                    <span className="text-xs text-amber-600">
                      (server unavailable)
                    </span>
                  )}
                </div>
                <div className="space-y-1">
                  {localModels.map((model) => {
                    const available = isLocalModelAvailable(model.id);
                    return (
                      <label
                        key={model.id}
                        className={clsx(
                          "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                          !available
                            ? "opacity-50 cursor-not-allowed"
                            : "cursor-pointer",
                          selectedModels.includes(model.id)
                            ? "bg-primary/10 border border-primary/30"
                            : available
                              ? "bg-gray-50 border border-transparent hover:bg-gray-100"
                              : "bg-gray-50 border border-transparent",
                        )}
                      >
                        <div
                          className={clsx(
                            "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                            selectedModels.includes(model.id)
                              ? "bg-primary border-primary"
                              : "border-gray-300",
                          )}
                        >
                          {selectedModels.includes(model.id) && (
                            <Check className="w-3 h-3 text-white" />
                          )}
                        </div>
                        <input
                          type="checkbox"
                          checked={selectedModels.includes(model.id)}
                          onChange={() => available && toggleModel(model.id)}
                          disabled={!available}
                          className="sr-only"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900">
                            {model.name}
                          </div>
                          <div className="text-xs text-gray-500 truncate">
                            {model.description}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Prompt */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Prompt
              </label>
              <textarea
                ref={promptRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the image you want to generate..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
              />
            </div>

            {/* Negative Prompt (conditional) */}
            {anySupportsNegativePrompt && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Negative Prompt{" "}
                  <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                  placeholder="Things to avoid in the image..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                />
              </div>
            )}

            {/* Dimensions (show if any model supports it) */}
            {anyModelSupportsDimensions && (
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Width
                  </label>
                  <input
                    type="number"
                    value={width}
                    onChange={(e) => setWidth(e.target.value)}
                    min={256}
                    max={2048}
                    step={64}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Height
                  </label>
                  <input
                    type="number"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    min={256}
                    max={2048}
                    step={64}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>
            )}

            {/* Aspect Ratio (show if any model supports it) */}
            {anyModelSupportsAspectRatio && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Aspect Ratio
                </label>
                <select
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  {ASPECT_RATIOS.map((ar) => (
                    <option key={ar.value} value={ar.value}>
                      {ar.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Repeat */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <label className="text-sm font-medium text-gray-700">
                  Repeat
                </label>
                <div className="relative group">
                  <HelpCircle className="w-4 h-4 text-gray-400 cursor-help" />
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-10">
                    Generate multiple images per model.
                    <br />
                    Each image will have a unique seed.
                    <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
                  </div>
                </div>
              </div>
              <input
                type="number"
                value={repeat}
                onChange={(e) => setRepeat(e.target.value)}
                min={1}
                max={10}
                className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            {/* Seed, Steps, CFG Scale */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Seed
                </label>
                <input
                  type="number"
                  value={seed}
                  onChange={(e) => setSeed(e.target.value)}
                  min={0}
                  placeholder="0 = random"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Steps
                </label>
                <input
                  type="number"
                  value={steps}
                  onChange={(e) => setSteps(e.target.value)}
                  min={1}
                  max={100}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  CFG Scale
                </label>
                <input
                  type="number"
                  value={cfgScale}
                  onChange={(e) => setCfgScale(e.target.value)}
                  min={0}
                  max={20}
                  step={0.5}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 shrink-0 space-y-3">
            {/* Progress indicator when generating */}
            {isGenerating && generateProgress && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Generating...</span>
                  <span className="text-gray-900 font-medium tabular-nums">
                    {generateProgress.current}/{generateProgress.total}
                  </span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300 ease-out"
                    style={{
                      width: `${(generateProgress.current / generateProgress.total) * 100}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-gray-500">
                  Current: {generateProgress.currentModel.split(":")[1]}
                </p>
              </div>
            )}

            {/* Save location */}
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-gray-600">
                <FolderOpen className="w-4 h-4" />
                {saveDirName ? (
                  <span>
                    Save to:{" "}
                    <span className="font-medium text-gray-900">
                      {saveDirName}
                    </span>
                  </span>
                ) : (
                  <span className="text-amber-600">
                    Select a folder to save generated images
                  </span>
                )}
              </div>
              {onSelectFolder && (
                <button
                  type="button"
                  onClick={onSelectFolder}
                  disabled={isGenerating}
                  className="text-primary hover:text-primary-hover font-medium disabled:opacity-50"
                >
                  {saveDirName ? "Change" : "Select Folder"}
                </button>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-500">
                {selectedModels.length > 0 && (
                  <span>
                    {selectedModels.length} model
                    {selectedModels.length !== 1 ? "s" : ""} × {repeatCount} ={" "}
                    <span className="font-medium text-gray-700">
                      {totalJobs} image{totalJobs !== 1 ? "s" : ""}
                    </span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onMouseDownCapture={handleClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  {isGenerating ? "Close" : "Cancel"}
                </button>
                <button
                  type="button"
                  onMouseDownCapture={handleGenerate}
                  disabled={!isValid || isGenerating || !saveDirName}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-hover transition-colors cursor-pointer disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
                  title={
                    !saveDirName
                      ? "Please select a folder first"
                      : selectedModels.length === 0
                        ? "Please select at least one model"
                        : undefined
                  }
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Generate
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
