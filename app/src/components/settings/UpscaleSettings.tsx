import { useState, useMemo } from "react";
import {
  Loader2,
  CheckCircle2,
  GripVertical,
  Settings2,
  AlertCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { UpscaleClient } from "../../lib/ai3-upscale-client";
import { StabilityUpscaleClient } from "../../lib/stability-upscale-client";
import {
  type Settings,
  type UpscaleProvider,
  type UpscaleProviderConfig,
  UPSCALE_PROVIDER_INFO,
} from "../../lib/settings";
import { Toggle } from "../Toggle";

/** Check if a string is a valid URL */
function isValidUrl(urlString: string): boolean {
  if (!urlString.trim()) return false;
  try {
    const url = new URL(urlString.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

// Sortable provider item component
interface SortableProviderItemProps {
  provider: UpscaleProviderConfig;
  isConfigOpen: boolean;
  status: "ready" | "not-configured" | "unavailable";
  onToggleEnabled: (enabled: boolean) => void;
  onConfigClick: () => void;
}

function SortableProviderItem({
  provider,
  isConfigOpen,
  status,
  onToggleEnabled,
  onConfigClick,
}: SortableProviderItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: provider.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const info = UPSCALE_PROVIDER_INFO[provider.id];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 bg-white border rounded-lg ${
        isDragging ? "shadow-lg border-primary" : "border-gray-200"
      } ${isConfigOpen ? "ring-2 ring-primary/30" : ""}`}
    >
      {/* Drag handle */}
      <button
        type="button"
        className="p-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-4 h-4" />
      </button>

      {/* Provider info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900">{info.name}</span>
          {/* Status badge */}
          {status === "ready" && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium text-green-700 bg-green-100 rounded">
              <CheckCircle2 className="w-3 h-3" />
              Ready
            </span>
          )}
          {status === "not-configured" && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium text-gray-500 bg-gray-100 rounded">
              Not configured
            </span>
          )}
          {status === "unavailable" && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium text-red-700 bg-red-100 rounded">
              <AlertCircle className="w-3 h-3" />
              Unavailable
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 truncate">{info.description}</p>
      </div>

      {/* Enable toggle */}
      <Toggle
        checked={provider.enabled}
        onChange={onToggleEnabled}
        label=""
        size="sm"
      />

      {/* Config gear icon */}
      <button
        type="button"
        onClick={onConfigClick}
        className={`p-1.5 rounded-md transition-colors cursor-pointer ${
          isConfigOpen
            ? "text-primary bg-primary/10"
            : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
        }`}
      >
        <Settings2 className="w-4 h-4" />
      </button>
    </div>
  );
}

interface UpscaleSettingsProps {
  settings: Settings;
  onSettingsChange: (settings: Settings) => void;
}

export function UpscaleSettings({
  settings,
  onSettingsChange,
}: UpscaleSettingsProps) {
  const [upscaleUrl, setUpscaleUrl] = useState(settings.upscaleServerUrl);
  const [stabilityApiKey, setStabilityApiKey] = useState(
    settings.stabilityApiKey,
  );
  const [openConfigProvider, setOpenConfigProvider] =
    useState<UpscaleProvider | null>(null);
  const queryClient = useQueryClient();

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Memoized URL validation
  const urlIsValid = useMemo(() => isValidUrl(upscaleUrl), [upscaleUrl]);

  // Mutation for connecting to AI3 upscale server
  const connectMutation = useMutation({
    mutationFn: async (url: string) => {
      const client = new UpscaleClient(url);
      return client.ping();
    },
    onSuccess: () => {
      const trimmedUrl = upscaleUrl.trim();
      onSettingsChange({ ...settings, upscaleServerUrl: trimmedUrl });
      queryClient.invalidateQueries({ queryKey: ["upscale-server-status"] });
      toast.success("Connected to AI3 server");
    },
    onError: () => {
      toast.error("Server unavailable");
    },
  });

  // Mutation for testing Stability AI connection
  const stabilityConnectMutation = useMutation({
    mutationFn: async (apiKey: string) => {
      const client = new StabilityUpscaleClient(apiKey || undefined);
      const ready = await client.ping();
      if (!ready) {
        throw new Error("API key not configured or invalid");
      }
      return ready;
    },
    onSuccess: () => {
      const trimmedKey = stabilityApiKey.trim();
      onSettingsChange({ ...settings, stabilityApiKey: trimmedKey });
      queryClient.invalidateQueries({ queryKey: ["stability-server-status"] });
      toast.success("Stability AI connected");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Connection failed");
    },
  });

  // Check AI3 server status
  const hasConfiguredUrl = Boolean(settings.upscaleServerUrl?.trim());
  const upscaleClient = useMemo(() => {
    const url = settings.upscaleServerUrl?.trim();
    if (url) {
      return new UpscaleClient(url);
    }
    return null;
  }, [settings.upscaleServerUrl]);

  const { data: isAi3Connected } = useQuery({
    queryKey: ["upscale-server-status", settings.upscaleServerUrl],
    queryFn: async () => {
      if (!upscaleClient) return false;
      await upscaleClient.ping();
      return true;
    },
    enabled: hasConfiguredUrl && upscaleClient !== null,
    retry: false,
  });

  // Check Stability AI status
  const stabilityClient = useMemo(() => {
    const key = settings.stabilityApiKey?.trim();
    return new StabilityUpscaleClient(key || undefined);
  }, [settings.stabilityApiKey]);

  const { data: isStabilityConnected } = useQuery({
    queryKey: ["stability-server-status", settings.stabilityApiKey],
    queryFn: async () => {
      return stabilityClient.ping();
    },
    retry: false,
  });

  // Get provider status
  const getProviderStatus = (
    providerId: UpscaleProvider,
  ): "ready" | "not-configured" | "unavailable" => {
    if (providerId === "ai3") {
      if (!settings.upscaleServerUrl?.trim()) return "not-configured";
      return isAi3Connected ? "ready" : "unavailable";
    }
    if (isStabilityConnected) return "ready";
    if (!settings.stabilityApiKey?.trim()) return "not-configured";
    return "unavailable";
  };

  const canConnect = urlIsValid && !connectMutation.isPending;
  const canConnectStability = !stabilityConnectMutation.isPending;

  const handleConnect = () => {
    if (!canConnect) return;
    connectMutation.mutate(upscaleUrl.trim());
  };

  const handleStabilityConnect = () => {
    if (!canConnectStability) return;
    stabilityConnectMutation.mutate(stabilityApiKey.trim());
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = settings.upscaleProviders.findIndex(
        (p) => p.id === active.id,
      );
      const newIndex = settings.upscaleProviders.findIndex(
        (p) => p.id === over.id,
      );

      const newProviders = arrayMove(
        settings.upscaleProviders,
        oldIndex,
        newIndex,
      );
      onSettingsChange({ ...settings, upscaleProviders: newProviders });
    }
  };

  const handleToggleProvider = (
    providerId: UpscaleProvider,
    enabled: boolean,
  ) => {
    const newProviders = settings.upscaleProviders.map((p) =>
      p.id === providerId ? { ...p, enabled } : p,
    );
    onSettingsChange({ ...settings, upscaleProviders: newProviders });
  };

  return (
    <>
      {/* Section description */}
      <div className="space-y-2">
        <p className="text-sm text-gray-600">
          Configure upscaling providers. Drag to reorder priority - enabled
          providers are tried in order from top to bottom.
        </p>
      </div>

      {/* Provider list */}
      <div className="space-y-3">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={settings.upscaleProviders.map((p) => p.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {settings.upscaleProviders.map((provider) => (
                <SortableProviderItem
                  key={provider.id}
                  provider={provider}
                  isConfigOpen={openConfigProvider === provider.id}
                  status={getProviderStatus(provider.id)}
                  onToggleEnabled={(enabled) =>
                    handleToggleProvider(provider.id, enabled)
                  }
                  onConfigClick={() =>
                    setOpenConfigProvider(
                      openConfigProvider === provider.id ? null : provider.id,
                    )
                  }
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* Config panel */}
      {openConfigProvider === "ai3" && (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
          <h4 className="text-sm font-medium text-gray-900">
            AI3 Daemon Configuration
          </h4>
          <div className="space-y-2">
            <label
              htmlFor="upscale-server-url"
              className="block text-sm text-gray-700"
            >
              Server URL
            </label>
            <div className="flex gap-2">
              <input
                id="upscale-server-url"
                type="url"
                value={upscaleUrl}
                onChange={(e) => setUpscaleUrl(e.target.value)}
                placeholder="http://localhost:3000"
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
              />
              {connectMutation.isPending ? (
                <div className="px-4 py-2 text-sm font-medium text-white bg-gray-400 rounded-lg flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleConnect}
                  disabled={!canConnect}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-hover disabled:bg-gray-300 disabled:cursor-not-allowed rounded-lg transition-colors cursor-pointer"
                >
                  Connect
                </button>
              )}
            </div>
            {upscaleUrl.trim() && !urlIsValid && (
              <p className="text-xs text-red-500">
                Enter a valid URL (e.g., http://localhost:3000)
              </p>
            )}
            {isAi3Connected && (
              <div className="flex items-center gap-1.5 text-green-600">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-sm font-medium">Connected</span>
              </div>
            )}
            <p className="text-xs text-gray-500">
              URL of the AI3 upscale daemon. Supports 2x and 4x upscaling.
            </p>
          </div>
        </div>
      )}

      {openConfigProvider === "stability" && (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
          <h4 className="text-sm font-medium text-gray-900">
            Stability AI Configuration
          </h4>
          <div className="space-y-2">
            <label
              htmlFor="stability-api-key"
              className="block text-sm text-gray-700"
            >
              API Key
            </label>
            <div className="flex gap-2">
              <input
                id="stability-api-key"
                type="password"
                value={stabilityApiKey}
                onChange={(e) => setStabilityApiKey(e.target.value)}
                placeholder="sk-... (optional if server has env key)"
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
              />
              {stabilityConnectMutation.isPending ? (
                <div className="px-4 py-2 text-sm font-medium text-white bg-gray-400 rounded-lg flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleStabilityConnect}
                  disabled={!canConnectStability}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-hover disabled:bg-gray-300 disabled:cursor-not-allowed rounded-lg transition-colors cursor-pointer"
                >
                  Test
                </button>
              )}
            </div>
            {isStabilityConnected && (
              <div className="flex items-center gap-1.5 text-green-600">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-sm font-medium">Ready</span>
              </div>
            )}
            <p className="text-xs text-gray-500">
              Your Stability AI API key. Leave empty to use server environment
              variable. Fast upscale is always 4x.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
