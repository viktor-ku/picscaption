import { useMemo, useState } from "react";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Server,
  Cloud,
  Zap,
  MessageSquare,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  UpscaleClient,
  type CapabilitiesResponse,
} from "../../lib/ai3-upscale-client";
import { StabilityUpscaleClient } from "../../lib/stability-upscale-client";
import { OpenRouterClient } from "../../lib/openrouter-client";
import type { Settings } from "../../lib/settings";

interface IntegrationsSettingsProps {
  settings: Settings;
  onSettingsChange: (settings: Settings) => void;
}

function StatusBadge({
  status,
}: {
  status: "active" | "not-configured" | "checking";
}) {
  if (status === "checking") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-full">
        <Loader2 className="w-3 h-3 animate-spin" />
        Checking...
      </span>
    );
  }

  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-full">
        <CheckCircle2 className="w-3 h-3" />
        Active
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-gray-500 bg-gray-100 rounded-full">
      <XCircle className="w-3 h-3" />
      Not configured
    </span>
  );
}

function CapabilityIcon({ kind }: { kind: string }) {
  if (kind === "upscale") {
    return <Zap className="w-4 h-4 text-amber-500" />;
  }
  return <Cloud className="w-4 h-4 text-blue-500" />;
}

function CapabilitiesTable({
  capabilities,
}: {
  capabilities: CapabilitiesResponse;
}) {
  const upscaleCaps = capabilities.capabilities.filter(
    (c) => c.kind === "upscale",
  );
  const imageCaps = capabilities.capabilities.filter((c) => c.kind === "image");

  return (
    <div className="mt-3 space-y-3">
      {/* Device info */}
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span
          className={`px-1.5 py-0.5 rounded ${
            capabilities.device === "cuda"
              ? "bg-green-100 text-green-700"
              : "bg-yellow-100 text-yellow-700"
          }`}
        >
          {capabilities.device.toUpperCase()}
        </span>
        {capabilities.gpu_memory_gb > 0 && (
          <span>{capabilities.gpu_memory_gb} GB VRAM</span>
        )}
      </div>

      {/* Capabilities list */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Capability
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Model
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Details
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {upscaleCaps.map((cap, i) => (
              <tr key={`upscale-${i}`} className="hover:bg-gray-50">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <CapabilityIcon kind="upscale" />
                    <span className="font-medium text-gray-900">Upscale</span>
                  </div>
                </td>
                <td className="px-3 py-2 text-gray-600">{cap.model}</td>
                <td className="px-3 py-2">
                  <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded">
                    {(cap as { scale: number }).scale}x
                  </span>
                </td>
              </tr>
            ))}
            {imageCaps.map((cap, i) => (
              <tr key={`image-${i}`} className="hover:bg-gray-50">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <CapabilityIcon kind="image" />
                    <span className="font-medium text-gray-900">
                      Image Generation
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2 text-gray-600">{cap.model}</td>
                <td className="px-3 py-2">
                  <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                    text-to-image
                  </span>
                </td>
              </tr>
            ))}
            {capabilities.capabilities.length === 0 && (
              <tr>
                <td
                  colSpan={3}
                  className="px-3 py-4 text-center text-gray-500 italic"
                >
                  No capabilities available (insufficient VRAM)
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function IntegrationsSettings({
  settings,
  onSettingsChange,
}: IntegrationsSettingsProps) {
  const [ai3Url, setAi3Url] = useState(settings.upscaleServerUrl);
  const [isConnecting, setIsConnecting] = useState(false);

  // AI3 client
  const ai3Client = useMemo(() => {
    const url = settings.upscaleServerUrl?.trim();
    if (url) {
      return new UpscaleClient(url);
    }
    return null;
  }, [settings.upscaleServerUrl]);

  // Check AI3 status and get capabilities
  const {
    data: ai3Data,
    isLoading: ai3Loading,
    refetch: refetchAi3,
  } = useQuery({
    queryKey: ["ai3-capabilities", settings.upscaleServerUrl],
    queryFn: async () => {
      if (!ai3Client) return null;
      try {
        await ai3Client.ping();
        const caps = await ai3Client.capabilities();
        return caps;
      } catch {
        return null;
      }
    },
    enabled: Boolean(settings.upscaleServerUrl?.trim()),
    retry: false,
    staleTime: 30000,
  });

  // Stability AI client - uses server's API key
  const stabilityClient = useMemo(() => new StabilityUpscaleClient(), []);

  const { data: stabilityActive, isLoading: stabilityLoading } = useQuery({
    queryKey: ["stability-status"],
    queryFn: () => stabilityClient.ping(),
    retry: false,
    staleTime: 30000,
  });

  // OpenRouter client - uses server's API key
  const openRouterClient = useMemo(() => new OpenRouterClient(), []);

  const { data: openRouterActive, isLoading: openRouterLoading } = useQuery({
    queryKey: ["openrouter-status"],
    queryFn: () => openRouterClient.ping(),
    retry: false,
    staleTime: 30000,
  });

  const handleAi3UrlSave = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const trimmedUrl = ai3Url.trim();

    if (!trimmedUrl) {
      onSettingsChange({ ...settings, upscaleServerUrl: "" });
      return;
    }

    setIsConnecting(true);
    onSettingsChange({ ...settings, upscaleServerUrl: trimmedUrl });

    // Wait a bit for settings to propagate, then refetch
    await new Promise((resolve) => setTimeout(resolve, 100));
    const result = await refetchAi3();

    // Ensure spinner shows for at least 300ms for visual feedback
    setTimeout(() => {
      setIsConnecting(false);
      if (result.data) {
        toast.success("Connected to ai3 server");
      } else {
        toast.error("Server not available");
      }
    }, 200);
  };

  const ai3Status = ai3Loading
    ? "checking"
    : ai3Data
      ? "active"
      : "not-configured";
  const stabilityStatus = stabilityLoading
    ? "checking"
    : stabilityActive
      ? "active"
      : "not-configured";
  const openRouterStatus = openRouterLoading
    ? "checking"
    : openRouterActive
      ? "active"
      : "not-configured";

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600">
        Connect to AI services for upscaling and image generation.
      </p>

      {/* AI3 Local Server */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-lg border border-gray-200">
                <Server className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">ai3 Local Server</h3>
                <p className="text-xs text-gray-500">
                  Self-hosted upscaling & generation
                </p>
              </div>
            </div>
            <StatusBadge status={ai3Status} />
          </div>
        </div>

        <div className="p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Server URL
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={ai3Url}
                onChange={(e) => setAi3Url(e.target.value)}
                placeholder="http://localhost:3001"
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
              />
              <button
                type="button"
                onMouseDownCapture={handleAi3UrlSave}
                disabled={isConnecting}
                className="min-w-[5.5rem] px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isConnecting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Connect"
                )}
              </button>
            </div>
          </div>

          {ai3Data && <CapabilitiesTable capabilities={ai3Data} />}
        </div>
      </div>

      {/* Stability AI */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-lg border border-gray-200">
                <Cloud className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Stability AI</h3>
                <p className="text-xs text-gray-500">
                  Cloud-based 4x upscaling
                </p>
              </div>
            </div>
            <StatusBadge status={stabilityStatus} />
          </div>
        </div>

        <div className="p-4">
          {stabilityActive ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="w-4 h-4" />
                <span>Connected via server API key</span>
              </div>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Capability
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Model
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Details
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="hover:bg-gray-50">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Zap className="w-4 h-4 text-amber-500" />
                          <span className="font-medium text-gray-900">
                            Upscale
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-gray-600">
                        conservative / creative
                      </td>
                      <td className="px-3 py-2">
                        <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded">
                          4x
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              Stability AI integration is managed by the server. Contact support
              if you need access.
            </p>
          )}
        </div>
      </div>

      {/* OpenRouter */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-lg border border-gray-200">
                <MessageSquare className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">OpenRouter</h3>
                <p className="text-xs text-gray-500">
                  Cloud-based AI captioning (GPT-4o, Claude, Gemini)
                </p>
              </div>
            </div>
            <StatusBadge status={openRouterStatus} />
          </div>
        </div>

        <div className="p-4">
          {openRouterActive ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="w-4 h-4" />
                <span>Connected via server API key</span>
              </div>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Capability
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Models
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Details
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="hover:bg-gray-50">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="w-4 h-4 text-purple-500" />
                          <span className="font-medium text-gray-900">
                            Caption
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-gray-600">
                        GPT-4o, Claude 3, Gemini
                      </td>
                      <td className="px-3 py-2">
                        <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded">
                          vision
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              OpenRouter integration is managed by the server. Set
              OPENROUTER_API_KEY in the server environment.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
