import { useMemo } from "react";
import { CheckCircle2, GripVertical, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
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

// Sortable provider item component
interface SortableProviderItemProps {
  provider: UpscaleProviderConfig;
  status: "ready" | "not-configured" | "unavailable";
  onToggleEnabled: (enabled: boolean) => void;
}

function SortableProviderItem({
  provider,
  status,
  onToggleEnabled,
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
      }`}
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
  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Check AI3 server status
  const ai3Client = useMemo(() => {
    const url = settings.upscaleServerUrl?.trim();
    if (url) {
      return new UpscaleClient(url);
    }
    return null;
  }, [settings.upscaleServerUrl]);

  const { data: isAi3Connected } = useQuery({
    queryKey: ["upscale-server-status", settings.upscaleServerUrl],
    queryFn: async () => {
      if (!ai3Client) return false;
      await ai3Client.ping();
      return true;
    },
    enabled: Boolean(settings.upscaleServerUrl?.trim()) && ai3Client !== null,
    retry: false,
  });

  // Check Stability AI status
  const stabilityClient = useMemo(() => new StabilityUpscaleClient(), []);

  const { data: isStabilityConnected } = useQuery({
    queryKey: ["stability-server-status"],
    queryFn: () => stabilityClient.ping(),
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
    return "not-configured";
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
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-sm text-gray-600">
          Drag to set priority order. When upscaling, the first enabled and
          available provider will be used.
        </p>
        <p className="text-xs text-gray-500">
          Configure integrations in the{" "}
          <span className="font-medium">Integrations</span> section.
        </p>
      </div>

      {/* Provider list */}
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
                status={getProviderStatus(provider.id)}
                onToggleEnabled={(enabled) =>
                  handleToggleProvider(provider.id, enabled)
                }
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
