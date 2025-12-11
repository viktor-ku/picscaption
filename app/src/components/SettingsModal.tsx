import { useState, useEffect } from "react";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { X, Settings as SettingsIcon } from "lucide-react";
import type { Settings } from "../lib/settings";
import {
  GeneralSettings,
  UpscaleSettings,
  ProfileSettings,
  MetaFieldsSettings,
} from "./settings";
import type { Id } from "../../convex/_generated/dataModel";

export type SettingsSection = "general" | "upscale" | "meta" | "profile";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
  onSettingsChange: (settings: Settings) => void;
  onDeleteAllData: () => void;
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
  userId: Id<"users"> | null;
}

const SECTIONS: { id: SettingsSection; label: string }[] = [
  { id: "general", label: "General" },
  { id: "upscale", label: "Upscale" },
  { id: "meta", label: "Metaobjects" },
  { id: "profile", label: "Profile" },
];

export function SettingsModal({
  isOpen,
  onClose,
  settings,
  onSettingsChange,
  onDeleteAllData,
  activeSection,
  onSectionChange,
  userId,
}: SettingsModalProps) {
  const [profileName, setProfileName] = useState(settings.profileName);
  const [profileEmail, setProfileEmail] = useState(settings.profileEmail);

  // Sync local state when settings change externally
  useEffect(() => {
    setProfileName(settings.profileName);
  }, [settings.profileName]);

  useEffect(() => {
    setProfileEmail(settings.profileEmail);
  }, [settings.profileEmail]);

  const handleAllowDeletionsChange = (checked: boolean) => {
    onSettingsChange({ ...settings, allowDeletions: checked });
  };

  const handleProfileNameChange = (value: string) => {
    setProfileName(value);
    onSettingsChange({ ...settings, profileName: value });
  };

  const handleProfileEmailChange = (value: string) => {
    setProfileEmail(value);
    onSettingsChange({ ...settings, profileEmail: value });
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      {/* Backdrop */}
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-200 ease-out data-[closed]:opacity-0"
      />

      {/* Modal container - centered */}
      <div className="fixed inset-0 flex items-center justify-center p-2 sm:p-4">
        <DialogPanel
          transition
          className="w-full md:w-4/5 lg:w-3/5 xl:w-1/2 h-[80vh] bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden transition duration-200 ease-out data-[closed]:opacity-0 data-[closed]:scale-95"
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
                      onMouseDownCapture={() => onSectionChange(section.id)}
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
                  {(() => {
                    const idx = SECTIONS.findIndex(
                      (s) => s.id === activeSection,
                    );
                    return idx !== -1 ? SECTIONS[idx].label : "";
                  })()}
                </DialogTitle>
                <button
                  type="button"
                  onMouseDownCapture={onClose}
                  className="p-1 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {activeSection === "general" && (
                  <GeneralSettings
                    settings={settings}
                    onAllowDeletionsChange={handleAllowDeletionsChange}
                  />
                )}

                {activeSection === "upscale" && (
                  <UpscaleSettings
                    settings={settings}
                    onSettingsChange={onSettingsChange}
                  />
                )}

                {activeSection === "meta" && (
                  <MetaFieldsSettings userId={userId} />
                )}

                {activeSection === "profile" && (
                  <ProfileSettings
                    profileName={profileName}
                    profileEmail={profileEmail}
                    onProfileNameChange={handleProfileNameChange}
                    onProfileEmailChange={handleProfileEmailChange}
                    onDeleteAllData={onDeleteAllData}
                  />
                )}
              </div>
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
