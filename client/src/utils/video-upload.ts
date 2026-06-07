import { client } from "../app/runtime";

export const DEFAULT_VIDEO_MAX_FILE_SIZE = 50 * 1024 * 1024;

const VIDEO_MIME_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
  "video/x-m4v",
]);

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

export async function uploadVideoFile(
  file: File,
  options: { maxFileSize?: number } = {},
): Promise<{ url: string }> {
  const maxFileSize = options.maxFileSize ?? DEFAULT_VIDEO_MAX_FILE_SIZE;
  if (!isVideoFile(file)) {
    throw new Error("Unsupported video format");
  }
  if (file.size > maxFileSize) {
    throw new Error(`Video file exceeds ${Math.floor(maxFileSize / (1024 * 1024))}MB`);
  }

  const { data, error } = await client.storage.upload(file, file.name);
  if (error) {
    throw new Error(error.value);
  }

  const url = typeof data === "string" ? data : data?.url;
  if (!url) {
    throw new Error("Invalid upload response");
  }

  return { url };
}

// Markdown renders raw HTML (rehypeRaw), so a <video> tag plays inline.
// Surrounded by blank lines so it becomes a standalone block — any caption
// text typed before it stays above the video instead of merging into it.
export function buildMarkdownVideo(url: string) {
  return `\n\n<video controls preload="metadata" src="${url}" style="max-width:100%"></video>\n\n`;
}
