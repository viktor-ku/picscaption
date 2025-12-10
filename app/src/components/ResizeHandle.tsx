interface ResizeHandleProps {
  onMouseDown: (e: React.MouseEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

export function ResizeHandle({ onMouseDown, onKeyDown }: ResizeHandleProps) {
  return (
    <button
      type="button"
      aria-label="Resize panels"
      className="resize-handle group relative w-1 shrink-0 cursor-col-resize bg-gray-200 hover:bg-primary focus:bg-primary focus:outline-none transition-colors"
      onMouseDown={onMouseDown}
      onKeyDown={onKeyDown}
    >
      <span className="absolute inset-y-0 -left-1 -right-1 group-hover:bg-primary/10 group-focus:bg-primary/10" />
      <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity">
        <span className="w-1 h-1 rounded-full bg-primary" />
        <span className="w-1 h-1 rounded-full bg-primary" />
        <span className="w-1 h-1 rounded-full bg-primary" />
      </span>
    </button>
  );
}
