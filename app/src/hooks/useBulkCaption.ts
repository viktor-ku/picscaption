import { useCallback, useMemo, useRef } from "react";
import { useAtom, useSetAtom } from "jotai";
import { useQuery } from "@tanstack/react-query";
import {
  bulkCaptionStateAtom,
  bulkCaptionProgressAtom,
  bulkCaptionStatsAtom,
  bulkCaptionCancelledAtom,
  imagesAtom,
  store,
} from "../lib/store";
import { OpenRouterClient } from "../lib/openrouter-client";
import { CAPTION_MODEL_INFO } from "../lib/settings";

/** Concurrency limit for parallel caption requests */
const CONCURRENCY_LIMIT = 3;

export interface UseBulkCaptionOptions {
  /** Called when a single image caption is updated */
  onCaptionUpdate?: (imageId: string, caption: string) => void;
}

export interface UseBulkCaptionReturn {
  /** Start bulk caption generation */
  startBulkCaption: (modelId: string, systemPrompt: string) => Promise<void>;
  /** Cancel ongoing bulk caption */
  cancelBulkCaption: () => void;
  /** Current state */
  state: "idle" | "captioning" | "done" | "cancelled";
  /** Current progress */
  progress: { current: number; total: number } | null;
  /** Statistics */
  stats: {
    success: number;
    errors: number;
    startTime: number;
    endTime?: number;
  } | null;
  /** Reset state to idle */
  resetState: () => void;
  /** Available OpenRouter models */
  availableModels: Array<{ id: string; name: string; description: string }>;
  /** Whether OpenRouter is available */
  isAvailable: boolean;
}

export function useBulkCaption(
  options: UseBulkCaptionOptions = {},
): UseBulkCaptionReturn {
  const { onCaptionUpdate } = options;

  const [state, setState] = useAtom(bulkCaptionStateAtom);
  const [progress, setProgress] = useAtom(bulkCaptionProgressAtom);
  const [stats, setStats] = useAtom(bulkCaptionStatsAtom);
  const setCancelled = useSetAtom(bulkCaptionCancelledAtom);
  const [images, setImages] = useAtom(imagesAtom);

  // Create OpenRouter client
  const openRouterClient = useMemo(() => new OpenRouterClient(), []);

  // Check OpenRouter availability
  const { data: openRouterActive } = useQuery({
    queryKey: ["openrouter-status"],
    queryFn: () => openRouterClient.ping(),
    retry: false,
    staleTime: 30000,
  });

  // Get available OpenRouter models
  const availableModels = useMemo(() => {
    if (!openRouterActive) return [];

    return Object.entries(CAPTION_MODEL_INFO)
      .filter(([, info]) => info.provider === "openrouter")
      .map(([id, info]) => ({
        id,
        name: info.name,
        description: info.description,
      }));
  }, [openRouterActive]);

  // Refs for tracking mutable state during async operations
  const successCountRef = useRef(0);
  const errorCountRef = useRef(0);
  const completedCountRef = useRef(0);

  const startBulkCaption = useCallback(
    async (modelId: string, systemPrompt: string) => {
      if (images.length === 0) return;

      // Reset cancellation flag and counters
      setCancelled(false);
      successCountRef.current = 0;
      errorCountRef.current = 0;
      completedCountRef.current = 0;

      const startTime = Date.now();

      // Initialize state
      setState("captioning");
      setProgress({ current: 0, total: images.length });
      setStats({
        success: 0,
        errors: 0,
        startTime,
      });

      // Process a single image and update state
      const processImage = async (image: (typeof images)[0]): Promise<void> => {
        // Check for cancellation before starting
        if (store.get(bulkCaptionCancelledAtom)) {
          return;
        }

        try {
          // Generate caption
          const result = await openRouterClient.caption(image.file, {
            model: modelId,
            systemPrompt,
          });

          // Check for cancellation after API call
          if (store.get(bulkCaptionCancelledAtom)) {
            return;
          }

          // Update image caption
          setImages((draft) => {
            const idx = draft.findIndex((img) => img.id === image.id);
            if (idx !== -1) {
              draft[idx].caption = result.caption;
            }
          });

          // Call optional callback
          onCaptionUpdate?.(image.id, result.caption);

          successCountRef.current++;
        } catch (error) {
          console.error(`Failed to caption image ${image.fileName}:`, error);
          errorCountRef.current++;
        }

        // Update progress
        completedCountRef.current++;
        setProgress({
          current: completedCountRef.current,
          total: images.length,
        });
        setStats({
          success: successCountRef.current,
          errors: errorCountRef.current,
          startTime,
        });
      };

      // Process images with concurrency limit
      const queue = [...images];
      const inFlight: Promise<void>[] = [];

      while (queue.length > 0 || inFlight.length > 0) {
        // Check for cancellation
        if (store.get(bulkCaptionCancelledAtom)) {
          // Wait for in-flight requests to complete
          await Promise.all(inFlight);
          setStats((prev) => (prev ? { ...prev, endTime: Date.now() } : null));
          setState("cancelled");
          return;
        }

        // Start new requests up to concurrency limit
        while (queue.length > 0 && inFlight.length < CONCURRENCY_LIMIT) {
          const image = queue.shift()!;
          const promise = processImage(image).then(() => {
            // Remove from in-flight when done
            const idx = inFlight.indexOf(promise);
            if (idx !== -1) {
              inFlight.splice(idx, 1);
            }
          });
          inFlight.push(promise);
        }

        // Wait for at least one to complete before continuing
        if (inFlight.length > 0) {
          await Promise.race(inFlight);
        }
      }

      // Finalize
      setStats((prev) => (prev ? { ...prev, endTime: Date.now() } : null));
      setState("done");
    },
    [
      images,
      openRouterClient,
      setImages,
      setState,
      setProgress,
      setStats,
      setCancelled,
      onCaptionUpdate,
    ],
  );

  const cancelBulkCaption = useCallback(() => {
    setCancelled(true);
  }, [setCancelled]);

  const resetState = useCallback(() => {
    setState("idle");
    setProgress(null);
    setStats(null);
    setCancelled(false);
  }, [setState, setProgress, setStats, setCancelled]);

  return {
    startBulkCaption,
    cancelBulkCaption,
    state,
    progress,
    stats,
    resetState,
    availableModels,
    isAvailable: openRouterActive === true,
  };
}
