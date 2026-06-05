import { client } from "../app/runtime";

export const DEFAULT_AUDIO_MAX_FILE_SIZE = 20 * 1024 * 1024;

const AUDIO_MIME_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/flac",
  "audio/aac",
  "audio/mp4",
  "audio/x-m4a",
]);

export function isAudioFile(file: File) {
  if (file.type && (file.type.startsWith("audio/") || AUDIO_MIME_TYPES.has(file.type))) {
    return true;
  }
  return /\.(mp3|wav|ogg|flac|aac|m4a)$/i.test(file.name);
}

export function getAudioUploadErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Audio upload failed";
}

export async function uploadAudioFile(
  file: File,
  options: { maxFileSize?: number } = {},
): Promise<{ url: string }> {
  const maxFileSize = options.maxFileSize ?? DEFAULT_AUDIO_MAX_FILE_SIZE;
  if (!isAudioFile(file)) {
    throw new Error("Unsupported audio format");
  }
  if (file.size > maxFileSize) {
    throw new Error(`Audio file exceeds ${Math.floor(maxFileSize / (1024 * 1024))}MB`);
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
