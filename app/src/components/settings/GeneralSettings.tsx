import type { Settings } from "../../lib/settings";
import { Toggle } from "../Toggle";

interface GeneralSettingsProps {
  settings: Settings;
  onAllowDeletionsChange: (checked: boolean) => void;
}

export function GeneralSettings({
  settings,
  onAllowDeletionsChange,
}: GeneralSettingsProps) {
  return (
    <div className="space-y-3">
      <span className="block text-sm font-medium text-gray-900">
        Allow Deletions
      </span>
      <Toggle
        checked={settings.allowDeletions}
        onChange={onAllowDeletionsChange}
        label={settings.allowDeletions ? "Allowed" : "Disallowed"}
      />
      <p className="text-xs text-gray-500">
        When disabled, the delete key and button will be inactive
      </p>
    </div>
  );
}
