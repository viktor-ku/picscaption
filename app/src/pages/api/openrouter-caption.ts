import type { APIRoute } from "astro";
import { OpenRouter } from "@openrouter/sdk";
import { OPENROUTER_MODEL_IDS } from "../../lib/settings";

export const prerender = false;

const CAPTION_PROMPT = `Describe this image concisely but thoroughly. Focus on the main subjects, their actions, setting, colors, and mood. Write a single paragraph caption suitable for image training datasets.`;

export const POST: APIRoute = async ({ request }) => {
  // Get API key from env var
  const apiKey = import.meta.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error: "No OpenRouter API key configured",
        detail: "Set OPENROUTER_API_KEY environment variable",
      }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  try {
    // Parse the incoming form data
    const formData = await request.formData();
    const image = formData.get("image");
    const model = formData.get("model") as string | null;
    const systemPrompt = formData.get("systemPrompt") as string | null;

    if (!image || typeof image === "string") {
      return new Response(
        JSON.stringify({
          error: "Missing image",
          detail: "image field is required",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    if (!model) {
      return new Response(
        JSON.stringify({
          error: "Missing model",
          detail: "model field is required",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Validate model is supported
    if (!OPENROUTER_MODEL_IDS.includes(model)) {
      return new Response(
        JSON.stringify({
          error: "Unsupported model",
          detail: `Model "${model}" is not supported. Supported: ${OPENROUTER_MODEL_IDS.join(", ")}`,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Convert image to base64 data URL
    const arrayBuffer = await image.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const mimeType = image.type || "image/png";
    const dataUrl = `data:${mimeType};base64,${base64}`;

    // Initialize OpenRouter SDK
    const openRouter = new OpenRouter({
      apiKey,
      appName: "PicsCaption",
      appUrl: "https://picscaption.app",
    });

    // Use custom system prompt if provided, otherwise use default
    const promptText = systemPrompt?.trim() || CAPTION_PROMPT;

    console.log("[OpenRouter API] Using system prompt:", promptText);

    // Call OpenRouter API using SDK with proper system message
    const response = await openRouter.chat.send({
      model,
      max_tokens: 500,
      messages: [
        {
          role: "system",
          content: promptText,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Please analyze this image and provide a caption according to your instructions.",
            },
            { type: "image_url", imageUrl: { url: dataUrl } },
          ],
        },
      ],
    });

    const caption = response.choices?.[0]?.message?.content?.trim() || "";

    return new Response(JSON.stringify({ caption, model }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    // Log full error to console for debugging
    console.error("[OpenRouter API] Caption generation failed:", err);

    // Extract error details
    let message = "Unknown error";
    let status = 500;
    let errorResponse: Record<string, unknown> | null = null;

    if (err instanceof Error) {
      message = err.message;

      // Check for OpenRouter SDK error properties
      const errWithDetails = err as Error & {
        status?: number;
        statusCode?: number;
        code?: string;
        response?: unknown;
        data?: unknown;
        body?: unknown;
      };

      // Try to get HTTP status from various possible properties
      if (errWithDetails.status) {
        status = errWithDetails.status;
      } else if (errWithDetails.statusCode) {
        status = errWithDetails.statusCode;
      }

      // Try to capture the full error response body
      if (errWithDetails.response) {
        errorResponse = { response: errWithDetails.response };
      }
      if (errWithDetails.data) {
        errorResponse = { ...errorResponse, data: errWithDetails.data };
      }
      if (errWithDetails.body) {
        errorResponse = { ...errorResponse, body: errWithDetails.body };
      }
      if (errWithDetails.code) {
        errorResponse = { ...errorResponse, code: errWithDetails.code };
      }
    }

    // Log structured error info
    console.error("[OpenRouter API] Error details:", {
      message,
      status,
      errorResponse,
      stack: err instanceof Error ? err.stack : undefined,
    });

    return new Response(
      JSON.stringify({
        error: "Caption failed",
        detail: message,
        status,
        ...(errorResponse && { errorResponse }),
      }),
      {
        status,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};

// Health check endpoint - verify API key is configured
export const GET: APIRoute = async () => {
  const apiKey = import.meta.env.OPENROUTER_API_KEY;

  return new Response(
    JSON.stringify({
      status: "ok",
      hasEnvKey: Boolean(apiKey),
      ready: Boolean(apiKey),
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
};
