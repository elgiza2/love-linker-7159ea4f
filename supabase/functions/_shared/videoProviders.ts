/**
 * Shared video-provider helpers (DeAPI, Renderful, Alibaba/DashScope).
 *
 * Keys come from function secrets (DEAPI_API_KEY / RENDERFUL_API_KEY);
 * Alibaba keeps using the media_provider_keys pool via acquire_media_key.
 */

export const DASHSCOPE_BASE = "https://dashscope-intl.aliyuncs.com/api/v1";

// DeAPI catalogue slug -> live model + sampling defaults.
export const DEAPI_VIDEO: Record<string, { api: string; steps: number; fps: number }> = {
  "deapi-ltx-video": { api: "Ltxv_13B_0_9_8_Distilled_FP8", steps: 1, fps: 30 },
};

/**
 * Renderful ids as they appear in the live catalogue. Our own slugs are
 * prefixed with `renderful-`, so the prefix is stripped before calling the API
 * and the image-to-video twin is `<id>-i2v` unless it needs an explicit map.
 */
export const RENDERFUL_I2V: Record<string, string> = {
  "veo-3-fast": "google-veo-3-fast-i2v",
  "runway-gen4-turbo": "runway-gen4-turbo",
  "kling-o1": "kling-o1",
};

export function renderfulModelId(slug: string, i2v: boolean): string {
  const bare = (slug || "").replace(/^renderful-/i, "");
  if (!i2v) return bare;
  return RENDERFUL_I2V[bare] ?? (bare.endsWith("-i2v") ? bare : `${bare}-i2v`);
}


/**
 * Novita AI — open-weight video models (Wan family, Apache-2.0 weights) served
 * either through the unified endpoint (`/v3/video/create`, flat body + `model`)
 * or through a model-native async endpoint (`/v3/async/<path>`, flat body).
 */
export const NOVITA_BASE = "https://api.novita.ai";

export type NovitaVideoConfig = {
  /** unified `model` id, or the native endpoint path when `native` is set */
  model: string;
  native?: string;
  i2v?: boolean;
  v2v?: boolean;
  /** unified i2v models take a `resolution` tier instead of an explicit size */
  resolutionTier?: boolean;
  maxDuration: number;
  fixedDuration?: number;
};

export const NOVITA_VIDEO: Record<string, NovitaVideoConfig> = {
  "novita-wan-2.2-t2v": { model: "wan2.2_t2v", maxDuration: 5, fixedDuration: 5 },
  "novita-wan-2.2-i2v": {
    model: "wan2.2_i2v",
    i2v: true,
    resolutionTier: true,
    maxDuration: 5,
    fixedDuration: 5,
  },
  "novita-wan-2.5-t2v": { model: "wan2.5_preview_t2v", maxDuration: 10 },
  "novita-wan-2.5-i2v": {
    model: "wan2.5_preview_i2v",
    i2v: true,
    resolutionTier: true,
    maxDuration: 10,
  },
  "novita-wan-2.6-t2v": { model: "wan2.6_t2v", maxDuration: 15 },
  "novita-wan-2.6-i2v": {
    model: "wan2.6_i2v",
    i2v: true,
    resolutionTier: true,
    maxDuration: 15,
  },
  "novita-wan-2.6-v2v": {
    model: "wan2.6_v2v",
    i2v: true,
    v2v: true,
    resolutionTier: true,
    maxDuration: 15,
  },
  "novita-wan-2.7-t2v": { model: "wan2.7_t2v", native: "wan2.7-t2v", maxDuration: 15 },
  "novita-wan-2.7-i2v": {
    model: "wan2.7_i2v",
    native: "wan2.7-i2v",
    i2v: true,
    resolutionTier: true,
    maxDuration: 15,
  },
};

export const VIDEO_SLUG_ALIASES: Record<string, string> = {
  "deapi-ltx-2": "deapi-ltx-video",
  "deapi-video": "deapi-ltx-video",
  "ltx-video": "deapi-ltx-video",
  "novita-wan-2.2": "novita-wan-2.2-t2v",
  "novita-wan-2.5": "novita-wan-2.5-t2v",
  "novita-wan-2.6": "novita-wan-2.6-t2v",
  "novita-wan-2.7": "novita-wan-2.7-t2v",
};

export function normalizeVideoSlug(slug: string): string {
  const s = (slug || "").trim();
  return VIDEO_SLUG_ALIASES[s] ?? s;
}

export function providerForSlug(slug: string): "deapi" | "renderful" | "alibaba" | "novita" {
  if (/^novita/i.test(slug)) return "novita";
  if (/^wan|^alibaba|dashscope/i.test(slug)) return "alibaba";
  if (/^renderful/i.test(slug)) return "renderful";
  return "deapi";
}

/** Novita size strings for the resolutions the Wan models accept. */
export function novitaSize(aspect: string | undefined, hd: boolean): string {
  if (aspect === "9:16") return hd ? "1080*1920" : "720*1280";
  if (aspect === "1:1") return hd ? "1440*1440" : "960*960";
  if (aspect === "4:3") return hd ? "1632*1248" : "1088*832";
  if (aspect === "3:4") return hd ? "1248*1632" : "832*1088";
  return hd ? "1920*1080" : "1280*720";
}


export function firstVideoUrl(value: unknown, depth = 0): string | null {
  if (depth > 6 || value == null) return null;
  if (typeof value === "string") {
    if (/^https?:\/\/\S+\.(mp4|webm|mov|m4v)(\?\S*)?$/i.test(value)) return value;
    if (/^https?:\/\/\S*(results|cdn|output|video)\S*/i.test(value) && /mp4|webm|mov/i.test(value)) {
      return value;
    }
    return null;
  }
  if (Array.isArray(value)) {
    for (const v of value) {
      const hit = firstVideoUrl(v, depth + 1);
      if (hit) return hit;
    }
    return null;
  }
  if (typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) {
      const hit = firstVideoUrl(v, depth + 1);
      if (hit) return hit;
    }
  }
  return null;
}

/** DeAPI caps a video frame at 768px on the long edge and 120 frames total. */
export function deapiDims(aspect?: string): [number, number] {
  if (aspect === "9:16") return [448, 768];
  if (aspect === "1:1") return [640, 640];
  return [768, 448];
}

export async function deapiVideoSubmit(opts: {
  key: string;
  model: string;
  prompt: string;
  steps: number;
  fps: number;
  duration: number;
  aspectRatio?: string;
  image?: string;
}): Promise<string> {
  const [width, height] = deapiDims(opts.aspectRatio);
  // DeAPI requires fps >= 30 and at most 120 frames (so up to 4 seconds).
  const fps = 30;
  const frames = Math.max(24, Math.min(120, Math.round(opts.duration * fps)));

  let res: Response;
  if (opts.image) {
    const r = await fetch(opts.image);
    if (!r.ok) throw new Error(`failed to download the reference image (${r.status})`);
    const ct = r.headers.get("content-type") ?? "image/png";
    const ext = ct.includes("jpeg") ? "jpg" : ct.includes("webp") ? "webp" : "png";
    const form = new FormData();
    form.append("model", opts.model);
    form.append("prompt", opts.prompt);
    form.append("width", String(width));
    form.append("height", String(height));
    form.append("seed", String(Math.floor(Math.random() * 2_147_483_647)));
    form.append("frames", String(frames));
    form.append("fps", String(fps));
    form.append("steps", String(opts.steps));
    form.append("image", await r.blob(), `frame.${ext}`);
    res = await fetch("https://api.deapi.ai/api/v2/videos/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${opts.key}`, Accept: "application/json" },
      body: form,
    });
  } else {
    res = await fetch("https://api.deapi.ai/api/v2/videos/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.key}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: opts.model,
        prompt: opts.prompt,
        width,
        height,
        seed: Math.floor(Math.random() * 2_147_483_647),
        frames,
        fps,
        steps: opts.steps,
      }),
    });
  }
  const text = await res.text();
  if (!res.ok) throw new Error(`deapi ${res.status}: ${text.slice(0, 300)}`);
  const payload = JSON.parse(text);
  const id = payload?.data?.request_id ?? payload?.request_id ?? payload?.data?.id ?? payload?.id;
  if (!id) throw new Error(`deapi: no video request id (${text.slice(0, 200)})`);
  return String(id);
}

export async function renderfulVideoSubmit(opts: {
  key: string;
  model: string;
  prompt: string;
  duration: number;
  aspectRatio?: string;
  image?: string;
  lastFrame?: string;
}): Promise<string> {
  const i2v = !!opts.image;
  const model = renderfulModelId(opts.model, i2v);
  const body: Record<string, unknown> = {
    type: i2v ? "image-to-video" : "text-to-video",
    model,
    prompt: opts.prompt,
    duration: opts.duration,
  };
  if (opts.aspectRatio) body.aspect_ratio = opts.aspectRatio;
  if (opts.image) body.image_url = opts.image;
  if (opts.lastFrame) body.last_frame_url = opts.lastFrame;

  const res = await fetch("https://api.renderful.ai/api/v1/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${opts.key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`renderful ${res.status}: ${text.slice(0, 300)}`);
  const payload = JSON.parse(text);
  const id = payload?.id ?? payload?.task_id ?? payload?.data?.id;
  if (!id) throw new Error(`renderful: no video task id (${text.slice(0, 200)})`);
  return String(id);
}

export type PollResult =
  | { status: "processing"; progress?: number }
  | { status: "completed"; video_url: string }
  | { status: "failed"; error: string };

export async function deapiVideoPoll(key: string, id: string): Promise<PollResult> {
  const st = await fetch(`https://api.deapi.ai/api/v2/jobs/${id}`, {
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
  });
  if (!st.ok) return { status: "processing" };
  const job: any = await st.json().catch(() => null);
  const status = String(job?.data?.status ?? job?.status ?? "").toLowerCase();
  if (["done", "completed", "complete", "succeeded", "success"].includes(status)) {
    const url = firstVideoUrl(job) ?? job?.data?.result_url ?? null;
    if (url) return { status: "completed", video_url: String(url) };
    return { status: "failed", error: "deapi finished without a video URL" };
  }
  if (["failed", "error", "cancelled"].includes(status)) {
    return { status: "failed", error: String(job?.data?.error ?? "deapi video job failed") };
  }
  return { status: "processing", progress: Number(job?.data?.progress ?? 0) };
}

export async function renderfulVideoPoll(key: string, id: string): Promise<PollResult> {
  const st = await fetch(`https://api.renderful.ai/api/v1/generations/${id}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!st.ok) return { status: "processing" };
  const job: any = await st.json().catch(() => null);
  const status = String(job?.status ?? "").toLowerCase();
  if (["succeeded", "completed", "complete", "success"].includes(status)) {
    const url = firstVideoUrl(job?.output ?? job?.outputs ?? job);
    if (url) return { status: "completed", video_url: url };
    return { status: "failed", error: "renderful finished without a video URL" };
  }
  if (["failed", "error", "cancelled"].includes(status)) {
    return { status: "failed", error: String(job?.error ?? "renderful video task failed") };
  }
  return { status: "processing", progress: Number(job?.progress ?? 0) };
}

/**
 * Submit a Novita video task. Wan 2.2/2.5/2.6 go through the unified endpoint
 * (`/v3/video/create`); Wan 2.7 has its own async endpoint. Both return a
 * `task_id` polled through `/v3/async/task-result`.
 */
export async function novitaVideoSubmit(opts: {
  key: string;
  slug: string;
  prompt: string;
  duration: number;
  aspectRatio?: string;
  resolution?: string;
  image?: string;
  lastFrame?: string;
  videoUrl?: string;
  negativePrompt?: string;
}): Promise<string> {
  const cfg = NOVITA_VIDEO[opts.slug];
  if (!cfg) throw new Error(`unknown Novita video model: ${opts.slug}`);
  if (cfg.i2v && !cfg.v2v && !opts.image) {
    throw new Error("this Novita model needs a reference image");
  }
  if (cfg.v2v && !opts.videoUrl && !opts.image) {
    throw new Error("this Novita model needs a reference video or image");
  }

  const hd = /1080/.test(opts.resolution ?? "");
  const duration = cfg.fixedDuration ?? Math.max(2, Math.min(cfg.maxDuration, Math.round(opts.duration) || 5));
  const body: Record<string, unknown> = { prompt: opts.prompt };
  if (opts.negativePrompt) body.negative_prompt = opts.negativePrompt;

  if (cfg.native) {
    // Model-native async endpoint (flat body).
    body.duration = duration;
    body.enable_prompt_expansion = true;
    if (cfg.i2v) {
      body.resolution = hd ? "1080P" : "720P";
      if (opts.image) body.image_url = opts.image;
      if (opts.lastFrame) body.last_frame_url = opts.lastFrame;
      if (opts.videoUrl) body.first_clip_url = opts.videoUrl;
    } else {
      body.size = novitaSize(opts.aspectRatio, hd);
    }
    const res = await fetch(`${NOVITA_BASE}/v3/async/${cfg.native}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${opts.key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`novita ${res.status}: ${text.slice(0, 300)}`);
    const id = JSON.parse(text)?.task_id;
    if (!id) throw new Error(`novita: no task id (${text.slice(0, 200)})`);
    return String(id);
  }

  // Unified endpoint.
  body.model = cfg.model;
  body.duration = String(duration);
  body.prompt_extend = true;
  if (cfg.resolutionTier) {
    body.resolution = hd ? "1080P" : "480P";
  } else {
    body.size = novitaSize(opts.aspectRatio, hd);
  }
  if (opts.image) body.image = opts.image;
  if (opts.videoUrl) body.video = opts.videoUrl;

  const res = await fetch(`${NOVITA_BASE}/v3/video/create`, {
    method: "POST",
    headers: { Authorization: `Bearer ${opts.key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`novita ${res.status}: ${text.slice(0, 300)}`);
  const id = JSON.parse(text)?.task_id;
  if (!id) throw new Error(`novita: no task id (${text.slice(0, 200)})`);
  return String(id);
}

export async function novitaVideoPoll(key: string, id: string): Promise<PollResult> {
  const st = await fetch(`${NOVITA_BASE}/v3/async/task-result?task_id=${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!st.ok) return { status: "processing" };
  const payload: any = await st.json().catch(() => null);
  const status = String(payload?.task?.status ?? "").toUpperCase();
  if (status === "TASK_STATUS_SUCCEED") {
    const url = payload?.videos?.[0]?.video_url ?? firstVideoUrl(payload);
    if (url) return { status: "completed", video_url: String(url) };
    return { status: "failed", error: "novita finished without a video URL" };
  }
  if (status === "TASK_STATUS_FAILED") {
    return { status: "failed", error: String(payload?.task?.reason ?? "novita video task failed") };
  }
  return { status: "processing", progress: Number(payload?.task?.progress_percent ?? 0) };
}
