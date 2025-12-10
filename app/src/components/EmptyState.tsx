import { FolderUp } from "lucide-react";

interface EmptyStateProps {
  onSelectFolder: () => void;
}

export function EmptyState({ onSelectFolder }: EmptyStateProps) {
  return (
    <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-rose-50/30">
      <div className="flex flex-col items-center text-center max-w-md px-6">
        {/* Upload icon with decorative background */}
        <button
          type="button"
          onMouseDownCapture={onSelectFolder}
          className="relative mb-8 cursor-pointer group"
        >
          <div className="absolute inset-0 bg-primary/10 rounded-full blur-2xl scale-150 group-hover:bg-primary/15 transition-colors" />
          <div className="relative w-24 h-24 bg-gradient-to-br from-primary-light to-white rounded-2xl flex items-center justify-center shadow-lg ring-1 ring-primary/10 group-hover:shadow-xl group-hover:scale-105 transition-all">
            <FolderUp className="w-12 h-12 text-primary" strokeWidth={1.5} />
          </div>
        </button>

        {/* Title */}
        <h2 className="text-2xl font-semibold text-gray-900 mb-3">
          Add captions to your images
        </h2>

        {/* Description */}
        <p className="text-gray-500 mb-8 leading-relaxed">
          Select a folder with images to start captioning. Your progress is
          automatically saved and restored when you reopen the same images.
        </p>

        {/* Action button */}
        <button
          type="button"
          onMouseDownCapture={onSelectFolder}
          className="flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium text-white bg-primary rounded-xl hover:bg-primary-hover transition-colors cursor-pointer shadow-md hover:shadow-lg"
        >
          <FolderUp className="w-5 h-5" />
          Select Folder
        </button>
      </div>
    </div>
  );
}
