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
  ChevronDown,
  ChevronUp,
  Loader2,
  FolderOpen,
  HelpCircle,
} from "lucide-react";
import {
  LOCAL_MODELS,
  type LocalGenerateModel,
} from "../lib/ai3-upscale-client";
import {
  STABILITY_MODELS,
  type StabilityModel,
} from "../lib/stability-generate-client";

type Provider = "local" | "stability";

interface GenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (options: GenerateOptions) => Promise<void>;
  isGenerating: boolean;
  availableLocalModels?: LocalGenerateModel[];
  saveDirName?: string | null;
  onSelectFolder?: () => Promise<boolean> | void;
}

export interface GenerateOptions {
  provider: Provider;
  model: LocalGenerateModel | StabilityModel;
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  aspectRatio?: string;
  seed?: number;
  steps?: number;
  cfgScale?: number;
  repeat?: number;
}

const ASPECT_RATIOS = [
  { value: "1:1", label: "1:1 (Square)" },
  { value: "16:9", label: "16:9 (Landscape)" },
  { value: "9:16", label: "9:16 (Portrait)" },
  { value: "4:3", label: "4:3" },
  { value: "3:4", label: "3:4" },
  { value: "21:9", label: "21:9 (Ultra-wide)" },
];

const STORAGE_KEY_PROVIDER = "generate-provider";
const STORAGE_KEY_LOCAL_MODEL = "generate-local-model";
const STORAGE_KEY_STABILITY_MODEL = "generate-stability-model";

function loadSavedPreferences(): {
  provider: Provider;
  localModel: LocalGenerateModel;
  stabilityModel: StabilityModel;
} {
  try {
    const provider =
      (localStorage.getItem(STORAGE_KEY_PROVIDER) as Provider) || "stability";
    const localModel =
      (localStorage.getItem(STORAGE_KEY_LOCAL_MODEL) as LocalGenerateModel) ||
      "sdxl";
    const stabilityModel =
      (localStorage.getItem(STORAGE_KEY_STABILITY_MODEL) as StabilityModel) ||
      "sd3.5-large";
    return { provider, localModel, stabilityModel };
  } catch {
    return {
      provider: "stability",
      localModel: "sdxl",
      stabilityModel: "sd3.5-large",
    };
  }
}

export function GenerateModal({
  isOpen,
  onClose,
  onGenerate,
  isGenerating,
  availableLocalModels = [],
  saveDirName,
  onSelectFolder,
}: GenerateModalProps) {
  // Load saved preferences on mount
  const savedPrefs = loadSavedPreferences();

  // Provider and model selection
  const [provider, setProviderState] = useState<Provider>(savedPrefs.provider);
  const [localModel, setLocalModelState] = useState<LocalGenerateModel>(
    savedPrefs.localModel,
  );
  const [stabilityModel, setStabilityModelState] = useState<StabilityModel>(
    savedPrefs.stabilityModel,
  );

  // Wrapper functions that also save to localStorage
  const setProvider = useCallback((p: Provider) => {
    setProviderState(p);
    try {
      localStorage.setItem(STORAGE_KEY_PROVIDER, p);
    } catch {}
  }, []);

  const setLocalModel = useCallback((m: LocalGenerateModel) => {
    setLocalModelState(m);
    try {
      localStorage.setItem(STORAGE_KEY_LOCAL_MODEL, m);
    } catch {}
  }, []);

  const setStabilityModel = useCallback((m: StabilityModel) => {
    setStabilityModelState(m);
    try {
      localStorage.setItem(STORAGE_KEY_STABILITY_MODEL, m);
    } catch {}
  }, []);

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
  const [showAdvanced, setShowAdvanced] = useState(false);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  // Get current model info
  const currentLocalModelInfo = LOCAL_MODELS.find((m) => m.id === localModel);
  const currentStabilityModelInfo = STABILITY_MODELS.find(
    (m) => m.id === stabilityModel,
  );

  const isLocalProvider = provider === "local";
  const currentModel = isLocalProvider ? localModel : stabilityModel;
  const supportsNegativePrompt = isLocalProvider
    ? currentLocalModelInfo?.supportsNegativePrompt
    : currentStabilityModelInfo?.supportsNegativePrompt;
  const supportsDimensions = isLocalProvider
    ? true
    : currentStabilityModelInfo?.supportsDimensions;
  const supportsAspectRatio = isLocalProvider
    ? false
    : currentStabilityModelInfo?.supportsAspectRatio;

  // Focus prompt input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => promptRef.current?.focus(), 0);
    }
  }, [isOpen]);

  // Update steps when model changes
  useEffect(() => {
    if (isLocalProvider && currentLocalModelInfo) {
      setSteps(String(currentLocalModelInfo.defaultSteps));
    }
  }, [isLocalProvider, currentLocalModelInfo]);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;

    const options: GenerateOptions = {
      provider,
      model: currentModel,
      prompt: prompt.trim(),
    };

    if (supportsNegativePrompt && negativePrompt.trim()) {
      options.negativePrompt = negativePrompt.trim();
    }

    if (supportsDimensions) {
      const w = Number.parseInt(width, 10);
      const h = Number.parseInt(height, 10);
      if (w > 0) options.width = w;
      if (h > 0) options.height = h;
    }

    if (supportsAspectRatio) {
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
    provider,
    currentModel,
    prompt,
    negativePrompt,
    width,
    height,
    aspectRatio,
    seed,
    steps,
    cfgScale,
    repeat,
    supportsNegativePrompt,
    supportsDimensions,
    supportsAspectRatio,
    onGenerate,
  ]);

  const handleClose = () => {
    if (!isGenerating) {
      onClose();
    }
  };

  const isValid = prompt.trim().length > 0;
  const hasLocalModels = availableLocalModels.length > 0;

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
              disabled={isGenerating}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-5 overflow-y-auto flex-1">
            {/* Provider Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Provider
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setProvider("stability")}
                  className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                    provider === "stability"
                      ? "bg-primary text-white border-primary"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  Stability AI
                </button>
                <button
                  type="button"
                  onClick={() => setProvider("local")}
                  disabled={!hasLocalModels}
                  className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                    provider === "local"
                      ? "bg-primary text-white border-primary"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                  title={
                    !hasLocalModels ? "No local server available" : undefined
                  }
                >
                  Local (ai3)
                </button>
              </div>
            </div>

            {/* Model Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Model
              </label>
              {isLocalProvider ? (
                <select
                  value={localModel}
                  onChange={(e) =>
                    setLocalModel(e.target.value as LocalGenerateModel)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  {LOCAL_MODELS.filter((m) =>
                    availableLocalModels.includes(m.id),
                  ).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} - {m.description}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={stabilityModel}
                  onChange={(e) =>
                    setStabilityModel(e.target.value as StabilityModel)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  {STABILITY_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} - {m.description}
                    </option>
                  ))}
                </select>
              )}
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
            {supportsNegativePrompt && (
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

            {/* Dimensions or Aspect Ratio */}
            {supportsDimensions && (
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

            {supportsAspectRatio && (
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
                    Generate multiple images with the same parameters.
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

            {/* Advanced Options */}
            <div>
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-800"
              >
                {showAdvanced ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
                Advanced Options
              </button>

              {showAdvanced && (
                <div className="mt-3 grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Seed
                    </label>
                    <input
                      type="number"
                      value={seed}
                      onChange={(e) => setSeed(e.target.value)}
                      min={0}
                      placeholder="0 = random"
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Steps
                    </label>
                    <input
                      type="number"
                      value={steps}
                      onChange={(e) => setSteps(e.target.value)}
                      min={1}
                      max={100}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      CFG Scale
                    </label>
                    <input
                      type="number"
                      value={cfgScale}
                      onChange={(e) => setCfgScale(e.target.value)}
                      min={0}
                      max={20}
                      step={0.5}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 shrink-0 space-y-3">
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
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onMouseDownCapture={handleClose}
                disabled={isGenerating}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onMouseDownCapture={handleGenerate}
                disabled={!isValid || isGenerating || !saveDirName}
                className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-hover transition-colors cursor-pointer disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
                title={
                  !saveDirName ? "Please select a folder first" : undefined
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
        </DialogPanel>
      </div>
    </Dialog>
  );
}
