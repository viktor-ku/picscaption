import { Sparkles, ArrowRightLeft, Crop as CropIcon } from "lucide-react";
import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import type { UpscaleState } from "../hooks";

interface ImageActionBarProps {
  hasAnyEnabledProvider: boolean;
  isAnyProviderAvailable: boolean;
  availableScales: (2 | 4)[];
  canUpscale: boolean;
  upscaleState: UpscaleState;
  customWidth: string;
  customHeight: string;
  widthInputRef: React.RefObject<HTMLInputElement | null>;
  onCustomWidthChange: (value: string) => void;
  onCustomHeightChange: (value: string) => void;
  onUpscale: (scale: 2 | 4) => void;
  onCustomResize: (width: number, height: number, close: () => void) => void;
  // Crop props
  hasFullImage: boolean;
  hasPendingCrop?: boolean;
  cropMode: "idle" | "cropping";
  onStartCrop: (aspect: number | undefined) => void;
  onCancelCrop?: () => void;
}

export function ImageActionBar({
  hasAnyEnabledProvider,
  isAnyProviderAvailable,
  availableScales,
  canUpscale,
  upscaleState,
  customWidth,
  customHeight,
  widthInputRef,
  onCustomWidthChange,
  onCustomHeightChange,
  onUpscale,
  onCustomResize,
  hasFullImage,
  hasPendingCrop,
  cropMode,
  onStartCrop,
  onCancelCrop,
}: ImageActionBarProps) {
  return (
    <div className="flex-shrink-0 flex items-center justify-center py-2 px-4">
      {/* Upscale section */}
      {hasAnyEnabledProvider && (
        <div className="group relative flex items-center gap-2">
          <div
            className={`flex items-center gap-1.5 text-sm font-medium ${
              availableScales.length > 0 ? "text-white/80" : "text-white/30"
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Upscale</span>
          </div>

          {availableScales.length > 0 && (
            <div className="flex gap-1.5 ml-1">
              {availableScales
                .sort((a, b) => a - b)
                .map((scale) => (
                  <button
                    key={scale}
                    type="button"
                    onClick={() => onUpscale(scale)}
                    disabled={!canUpscale}
                    className={`
                      px-2.5 py-1 rounded-md text-xs font-semibold
                      transition-all
                      ${
                        canUpscale
                          ? "bg-white/15 hover:bg-white/25 text-white cursor-pointer"
                          : "bg-white/5 text-white/30 cursor-not-allowed"
                      }
                    `}
                  >
                    {scale}x
                  </button>
                ))}

              <Popover className="relative">
                {({ close }) => (
                  <>
                    <PopoverButton
                      disabled={upscaleState !== "idle"}
                      onClick={() => {
                        setTimeout(() => widthInputRef.current?.focus(), 0);
                      }}
                      className={`
                        px-2.5 py-1 rounded-md text-xs font-semibold
                        transition-all
                        ${
                          upscaleState === "idle"
                            ? "bg-white/15 hover:bg-white/25 text-white cursor-pointer"
                            : "bg-white/5 text-white/30 cursor-not-allowed"
                        }
                      `}
                    >
                      Custom
                    </PopoverButton>

                    <PopoverPanel
                      transition
                      anchor="bottom"
                      className="absolute z-50 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg p-4 origin-top transition duration-100 ease-out data-[closed]:scale-95 data-[closed]:opacity-0"
                    >
                      <div className="text-sm font-medium text-gray-700 mb-3">
                        Custom size
                      </div>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const w = Number.parseInt(customWidth, 10);
                          const h = Number.parseInt(customHeight, 10);
                          if (w > 0 && h > 0) {
                            localStorage.setItem(
                              "picscaption-custom-width",
                              customWidth,
                            );
                            localStorage.setItem(
                              "picscaption-custom-height",
                              customHeight,
                            );
                            onCustomResize(w, h, close);
                          }
                        }}
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <label className="flex-1">
                            <span className="block text-xs text-gray-500 mb-1">
                              Width
                            </span>
                            <input
                              ref={widthInputRef}
                              type="number"
                              value={customWidth}
                              onChange={(e) =>
                                onCustomWidthChange(e.target.value)
                              }
                              placeholder="px"
                              min={1}
                              className="w-full px-2 py-1.5 bg-white border border-gray-300 rounded text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                            />
                          </label>
                          <label className="flex-1">
                            <span className="block text-xs text-gray-500 mb-1">
                              Height
                            </span>
                            <input
                              type="number"
                              value={customHeight}
                              onChange={(e) =>
                                onCustomHeightChange(e.target.value)
                              }
                              placeholder="px"
                              min={1}
                              className="w-full px-2 py-1.5 bg-white border border-gray-300 rounded text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                            />
                          </label>
                        </div>
                        <button
                          type="submit"
                          disabled={
                            !customWidth ||
                            !customHeight ||
                            Number.parseInt(customWidth, 10) <= 0 ||
                            Number.parseInt(customHeight, 10) <= 0
                          }
                          className="w-full py-2 flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
                        >
                          <ArrowRightLeft className="w-4 h-4" />
                          Apply
                        </button>
                      </form>
                    </PopoverPanel>
                  </>
                )}
              </Popover>
            </div>
          )}

          {!isAnyProviderAvailable && (
            <div
              className="
                absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-2 
                bg-gray-900 text-white text-xs rounded-lg
                opacity-0 group-hover:opacity-100 transition-opacity
                whitespace-nowrap pointer-events-none
                shadow-lg z-10
              "
            >
              Upscale server unavailable
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45" />
            </div>
          )}
        </div>
      )}

      {hasAnyEnabledProvider && <div className="w-px h-6 bg-white/20 mx-3" />}

      {/* Crop section */}
      <div className="flex items-center gap-2">
        <div
          className={`flex items-center gap-1.5 text-sm font-medium ${
            hasPendingCrop ? "text-primary" : "text-white/80"
          }`}
        >
          <CropIcon className="w-4 h-4" />
          <span>Crop</span>
        </div>

        {hasPendingCrop ? (
          <button
            type="button"
            onClick={onCancelCrop}
            className="px-2.5 py-1 rounded-md text-xs font-semibold bg-white/15 hover:bg-white/25 text-white cursor-pointer transition-all"
          >
            Cancel
          </button>
        ) : (
          <div className="flex gap-1.5 ml-1">
            <button
              type="button"
              onClick={() => onStartCrop(1)}
              disabled={
                cropMode === "cropping" ||
                upscaleState !== "idle" ||
                !hasFullImage
              }
              className={`
                px-2.5 py-1 rounded-md text-xs font-semibold
                transition-all
                ${
                  cropMode === "idle" && upscaleState === "idle" && hasFullImage
                    ? "bg-white/15 hover:bg-white/25 text-white cursor-pointer"
                    : "bg-white/5 text-white/30 cursor-not-allowed"
                }
              `}
            >
              1:1
            </button>
            <button
              type="button"
              onClick={() => onStartCrop(undefined)}
              disabled={
                cropMode === "cropping" ||
                upscaleState !== "idle" ||
                !hasFullImage
              }
              className={`
                px-2.5 py-1 rounded-md text-xs font-semibold
                transition-all
                ${
                  cropMode === "idle" && upscaleState === "idle" && hasFullImage
                    ? "bg-white/15 hover:bg-white/25 text-white cursor-pointer"
                    : "bg-white/5 text-white/30 cursor-not-allowed"
                }
              `}
            >
              Free
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
