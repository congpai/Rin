import { endpoint } from "../config";
import { getAuthToken } from "./auth";

export const DEFAULT_VIDEO_MAX_FILE_SIZE = 50 * 1024 * 1024;

const VIDEO_MIME_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
  "video/x-m4v",
]);

export type UploadedVideoResult = {
  url: string;
  poster?: string;
  width?: number;
  height?: number;
};

export function isVideoFile(file: File) {
  if (file.type && (file.type.startsWith("video/") || VIDEO_MIME_TYPES.has(file.type))) {
    return true;
  }
  return /\.(mp4|webm|ogg|ogv|mov|m4v)$/i.test(file.name);
}

export function getVideoUploadErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Video upload failed";
}

// Capture the first visible frame + intrinsic dimensions in the browser.
// Used to generate a poster image (so mobile shows content, not just a play
// button) and to set an aspect ratio (so there is no layout shift on load).
function captureVideoPoster(
  file: File,
): Promise<{ blob: Blob | null; width: number; height: number }> {
  return new Promise((resolve) => {
    let settled = false;
    const video = document.createElement("video");
    const objectUrl = URL.createObjectURL(file);

    const finish = (result: { blob: Blob | null; width: number; height: number }) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(objectUrl);
      resolve(result);
    };

    const fail = () => finish({ blob: null, width: 0, height: 0 });

    video.muted = true;
    video.preload = "metadata";
    (video as HTMLVideoElement & { playsInline: boolean }).playsInline = true;
    video.onerror = fail;

    video.onloadeddata = () => {
      const width = video.videoWidth;
      const height = video.videoHeight;
      const draw = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx || !width || !height) {
            finish({ blob: null, width, height });
            return;
          }
          ctx.drawImage(video, 0, 0, width, height);
          canvas.toBlob(
            (blob) => finish({ blob, width, height }),
            "image/webp",
            0.8,
          );
        } catch {
          finish({ blob: null, width, height });
        }
      };
      video.onseeked = draw;
      try {
        video.currentTime = Math.min(0.1, (video.duration || 1) / 2);
      } catch {
        draw();
      }
    };

    video.src = objectUrl;
    // Safety net so a stubborn file never blocks the upload.
    setTimeout(fail, 8000);
  });
}

function xhrUpload(
  file: File,
  onProgress?: (ratio: number) => void,
): Promise<{ url: string }> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("file", file);
    form.append("key", file.name);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${endpoint}/api/storage`);
    xhr.withCredentials = true;
    const token = getAuthToken();
    if (token) {
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    }

    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          onProgress(event.loaded / event.total);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          const url = typeof data === "string" ? data : data?.url;
          if (url) {
            resolve({ url });
            return;
          }
        } catch {
          /* fall through */
        }
        reject(new Error("Invalid upload response"));
      } else {
        reject(new Error(xhr.responseText || `Upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(form);
  });
}

export async function uploadVideoFile(
  file: File,
  options: { maxFileSize?: number; onProgress?: (ratio: number) => void } = {},
): Promise<UploadedVideoResult> {
  const maxFileSize = options.maxFileSize ?? DEFAULT_VIDEO_MAX_FILE_SIZE;
  if (!isVideoFile(file)) {
    throw new Error("Unsupported video format");
  }
  if (file.size > maxFileSize) {
    throw new Error(`Video file exceeds ${Math.floor(maxFileSize / (1024 * 1024))}MB`);
  }

  // Generate the poster locally before the (slow) upload starts.
  const poster = await captureVideoPoster(file);

  const { url } = await xhrUpload(file, options.onProgress);

  let posterUrl: string | undefined;
  if (poster.blob) {
    try {
      const posterFile = new File(
        [poster.blob],
        `${file.name.replace(/\.[^.]+$/, "")}-poster.webp`,
        { type: "image/webp" },
      );
      const res = await xhrUpload(posterFile);
      posterUrl = res.url;
    } catch {
      // Poster is a nice-to-have; ignore failures.
    }
  }

  return {
    url,
    poster: posterUrl,
    width: poster.width || undefined,
    height: poster.height || undefined,
  };
}

// Build a <video> tag. With a real poster we can use preload="none" so no video
// bytes load until the user hits play; width/height drive a stable aspect ratio.
export function buildMarkdownVideo(video: UploadedVideoResult) {
  const attrs = [
    "controls",
    "playsinline",
    'preload="none"',
    video.poster ? `poster="${video.poster}"` : "",
    video.width ? `width="${video.width}"` : "",
    video.height ? `height="${video.height}"` : "",
    `src="${video.url}"`,
    'style="max-width:100%"',
  ]
    .filter(Boolean)
    .join(" ");
  return `\n\n<video ${attrs}></video>\n\n`;
}
