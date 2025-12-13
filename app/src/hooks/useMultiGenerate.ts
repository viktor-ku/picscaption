import { useCallback, useMemo, useRef } from "react";
import { useAtom, useSetAtom, useAtomValue } from "jotai";
import { useQuery } from "@tanstack/react-query";
import {
  generateStateAtom,
  generateProgressAtom,
  generateCancelledAtom,
  generateSelectedModelsAtom,
  imagesAtom,
  currentDirectoryAtom,
  store,
  type GenerateState,
  type GenerateProgress,
} from "../lib/store";
import {
  type GenerateModelId,
  type MultiGenerateOptions,
  GENERATE_MODELS,
  getModelInfo,
  isStabilityModel,
  toStabilityModel,
  toLocalModel,
  getLocalModels,
} from "../lib/generate-models";
import { StabilityGenerateClient } from "../lib/stability-generate-client";
import {
  UpscaleClient,
  type LocalGenerateModel,
} from "../lib/ai3-upscale-client";
import type { ImageData } from "../types";
import { generateThumbnail } from "../lib/thumbnail";
import { generateUUID } from "../lib/image-identity";

export interface UseMultiGenerateOptions {
  /** AI3 server URL (empty = disabled) */
  ai3ServerUrl?: string;
  /** Directory handle for saving generated images */
  directoryHandle?: FileSystemDirectoryHandle | null;
}

export interface UseMultiGenerateReturn {
  /** Start multi-model generation */
  startGeneration: (options: MultiGenerateOptions) => Promise<void>;
  /** Cancel ongoing generation */
  cancelGeneration: () => void;
  /** Current state */
  state: GenerateState;
  /** Current progress */
  progress: GenerateProgress | null;
  /** Whether generation is in progress */
  isGenerating: boolean;
  /** Reset state to idle */
  resetState: () => void;
  /** Available local models (from ai3 server) */
  availableLocalModels: LocalGenerateModel[];
  /** Selected models (persisted) */
  selectedModels: string[];
  /** Update selected models */
  setSelectedModels: (models: string[]) => void;
  /** All models with availability info */
  allModels: Array<{
    id: GenerateModelId;
    name: string;
    description: string;
    provider: "stability" | "local";
    available: boolean;
  }>;
}

export function useMultiGenerate(
  options: UseMultiGenerateOptions = {},
): UseMultiGenerateReturn {
  const { ai3ServerUrl = "", directoryHandle } = options;

  // Jotai atoms
  const [state, setState] = useAtom(generateStateAtom);
  const [progress, setProgress] = useAtom(generateProgressAtom);
  const setCancelled = useSetAtom(generateCancelledAtom);
  const [selectedModels, setSelectedModels] = useAtom(
    generateSelectedModelsAtom,
  );
  const [images, setImages] = useAtom(imagesAtom);
  const currentDirectory = useAtomValue(currentDirectoryAtom);

  // Store directory handle in ref for async access
  const directoryHandleRef = useRef(directoryHandle);
  directoryHandleRef.current = directoryHandle;

  // Create clients
  const stabilityClient = useMemo(() => new StabilityGenerateClient(), []);
  const ai3Client = useMemo(() => {
    if (!ai3ServerUrl) return null;
    return new UpscaleClient(ai3ServerUrl);
  }, [ai3ServerUrl]);

  // Query ai3 capabilities to get available local models
  const { data: ai3Capabilities } = useQuery({
    queryKey: ["ai3-capabilities", ai3ServerUrl],
    queryFn: async () => {
      if (!ai3Client) return null;
      return ai3Client.capabilities();
    },
    enabled: ai3Client !== null,
    retry: false,
    staleTime: 60000,
  });

  // Extract available local models from capabilities
  const availableLocalModels: LocalGenerateModel[] = useMemo(() => {
    return (
      ai3Capabilities?.capabilities
        ?.filter((c) => c.kind === "image")
        .map((c) => c.model as LocalGenerateModel) ?? []
    );
  }, [ai3Capabilities]);

  // Build list of all models with availability
  const allModels = useMemo(() => {
    return GENERATE_MODELS.map((model) => ({
      id: model.id,
      name: model.name,
      description: model.description,
      provider: model.provider,
      available:
        model.provider === "stability"
          ? true // Stability is always available (API key checked at generation time)
          : availableLocalModels.includes(
              model.apiModelId as LocalGenerateModel,
            ),
    }));
  }, [availableLocalModels]);

  // Refs for mutable state during async operations
  const completedCountRef = useRef(0);

  // Save generated file to directory
  const saveGeneratedFile = useCallback(
    async (blob: Blob, fileName: string): Promise<void> => {
      const dirHandle = directoryHandleRef.current;
      if (!dirHandle) {
        throw new Error("No folder selected");
      }

      const fileHandle = await dirHandle.getFileHandle(fileName, {
        create: true,
      });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
    },
    [],
  );

  // Generate a single image
  const generateSingle = useCallback(
    async (
      modelId: GenerateModelId,
      options: Omit<MultiGenerateOptions, "models">,
      iterationSeed: number,
    ): Promise<ImageData | null> => {
      const modelInfo = getModelInfo(modelId);
      if (!modelInfo) {
        console.error(`Unknown model: ${modelId}`);
        return null;
      }

      let blob: Blob;

      try {
        if (isStabilityModel(modelId)) {
          blob = await stabilityClient.generate({
            model: toStabilityModel(modelId),
            prompt: options.prompt,
            negativePrompt: modelInfo.supportsNegativePrompt
              ? options.negativePrompt
              : undefined,
            width: modelInfo.supportsDimensions ? options.width : undefined,
            height: modelInfo.supportsDimensions ? options.height : undefined,
            aspectRatio: modelInfo.supportsAspectRatio
              ? options.aspectRatio
              : undefined,
            seed: iterationSeed || undefined,
            steps: options.steps,
            cfgScale: modelInfo.supportsGuidance ? options.cfgScale : undefined,
          });
        } else {
          // Local model via ai3
          if (!ai3Client) {
            throw new Error("Local ai3 server not configured");
          }
          blob = await ai3Client.generate({
            prompt: options.prompt,
            negativePrompt: modelInfo.supportsNegativePrompt
              ? options.negativePrompt
              : undefined,
            width: options.width,
            height: options.height,
            seed: iterationSeed || undefined,
            steps: options.steps,
            guidance: modelInfo.supportsGuidance ? options.cfgScale : undefined,
            model: toLocalModel(modelId),
          });
        }
      } catch (error) {
        console.error(`Generation failed for model ${modelId}:`, error);
        throw error;
      }

      // Create filename with model name for identification
      const timestamp = Date.now();
      const modelShortName = modelInfo.apiModelId.replace(/[^a-z0-9]/gi, "-");
      const fileName = `generated_${modelShortName}_${timestamp}.png`;

      // Save to directory
      await saveGeneratedFile(blob, fileName);

      // Create File object
      const file = new File([blob], fileName, { type: "image/png" });
      const fullImageUrl = URL.createObjectURL(file);

      // Generate thumbnail
      const thumbnailUrl = await generateThumbnail(file);

      // Get dimensions
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = fullImageUrl;
      });

      // Create ImageData
      const newImage: ImageData = {
        id: `generated-${timestamp}-${Math.random().toString(36).slice(2, 8)}`,
        uuid: generateUUID(),
        fileName,
        namespace: currentDirectory ?? "",
        caption: options.prompt,
        tags: [],
        file,
        thumbnailUrl,
        fullImageUrl,
        width: img.width,
        height: img.height,
      };

      return newImage;
    },
    [stabilityClient, ai3Client, saveGeneratedFile, currentDirectory],
  );

  const startGeneration = useCallback(
    async (options: MultiGenerateOptions) => {
      const { models, repeat = 1 } = options;

      if (models.length === 0) {
        console.warn("No models selected for generation");
        return;
      }

      // Reset state
      setCancelled(false);
      completedCountRef.current = 0;

      const totalJobs = models.length * repeat;

      // Initialize state
      setState("generating");
      setProgress({
        current: 0,
        total: totalJobs,
        currentModel: models[0],
      });

      try {
        // Process each model
        for (const modelId of models) {
          // Generate 'repeat' times for each model
          for (let i = 0; i < repeat; i++) {
            // Check for cancellation
            if (store.get(generateCancelledAtom)) {
              setState("cancelled");
              return;
            }

            // Update progress with current model
            setProgress({
              current: completedCountRef.current,
              total: totalJobs,
              currentModel: modelId,
            });

            // Calculate seed for this iteration
            const iterationSeed = options.seed ? options.seed + i : 0;

            try {
              const newImage = await generateSingle(
                modelId,
                options,
                iterationSeed,
              );

              if (newImage) {
                // Add to images array immediately
                setImages((draft) => {
                  draft.push(newImage);
                });
              }
            } catch (error) {
              // Log but continue with other models
              console.error(
                `Failed to generate with ${modelId} (iteration ${i + 1}):`,
                error,
              );
            }

            // Update progress
            completedCountRef.current++;
            setProgress({
              current: completedCountRef.current,
              total: totalJobs,
              currentModel: modelId,
            });
          }
        }

        // Done
        setState("done");

        // Reset to idle after brief delay
        setTimeout(() => {
          setState("idle");
          setProgress(null);
        }, 3000);
      } catch (error) {
        console.error("Generation failed:", error);
        setState("idle");
        setProgress(null);
      }
    },
    [generateSingle, setImages, setState, setProgress, setCancelled],
  );

  const cancelGeneration = useCallback(() => {
    setCancelled(true);
  }, [setCancelled]);

  const resetState = useCallback(() => {
    setState("idle");
    setProgress(null);
    setCancelled(false);
  }, [setState, setProgress, setCancelled]);

  return {
    startGeneration,
    cancelGeneration,
    state,
    progress,
    isGenerating: state === "generating",
    resetState,
    availableLocalModels,
    selectedModels,
    setSelectedModels,
    allModels,
  };
}
