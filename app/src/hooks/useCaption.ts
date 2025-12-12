import { useState, useMemo, useCallback } from "react";
import { useAtomValue } from "jotai";
import { useQuery } from "@tanstack/react-query";
import { settingsAtom } from "../lib/store";
import {
  type CaptionModelId,
  CAPTION_MODEL_INFO,
  DEFAULT_CAPTION_MODEL_PRIORITY,
} from "../lib/settings";
import {
  UpscaleClient,
  getCaptionCapabilities,
  type CapabilitiesResponse,
} from "../lib/ai3-upscale-client";
import { OpenRouterClient } from "../lib/openrouter-client";

export interface UseCaptionResult {
  /** Generate a caption for an image */
  generateCaption: (image: File | Blob) => Promise<string>;
  /** Whether caption generation is in progress */
  isGenerating: boolean;
  /** Error message if caption generation failed */
  error: string | null;
  /** The first available model based on priority */
  activeModel: CaptionModelId | null;
  /** All available models */
  availableModels: Set<CaptionModelId>;
  /** Whether any caption model is available */
  isAvailable: boolean;
}

export function useCaption(): UseCaptionResult {
  const settings = useAtomValue(settingsAtom);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create clients
  const ai3Client = useMemo(() => {
    const url = settings.upscaleServerUrl?.trim();
    if (url) {
      return new UpscaleClient(url);
    }
    return null;
  }, [settings.upscaleServerUrl]);

  const openRouterClient = useMemo(() => new OpenRouterClient(), []);

  // Check ai3 capabilities
  const { data: ai3Caps } = useQuery({
    queryKey: ["ai3-capabilities", settings.upscaleServerUrl],
    queryFn: async () => {
      if (!ai3Client) return null;
      try {
        await ai3Client.ping();
        return await ai3Client.capabilities();
      } catch {
        return null;
      }
    },
    enabled: Boolean(settings.upscaleServerUrl?.trim()),
    retry: false,
    staleTime: 30000,
  });

  // Check OpenRouter availability
  const { data: openRouterActive } = useQuery({
    queryKey: ["openrouter-status"],
    queryFn: () => openRouterClient.ping(),
    retry: false,
    staleTime: 30000,
  });

  // Determine available models dynamically from CAPTION_MODEL_INFO
  const availableModels = useMemo(() => {
    const available = new Set<CaptionModelId>();

    // Check local models from ai3 capabilities
    if (ai3Caps) {
      const captionCaps = getCaptionCapabilities(ai3Caps);
      const ai3ModelIds = captionCaps.map((c) => c.model);
      for (const [id, info] of Object.entries(CAPTION_MODEL_INFO)) {
        if (info.provider === "ai3" && ai3ModelIds.includes(id)) {
          available.add(id as CaptionModelId);
        }
      }
    }

    // All OpenRouter models are available if API key is configured
    if (openRouterActive) {
      for (const [id, info] of Object.entries(CAPTION_MODEL_INFO)) {
        if (info.provider === "openrouter") {
          available.add(id as CaptionModelId);
        }
      }
    }

    return available;
  }, [ai3Caps, openRouterActive]);

  // Get priority list
  const priority =
    settings.captionModelPriority ?? DEFAULT_CAPTION_MODEL_PRIORITY;

  // Find first available model
  const activeModel = useMemo(() => {
    return priority.find((id) => availableModels.has(id)) ?? null;
  }, [priority, availableModels]);

  // Generate caption
  const generateCaption = useCallback(
    async (image: File | Blob): Promise<string> => {
      if (!activeModel) {
        throw new Error("No caption models available");
      }

      setIsGenerating(true);
      setError(null);

      try {
        const modelInfo = CAPTION_MODEL_INFO[activeModel];

        if (modelInfo.provider === "ai3") {
          if (!ai3Client) {
            throw new Error("ai3 server not configured");
          }
          const result = await ai3Client.caption(image, {
            model: activeModel as
              | "blip2"
              | "florence2-base"
              | "florence2-large",
          });
          return result.caption;
        }

        // OpenRouter - pass model ID as string
        const result = await openRouterClient.caption(image, {
          model: activeModel,
        });
        return result.caption;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Caption generation failed";
        setError(message);
        throw err;
      } finally {
        setIsGenerating(false);
      }
    },
    [activeModel, ai3Client, openRouterClient],
  );

  return {
    generateCaption,
    isGenerating,
    error,
    activeModel,
    availableModels,
    isAvailable: activeModel !== null,
  };
}
