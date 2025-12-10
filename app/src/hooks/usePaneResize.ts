import { useState, useEffect, useCallback, useRef } from "react";

const MIN_PANE_WIDTH = 280; // Minimum width in pixels for left pane
const MAX_PANE_PERCENT = 70; // Maximum percentage for left pane

export interface UsePaneResizeReturn {
  leftPaneWidth: number;
  isDragging: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  handleResizeStart: (e: React.MouseEvent) => void;
  setLeftPaneWidth: React.Dispatch<React.SetStateAction<number>>;
  MIN_PANE_WIDTH: number;
  MAX_PANE_PERCENT: number;
}

/**
 * Hook for managing resizable pane layout.
 */
export function usePaneResize(): UsePaneResizeReturn {
  const [leftPaneWidth, setLeftPaneWidth] = useState(33.33); // percentage
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    document.body.classList.add("resizing");
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const containerWidth = containerRect.width;
      const newX = e.clientX - containerRect.left;

      // Calculate percentage, respecting min/max constraints
      let newPercent = (newX / containerWidth) * 100;

      // Apply minimum width constraint
      const minPercent = (MIN_PANE_WIDTH / containerWidth) * 100;
      newPercent = Math.max(minPercent, newPercent);
      newPercent = Math.min(MAX_PANE_PERCENT, newPercent);

      setLeftPaneWidth(newPercent);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.classList.remove("resizing");
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.classList.remove("resizing");
    };
  }, [isDragging]);

  return {
    leftPaneWidth,
    isDragging,
    containerRef,
    handleResizeStart,
    setLeftPaneWidth,
    MIN_PANE_WIDTH,
    MAX_PANE_PERCENT,
  };
}
