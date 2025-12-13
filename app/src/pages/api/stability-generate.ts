import type { APIRoute } from "astro";

// Stability AI API endpoints
const STABILITY_API_HOST = "https://api.stability.ai";

// Model to endpoint mapping
type StabilityModel =
  | "sdxl-1.0"
  | "sd3.5-large"
  | "sd3.5-large-turbo"
  | "sd3.5-medium"
  | "sd3.5-flash"
  | "ultra";

interface GenerateRequest {
  model: StabilityModel;
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  steps?: number;
  cfgScale?: number;
  seed?: number;
  aspectRatio?: string;
}

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  // Get API key from env var or header
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
    const body: GenerateRequest = await request.json();
    const {
      model,
      prompt,
      negativePrompt,
      width,
      height,
      steps,
      cfgScale,
      seed,
      aspectRatio,
    } = body;

    if (!prompt) {
      return new Response(
        JSON.stringify({
          error: "Missing prompt",
          detail: "prompt is required",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    let imageBlob: Blob;

    if (model === "sdxl-1.0") {
      // Use v1 JSON API for SDXL 1.0
      imageBlob = await generateSdxlV1(apiKey, {
        prompt,
        negativePrompt,
        width: width ?? 1024,
        height: height ?? 1024,
        steps: steps ?? 30,
        cfgScale: cfgScale ?? 7,
        seed: seed ?? 0,
      });
    } else if (model === "ultra") {
      // Use v2beta ultra endpoint
      imageBlob = await generateUltra(apiKey, {
        prompt,
        negativePrompt,
        aspectRatio: aspectRatio ?? "1:1",
        seed,
      });
    } else {
      // Use v2beta sd3 endpoint for SD 3.5 variants
      imageBlob = await generateSd3(apiKey, {
        model,
        prompt,
        negativePrompt,
        aspectRatio: aspectRatio ?? "1:1",
        seed,
      });
    }

    return new Response(imageBlob, {
      status: 200,
      headers: { "Content-Type": "image/png" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Generation failed", detail: message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};

// v1 SDXL 1.0 text-to-image (JSON API)
async function generateSdxlV1(
  apiKey: string,
  options: {
    prompt: string;
    negativePrompt?: string;
    width: number;
    height: number;
    steps: number;
    cfgScale: number;
    seed: number;
  },
): Promise<Blob> {
  const engineId = "stable-diffusion-xl-1024-v1-0";
  const url = `${STABILITY_API_HOST}/v1/generation/${engineId}/text-to-image`;

  const textPrompts = [{ text: options.prompt, weight: 1 }];
  if (options.negativePrompt) {
    textPrompts.push({ text: options.negativePrompt, weight: -1 });
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      text_prompts: textPrompts,
      cfg_scale: options.cfgScale,
      height: options.height,
      width: options.width,
      steps: options.steps,
      samples: 1,
      seed: options.seed,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Stability AI SDXL error ${response.status}: ${errorText}`);
  }

  interface GenerationResponse {
    artifacts: Array<{
      base64: string;
      seed: number;
      finishReason: string;
    }>;
  }

  const data: GenerationResponse = await response.json();
  if (!data.artifacts || data.artifacts.length === 0) {
    throw new Error("No image generated");
  }

  // Decode base64 to blob
  const base64 = data.artifacts[0].base64;
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Blob([bytes], { type: "image/png" });
}

// v2beta SD3 endpoint (FormData API)
async function generateSd3(
  apiKey: string,
  options: {
    model: string;
    prompt: string;
    negativePrompt?: string;
    aspectRatio?: string;
    seed?: number;
  },
): Promise<Blob> {
  const url = `${STABILITY_API_HOST}/v2beta/stable-image/generate/sd3`;

  const formData = new FormData();
  formData.append("prompt", options.prompt);
  formData.append("model", options.model);
  formData.append("output_format", "png");

  if (options.aspectRatio) {
    formData.append("aspect_ratio", options.aspectRatio);
  }
  if (options.negativePrompt) {
    formData.append("negative_prompt", options.negativePrompt);
  }
  if (options.seed !== undefined && options.seed !== 0) {
    formData.append("seed", options.seed.toString());
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "image/*",
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Stability AI SD3 error ${response.status}: ${errorText}`);
  }

  return response.blob();
}

// v2beta Ultra endpoint (FormData API)
async function generateUltra(
  apiKey: string,
  options: {
    prompt: string;
    negativePrompt?: string;
    aspectRatio?: string;
    seed?: number;
  },
): Promise<Blob> {
  const url = `${STABILITY_API_HOST}/v2beta/stable-image/generate/ultra`;

  const formData = new FormData();
  formData.append("prompt", options.prompt);
  formData.append("output_format", "png");

  if (options.aspectRatio) {
    formData.append("aspect_ratio", options.aspectRatio);
  }
  if (options.negativePrompt) {
    formData.append("negative_prompt", options.negativePrompt);
  }
  if (options.seed !== undefined && options.seed !== 0) {
    formData.append("seed", options.seed.toString());
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "image/*",
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Stability AI Ultra error ${response.status}: ${errorText}`,
    );
  }

  return response.blob();
}

// Health check endpoint
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
      supportedModels: [
        "sdxl-1.0",
        "sd3.5-large",
        "sd3.5-large-turbo",
        "sd3.5-medium",
        "sd3.5-flash",
        "ultra",
      ],
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
};
