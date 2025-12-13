import { useState, useCallback, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { OpenRouterClient } from "../lib/openrouter-client";
import { useConvexAvailable } from "../components/ConvexClientProvider";

export interface CaptionResult {
  modelId: string;
  caption: string;
  timestamp: number;
  error?: string;
}

export interface UseCaptionsWorkflowOptions {
  userId: Id<"users"> | null;
}

export interface UseCaptionsWorkflowReturn {
  /** Current system prompt */
  systemPrompt: string;
  /** Set the system prompt (local state, call saveSystemPrompt to persist) */
  setSystemPrompt: (prompt: string) => void;
  /** Save system prompt to Convex */
  saveSystemPrompt: () => Promise<void>;
  /** Whether system prompt is being saved */
  isSavingPrompt: boolean;
  /** Selected models for generation */
  selectedModels: string[];
  /** Toggle a model's selection */
  toggleModel: (modelId: string) => void;
  /** Set all selected models at once */
  setSelectedModels: (modelIds: string[]) => void;
  /** Generate captions for all selected models in parallel */
  generateCaptions: (image: File | Blob) => Promise<void>;
  /** Whether generation is in progress */
  isGenerating: boolean;
  /** Generation results */
  results: CaptionResult[];
  /** Clear all results */
  clearResults: () => void;
  /** Loading state for initial data fetch */
  isLoading: boolean;
}

const DEFAULT_SYSTEM_PROMPT = `Describe this image concisely but thoroughly. Focus on the main subjects, their actions, setting, colors, and mood. Write a single paragraph caption suitable for image training datasets.`;

export function useCaptionsWorkflow({
  userId,
}: UseCaptionsWorkflowOptions): UseCaptionsWorkflowReturn {
  const isConvexAvailable = useConvexAvailable();

  // Local state
  const [systemPrompt, setSystemPromptLocal] = useState(DEFAULT_SYSTEM_PROMPT);
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [results, setResults] = useState<CaptionResult[]>([]);

  // Convex queries and mutations
  const userSettings = useQuery(
    api.userSettings.get,
    isConvexAvailable && userId ? { userId } : "skip",
  );
  const upsertSystemPromptMutation = useMutation(
    api.userSettings.upsertSystemPrompt,
  );

  // Sync local state with Convex data when it loads
  useEffect(() => {
    if (userSettings?.captionSystemPrompt) {
      setSystemPromptLocal(userSettings.captionSystemPrompt);
    }
  }, [userSettings?.captionSystemPrompt]);

  // OpenRouter client
  const openRouterClient = useMemo(() => new OpenRouterClient(), []);

  // Set system prompt
  const setSystemPrompt = useCallback((prompt: string) => {
    setSystemPromptLocal(prompt);
  }, []);

  // Save system prompt to Convex
  const saveSystemPrompt = useCallback(async () => {
    if (!isConvexAvailable || !userId) return;

    setIsSavingPrompt(true);
    try {
      await upsertSystemPromptMutation({
        userId,
        systemPrompt: systemPrompt,
      });
    } catch (error) {
      console.error("Failed to save system prompt:", error);
      throw error;
    } finally {
      setIsSavingPrompt(false);
    }
  }, [isConvexAvailable, userId, systemPrompt, upsertSystemPromptMutation]);

  // Toggle model selection
  const toggleModel = useCallback((modelId: string) => {
    setSelectedModels((prev) =>
      prev.includes(modelId)
        ? prev.filter((id) => id !== modelId)
        : [...prev, modelId],
    );
  }, []);

  // Generate captions for all selected models in parallel
  const generateCaptions = useCallback(
    async (image: File | Blob) => {
      if (selectedModels.length === 0) {
        return;
      }

      setIsGenerating(true);
      setResults([]);

      const promises = selectedModels.map(async (modelId) => {
        try {
          const response = await openRouterClient.caption(image, {
            model: modelId,
            systemPrompt: systemPrompt,
          });
          return {
            modelId,
            caption: response.caption,
            timestamp: Date.now(),
          };
        } catch (error) {
          return {
            modelId,
            caption: "",
            timestamp: Date.now(),
            error: error instanceof Error ? error.message : "Caption failed",
          };
        }
      });

      const newResults = await Promise.all(promises);
      setResults(newResults);
      setIsGenerating(false);
    },
    [selectedModels, openRouterClient, systemPrompt],
  );

  // Clear results
  const clearResults = useCallback(() => {
    setResults([]);
  }, []);

  const isLoading =
    isConvexAvailable && userId !== null && userSettings === undefined;

  return {
    systemPrompt,
    setSystemPrompt,
    saveSystemPrompt,
    isSavingPrompt,
    selectedModels,
    toggleModel,
    setSelectedModels,
    generateCaptions,
    isGenerating,
    results,
    clearResults,
    isLoading,
  };
}
