import { createContext, useContext, type ReactNode } from "react";
import { ConvexProvider, ConvexReactClient } from "convex/react";

// Convex URL from environment variable
// Try PUBLIC_ prefix (Astro convention) or VITE_ prefix
const convexUrl =
  import.meta.env.PUBLIC_CONVEX_URL ?? import.meta.env.VITE_CONVEX_URL;

// Only create client if URL is available
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

// Context to check if Convex is available
const ConvexAvailableContext = createContext(false);

export function useConvexAvailable(): boolean {
  return useContext(ConvexAvailableContext);
}

interface ConvexClientProviderProps {
  children: ReactNode;
}

export function ConvexClientProvider({ children }: ConvexClientProviderProps) {
  if (!convex) {
    // Render children without Convex if URL not configured
    // This allows the app to work without Convex during development
    console.warn(
      "Convex URL not configured. Set PUBLIC_CONVEX_URL in .env.local",
    );
    return (
      <ConvexAvailableContext.Provider value={false}>
        {children}
      </ConvexAvailableContext.Provider>
    );
  }
  return (
    <ConvexAvailableContext.Provider value={true}>
      <ConvexProvider client={convex}>{children}</ConvexProvider>
    </ConvexAvailableContext.Provider>
  );
}
