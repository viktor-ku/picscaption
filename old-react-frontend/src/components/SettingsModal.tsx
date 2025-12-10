import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import {
  X,
  Loader2,
  CheckCircle2,
  Settings as SettingsIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UpscaleClient } from "../lib/ai3-upscale-client";
import type { Settings } from "../lib/settings";
import { Toggle } from "./Toggle";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
  onSettingsChange: (settings: Settings) => void;
}

type Section = "general";

const SECTIONS: { id: Section; label: string }[] = [
  { id: "general", label: "General" },
];

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

export function SettingsModal({
  isOpen,
  onClose,
  settings,
  onSettingsChange,
}: SettingsModalProps) {
  const [activeSection, setActiveSection] = useState<Section>("general");
  const [upscaleUrl, setUpscaleUrl] = useState(settings.upscaleServerUrl);
  const queryClient = useQueryClient();

  // Sync local state when settings change externally
  useEffect(() => {
    setUpscaleUrl(settings.upscaleServerUrl);
  }, [settings.upscaleServerUrl]);

  // Memoized URL validation
  const urlIsValid = useMemo(() => isValidUrl(upscaleUrl), [upscaleUrl]);

  // Mutation for connecting to upscale server
  const connectMutation = useMutation({
    mutationFn: async (url: string) => {
      const client = new UpscaleClient(url);
      return client.ping();
    },
    onSuccess: () => {
      const trimmedUrl = upscaleUrl.trim();
      onSettingsChange({ ...settings, upscaleServerUrl: trimmedUrl });
      // Invalidate any server status queries so they re-fetch
      queryClient.invalidateQueries({ queryKey: ["upscale-server-status"] });
      toast.success("Connected to upscaling server");
    },
    onError: () => {
      toast.error("Server unavailable");
    },
  });

  // Check if we're currently connected to the upscale server
  const hasConfiguredUrl = Boolean(settings.upscaleServerUrl?.trim());
  const upscaleClient = useMemo(() => {
    const url = settings.upscaleServerUrl?.trim();
    if (url) {
      return new UpscaleClient(url);
    }
    return null;
  }, [settings.upscaleServerUrl]);

  const { data: isConnected } = useQuery({
    queryKey: ["upscale-server-status", settings.upscaleServerUrl],
    queryFn: async () => {
      if (!upscaleClient) return false;
      await upscaleClient.ping();
      return true;
    },
    enabled: hasConfiguredUrl && upscaleClient !== null,
    retry: false,
  });

  const canConnect = urlIsValid && !connectMutation.isPending;

  const handleConnect = () => {
    if (!canConnect) return;
    connectMutation.mutate(upscaleUrl.trim());
  };

  const handleAllowDeletionsChange = (checked: boolean) => {
    onSettingsChange({ ...settings, allowDeletions: checked });
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      {/* Backdrop */}
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-200 ease-out data-[closed]:opacity-0"
      />

      {/* Modal container - centered */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel
          transition
          className="w-full lg:w-1/2 h-[80vh] bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden transition duration-200 ease-out data-[closed]:opacity-0 data-[closed]:scale-95"
        >
          <div className="flex h-full">
            {/* Sidebar */}
            <nav className="w-48 shrink-0 bg-gray-50 border-r border-gray-200 p-4">
              <div className="flex items-center gap-2 px-3 py-2 mb-4">
                <SettingsIcon className="w-5 h-5 text-gray-600" />
                <span className="font-semibold text-gray-900">Settings</span>
              </div>
              <ul className="space-y-1">
                {SECTIONS.map((section) => (
                  <li key={section.id}>
                    <button
                      type="button"
                      onClick={() => setActiveSection(section.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                        activeSection === section.id
                          ? "bg-primary text-white"
                          : "text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {section.label}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>

            {/* Content area */}
            <div className="flex-1 flex flex-col min-w-0">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <DialogTitle className="text-lg font-semibold text-gray-900">
                  {SECTIONS.find((s) => s.id === activeSection)?.label}
                </DialogTitle>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {activeSection === "general" && (
                  <>
                    {/* Upscaling Server URL */}
                    <div className="space-y-3">
                      <label
                        htmlFor="upscale-server-url"
                        className="block text-sm font-medium text-gray-900"
                      >
                        Upscaling Server URL
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
                      {isConnected && (
                        <div className="flex items-center gap-1.5 text-green-600">
                          <CheckCircle2 className="w-4 h-4" />
                          <span className="text-sm font-medium">Connected</span>
                        </div>
                      )}
                      <p className="text-xs text-gray-500">
                        URL of the AI3 upscale daemon for image upscaling
                      </p>
                    </div>

                    {/* Allow Deletions */}
                    <div className="space-y-3">
                      <span className="block text-sm font-medium text-gray-900">
                        Allow Deletions
                      </span>
                      <Toggle
                        checked={settings.allowDeletions}
                        onChange={handleAllowDeletionsChange}
                        label={
                          settings.allowDeletions ? "Allowed" : "Disallowed"
                        }
                      />
                      <p className="text-xs text-gray-500">
                        When disabled, the delete key and button will be
                        inactive
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
