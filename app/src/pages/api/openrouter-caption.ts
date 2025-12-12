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

    // Call OpenRouter API using SDK
    const response = await openRouter.chat.send({
      model,
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: CAPTION_PROMPT },
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
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Caption failed", detail: message }),
      {
        status: 500,
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
