import type { APIRoute } from "astro";

const STABILITY_API_URL =
  "https://api.stability.ai/v2beta/stable-image/upscale/fast";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  // Get API key from env var, or fallback to header
  const envApiKey = import.meta.env.STABILITY_API_KEY;
  const headerApiKey = request.headers.get("X-Stability-Key");
  const apiKey = envApiKey || headerApiKey;

  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error: "No Stability API key configured",
        detail:
          "Set STABILITY_API_KEY environment variable or provide X-Stability-Key header",
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

    // Build form data for Stability AI
    const stabilityFormData = new FormData();
    stabilityFormData.append("image", image);
    stabilityFormData.append("output_format", "png");

    // Call Stability AI API
    const response = await fetch(STABILITY_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "image/*",
      },
      body: stabilityFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorDetail: string;
      try {
        const errorJson = JSON.parse(errorText);
        // Handle Stability AI's documented error format: { id, name, errors: string[] }
        if (Array.isArray(errorJson.errors) && errorJson.errors.length > 0) {
          errorDetail = errorJson.errors.join("; ");
        } else {
          errorDetail = errorJson.message || errorJson.error || errorText;
        }
      } catch {
        errorDetail = errorText;
      }

      return new Response(
        JSON.stringify({
          error: `Stability AI error: ${response.status}`,
          detail: errorDetail,
        }),
        {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Return the upscaled image
    const imageBlob = await response.blob();
    return new Response(imageBlob, {
      status: 200,
      headers: {
        "Content-Type": imageBlob.type || "image/png",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Upscale failed", detail: message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};

// Health check endpoint - verify API key is configured
export const GET: APIRoute = async ({ request }) => {
  const envApiKey = import.meta.env.STABILITY_API_KEY;
  const headerApiKey = request.headers.get("X-Stability-Key");
  const apiKey = envApiKey || headerApiKey;

  return new Response(
    JSON.stringify({
      status: "ok",
      hasEnvKey: Boolean(envApiKey),
      hasHeaderKey: Boolean(headerApiKey),
      ready: Boolean(apiKey),
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
};
