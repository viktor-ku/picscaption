import { Tab, TabGroup, TabList, TabPanel, TabPanels } from "@headlessui/react";
import { FileImage } from "lucide-react";
import type { ImageData } from "../types";
import type { Id } from "../../convex/_generated/dataModel";
import { CaptionsTab } from "./CaptionsTab";
import { TagInput } from "./TagInput";

interface CaptionFormProps {
  selectedImage: ImageData | null;
  currentIndex: number;
  totalImages: number;
  onCaptionChange: (caption: string) => void;
  onTagsChange: (tags: string[]) => void;
  userId: Id<"users"> | null;
}

export function CaptionForm({
  selectedImage,
  currentIndex,
  totalImages,
  onCaptionChange,
  onTagsChange,
  userId,
}: CaptionFormProps) {
  if (!selectedImage) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <FileImage className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-lg font-medium text-gray-700 mb-2">
          No folder selected
        </h2>
        <p className="text-sm text-gray-500 max-w-xs">
          Click "Select Folder" to choose a folder with images you'd like to
          caption.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <TabGroup className="flex flex-col h-full">
        <TabList className="flex gap-1 p-2 border-b border-gray-200 bg-gray-50">
          <Tab className="px-4 py-2 text-sm font-medium rounded-lg transition-colors data-[selected]:bg-white data-[selected]:text-primary data-[selected]:shadow-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 focus:outline-none">
            General
          </Tab>
          <Tab className="px-4 py-2 text-sm font-medium rounded-lg transition-colors data-[selected]:bg-white data-[selected]:text-primary data-[selected]:shadow-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 focus:outline-none">
            Captions
          </Tab>
        </TabList>

        <TabPanels className="flex-1 overflow-hidden">
          {/* General Tab - existing content */}
          <TabPanel className="h-full overflow-auto">
            <div className="flex flex-col h-full p-6">
              <div className="space-y-4 flex-1">
                <div>
                  <span className="block text-sm font-medium text-gray-700 mb-1">
                    Filename
                  </span>
                  <div className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-600 truncate">
                    {selectedImage.fileName}
                  </div>
                </div>

                <div>
                  <span className="block text-sm font-medium text-gray-700 mb-1">
                    Namespace
                  </span>
                  <div className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-600 truncate">
                    {selectedImage.namespace}
                  </div>
                </div>

                <div>
                  <span className="block text-sm font-medium text-gray-700 mb-1">
                    Original Size
                  </span>
                  <div className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-600">
                    {selectedImage.width && selectedImage.height
                      ? `${selectedImage.width}px × ${selectedImage.height}px`
                      : "Loading..."}
                  </div>
                </div>

                <div className="flex-1 flex flex-col">
                  <label
                    htmlFor="caption"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Caption
                  </label>
                  <textarea
                    id="caption"
                    value={selectedImage.caption}
                    onChange={(e) => onCaptionChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        e.currentTarget.blur();
                      }
                    }}
                    placeholder="Enter a caption for this image..."
                    className="flex-1 min-h-32 px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                <div>
                  <span className="block text-sm font-medium text-gray-700 mb-1">
                    Tags
                  </span>
                  <TagInput
                    tags={selectedImage.tags}
                    onTagsChange={onTagsChange}
                    userId={userId}
                    placeholder="Add tag..."
                  />
                </div>
              </div>

              <div className="mt-6">
                <span className="text-sm text-gray-500">
                  Image {currentIndex + 1} of {totalImages}
                </span>
              </div>
            </div>
          </TabPanel>

          {/* Captions Tab - advanced workflow */}
          <TabPanel className="h-full overflow-auto">
            <CaptionsTab
              selectedImage={selectedImage}
              onCaptionChange={onCaptionChange}
            />
          </TabPanel>
        </TabPanels>
      </TabGroup>
    </div>
  );
}
