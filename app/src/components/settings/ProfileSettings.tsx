import { Trash2, UserX } from "lucide-react";
import toast from "react-hot-toast";

interface ProfileSettingsProps {
  profileName: string;
  profileEmail: string;
  onProfileNameChange: (value: string) => void;
  onProfileEmailChange: (value: string) => void;
  onDeleteAllData: () => void;
}

export function ProfileSettings({
  profileName,
  profileEmail,
  onProfileNameChange,
  onProfileEmailChange,
  onDeleteAllData,
}: ProfileSettingsProps) {
  const handleDeleteAccount = () => {
    toast.success("Account deletion is not yet implemented");
  };

  return (
    <>
      {/* Personal Info */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
          Personal Info
        </h3>

        {/* Name */}
        <div className="space-y-2">
          <label
            htmlFor="profile-name"
            className="block text-sm font-medium text-gray-700"
          >
            Name
          </label>
          <input
            id="profile-name"
            type="text"
            value={profileName}
            onChange={(e) => onProfileNameChange(e.target.value)}
            placeholder="Enter your name (optional)"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
          />
        </div>

        {/* Email */}
        <div className="space-y-2">
          <label
            htmlFor="profile-email"
            className="block text-sm font-medium text-gray-700"
          >
            Email
          </label>
          <input
            id="profile-email"
            type="email"
            value={profileEmail}
            onChange={(e) => onProfileEmailChange(e.target.value)}
            placeholder="Enter your email (optional)"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
          />
        </div>
      </div>

      {/* Danger Zone */}
      <div className="space-y-4 pt-4 border-t border-gray-200">
        <h3 className="text-sm font-semibold text-red-600 uppercase tracking-wide">
          Danger Zone
        </h3>

        {/* Delete All Data */}
        <div className="flex items-center justify-between p-4 border border-red-200 rounded-lg bg-red-50/50">
          <div>
            <p className="text-sm font-medium text-gray-900">Delete All Data</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Remove all saved captions and settings permanently
            </p>
          </div>
          <button
            type="button"
            onClick={onDeleteAllData}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            Delete All Data
          </button>
        </div>

        {/* Delete Account */}
        <div className="flex items-center justify-between p-4 border border-red-200 rounded-lg bg-red-50/50">
          <div>
            <p className="text-sm font-medium text-gray-900">Delete Account</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Permanently delete your account and all associated data
            </p>
          </div>
          <button
            type="button"
            onClick={handleDeleteAccount}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors cursor-pointer"
          >
            <UserX className="w-4 h-4" />
            Delete Account
          </button>
        </div>
      </div>
    </>
  );
}
