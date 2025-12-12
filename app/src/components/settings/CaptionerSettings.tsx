import { useMemo } from "react";
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
import {
  GripVertical,
  Server,
  Cloud,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  type Settings,
  type CaptionModelId,
  CAPTION_MODEL_INFO,
  DEFAULT_CAPTION_MODEL_PRIORITY,
} from "../../lib/settings";
import {
  UpscaleClient,
  getCaptionCapabilities,
} from "../../lib/ai3-upscale-client";
import { OpenRouterClient } from "../../lib/openrouter-client";

interface CaptionerSettingsProps {
  settings: Settings;
  onSettingsChange: (settings: Settings) => void;
}

interface SortableItemProps {
  id: CaptionModelId;
  isAvailable: boolean;
}

function SortableItem({ id, isAvailable }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const info = CAPTION_MODEL_INFO[id];
  const isLocal = info.provider === "ai3";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 px-3 py-2.5 bg-white border rounded-lg ${
        isDragging ? "shadow-lg border-primary z-10" : "border-gray-200"
      } ${!isAvailable ? "opacity-50" : ""}`}
    >
      <button
        type="button"
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-4 h-4" />
      </button>

      <div className="flex items-center gap-2 flex-1 min-w-0">
        {isLocal ? (
          <Server className="w-4 h-4 text-gray-500 flex-shrink-0" />
        ) : (
          <Cloud className="w-4 h-4 text-purple-500 flex-shrink-0" />
        )}
        <div className="min-w-0">
          <div className="font-medium text-gray-900 text-sm truncate">
            {info.name}
          </div>
          <div className="text-xs text-gray-500 truncate">
            {info.description}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <span
          className={`px-2 py-0.5 text-xs font-medium rounded ${
            isLocal
              ? "bg-gray-100 text-gray-600"
              : "bg-purple-100 text-purple-700"
          }`}
        >
          {isLocal ? "local" : "cloud"}
        </span>
        {isAvailable ? (
          <CheckCircle2 className="w-4 h-4 text-green-500" />
        ) : (
          <XCircle className="w-4 h-4 text-gray-300" />
        )}
      </div>
    </div>
  );
}

export function CaptionerSettings({
  settings,
  onSettingsChange,
}: CaptionerSettingsProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Get the priority list, falling back to defaults
  const priority =
    settings.captionModelPriority ?? DEFAULT_CAPTION_MODEL_PRIORITY;

  // Check ai3 capabilities
  const ai3Client = useMemo(() => {
    const url = settings.upscaleServerUrl?.trim();
    if (url) {
      return new UpscaleClient(url);
    }
    return null;
  }, [settings.upscaleServerUrl]);

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
  const openRouterClient = useMemo(() => new OpenRouterClient(), []);

  const { data: openRouterActive } = useQuery({
    queryKey: ["openrouter-status"],
    queryFn: () => openRouterClient.ping(),
    retry: false,
    staleTime: 30000,
  });

  // Determine which models are available dynamically from CAPTION_MODEL_INFO
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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = priority.indexOf(active.id as CaptionModelId);
      const newIndex = priority.indexOf(over.id as CaptionModelId);

      const newPriority = arrayMove(priority, oldIndex, newIndex);
      onSettingsChange({
        ...settings,
        captionModelPriority: newPriority,
      });
    }
  };

  const firstAvailable = priority.find((id) => availableModels.has(id));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-gray-600">
          Configure the priority order for AI caption generation. Drag to
          reorder. The first available model will be used when generating
          captions.
        </p>
      </div>

      {firstAvailable && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle2 className="w-4 h-4 text-green-600" />
          <span className="text-sm text-green-700">
            Active model:{" "}
            <span className="font-medium">
              {CAPTION_MODEL_INFO[firstAvailable].name}
            </span>
          </span>
        </div>
      )}

      {!firstAvailable && (
        <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <XCircle className="w-4 h-4 text-yellow-600" />
          <span className="text-sm text-yellow-700">
            No caption models available. Connect to ai3 or configure OpenRouter
            in Integrations.
          </span>
        </div>
      )}

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Model Priority
        </label>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={priority}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {priority.map((id) => (
                <SortableItem
                  key={id}
                  id={id}
                  isAvailable={availableModels.has(id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      <div className="text-xs text-gray-500 space-y-1">
        <p>
          <Server className="w-3 h-3 inline mr-1" />
          <strong>Local</strong> models run on your ai3 server (requires GPU)
        </p>
        <p>
          <Cloud className="w-3 h-3 inline mr-1" />
          <strong>Cloud</strong> models use OpenRouter API (requires API key)
        </p>
      </div>
    </div>
  );
}
