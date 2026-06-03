import { client } from "../app/runtime";
import { encodeBlurhash } from "./blurhash";
import {
  isVariantFileName,
  parseStorageFileNameFromUrl,
  THUMBNAIL_WIDTHS,
  VARIANT_FILE_EXTENSION,
} from "./image-variants";

export const DEFAULT_IMAGE_MAX_FILE_SIZE = 5 * 1024 * 1024;

export const IMAGE_UPLOAD_ERROR = {
  UNCOMPRESSIBLE: "IMAGE_UNCOMPRESSIBLE",
  COMPRESS_FAILED: "IMAGE_COMPRESS_FAILED",
} as const;

const MIN_COMPRESS_DIMENSION = 480;
const MAX_COMPRESS_ATTEMPTS = 16;

export type UploadedImageResult = {
  url: string;
  blurhash?: string;
  width?: number;
  height?: number;
};

type ImageMetadata = {
  blurhash?: string;
  width?: number;
  height?: number;
};

type MarkdownImageMetadataResult = {
  content: string;
  updated: number;
  failed: number;
};

export function isImageFile(file: File) {
  return file.type.startsWith("image/");
}

function toPositiveInteger(value?: string | null) {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export function attachImageMetadataToUrl(url: string, metadata: ImageMetadata = {}) {
  const { blurhash, width, height } = metadata;
  if (!blurhash && !width && !height) {
    return url;
  }

  const [baseUrl, fragment = ""] = url.split("#", 2);
  const params = new URLSearchParams(fragment);
  if (blurhash) {
    params.set("blurhash", blurhash);
  }
  if (width) {
    params.set("width", String(width));
  }
  if (height) {
    params.set("height", String(height));
  }
  return `${baseUrl}#${params.toString()}`;
}

export function parseImageUrlMetadata(url?: string | null) {
  if (!url) {
    return {
      src: "",
      blurhash: undefined as string | undefined,
    };
  }

  const [src, fragment = ""] = url.split("#", 2);
  const params = new URLSearchParams(fragment);

  return {
    src,
    blurhash: params.get("blurhash") || undefined,
    width: toPositiveInteger(params.get("width")),
    height: toPositiveInteger(params.get("height")),
  };
}

export function stripImageUrlMetadata(url?: string | null) {
  return parseImageUrlMetadata(url).src;
}

export function buildMarkdownImage(fileName: string, url: string, metadata: ImageMetadata = {}) {
  const safeAlt = fileName.replace(/[[\]]/g, "");
  const safeUrl = url.replace(/\s/g, "%20");
  return `![${safeAlt}](${attachImageMetadataToUrl(safeUrl, metadata)})\n`;
}

async function loadImage(file: File) {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Failed to load image"));
      element.src = objectUrl;
    });
    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function replaceFileExtension(name: string, extension: string) {
  const base = name.replace(/\.[^.]+$/, "") || "image";
  return `${base}.${extension}`;
}

function supportsWebpExport() {
  if (typeof document === "undefined") {
    return false;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  return canvas.toDataURL("image/webp").startsWith("data:image/webp");
}

async function canvasToBlob(
  image: HTMLImageElement,
  width: number,
  height: number,
  mimeType: string,
  quality: number,
) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Failed to compress image");
  }
  context.drawImage(image, 0, 0, width, height);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Failed to compress image"))),
      mimeType,
      quality,
    );
  });
}

function isUncompressibleImageType(type: string) {
  return type === "image/gif" || type === "image/svg+xml";
}

async function createThumbnailFile(source: File, maxWidth: number) {
  if (isUncompressibleImageType(source.type)) {
    return null;
  }

  const image = await loadImage(source);
  const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
  if (!longestSide) {
    return null;
  }

  const scale = longestSide <= maxWidth ? 1 : maxWidth / longestSide;
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const mimeType = supportsWebpExport() ? "image/webp" : "image/jpeg";
  const extension = mimeType === "image/webp" ? "webp" : "jpg";
  const blob = await canvasToBlob(image, width, height, mimeType, 0.82);
  return new File([blob], `thumb-${maxWidth}.${extension}`, { type: mimeType });
}

async function uploadThumbnailVariants(source: File, originalUrl: string) {
  const baseFileName = parseStorageFileNameFromUrl(originalUrl);
  if (!baseFileName || isVariantFileName(baseFileName)) {
    return;
  }

  const dot = baseFileName.lastIndexOf(".");
  const hashBase = dot > 0 ? baseFileName.slice(0, dot) : baseFileName;

  await Promise.allSettled(
    THUMBNAIL_WIDTHS.map(async (width) => {
      const thumbnail = await createThumbnailFile(source, width);
      if (!thumbnail) {
        return;
      }

      await client.storage.upload(thumbnail, thumbnail.name, {
        storageKey: `${hashBase}_w${width}.${VARIANT_FILE_EXTENSION}`,
      });
    }),
  );
}

export async function prepareImageForUpload(
  file: File,
  maxBytes: number = DEFAULT_IMAGE_MAX_FILE_SIZE,
): Promise<File> {
  if (!isImageFile(file)) {
    throw new Error("Invalid image type");
  }
  if (file.size <= maxBytes) {
    return file;
  }
  if (isUncompressibleImageType(file.type)) {
    throw new Error(IMAGE_UPLOAD_ERROR.UNCOMPRESSIBLE);
  }

  const image = await loadImage(file);
  const mimeType = supportsWebpExport() ? "image/webp" : "image/jpeg";
  const extension = mimeType === "image/webp" ? "webp" : "jpg";

  let width = image.naturalWidth;
  let height = image.naturalHeight;
  let quality = 0.9;

  for (let attempt = 0; attempt < MAX_COMPRESS_ATTEMPTS; attempt++) {
    const blob = await canvasToBlob(image, width, height, mimeType, quality);
    if (blob.size <= maxBytes) {
      return new File([blob], replaceFileExtension(file.name, extension), { type: mimeType });
    }

    if (quality > 0.55) {
      quality = Math.max(0.55, quality - 0.07);
      continue;
    }

    const nextWidth = Math.max(MIN_COMPRESS_DIMENSION, Math.round(width * 0.82));
    const nextHeight = Math.max(MIN_COMPRESS_DIMENSION, Math.round(height * 0.82));
    if (nextWidth === width && nextHeight === height) {
      break;
    }
    width = nextWidth;
    height = nextHeight;
    quality = 0.82;
  }

  throw new Error(IMAGE_UPLOAD_ERROR.COMPRESS_FAILED);
}

export function getImageUploadErrorMessage(
  error: unknown,
  translate: (key: string, options?: Record<string, unknown>) => string,
  maxBytes: number = DEFAULT_IMAGE_MAX_FILE_SIZE,
) {
  const maxSize = Math.round(maxBytes / 1024 / 1024);
  if (error instanceof Error) {
    if (error.message === IMAGE_UPLOAD_ERROR.UNCOMPRESSIBLE) {
      return translate("upload.image.uncompressible", { size: maxSize });
    }
    if (error.message === IMAGE_UPLOAD_ERROR.COMPRESS_FAILED) {
      return translate("upload.image.compress_failed", { size: maxSize });
    }
    return error.message;
  }
  return translate("upload.failed");
}

async function loadImageFromUrl(url: string) {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.crossOrigin = "anonymous";
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    element.src = url;
  });
  return image;
}

export async function generateImageMetadata(file: File) {
  if (!isImageFile(file)) {
    return {};
  }

  const image = await loadImage(file);
  const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
  if (!longestSide) {
    return {};
  }

  const scale = Math.min(1, 48 / longestSide);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return {};
  }

  context.drawImage(image, 0, 0, width, height);
  const imageData = context.getImageData(0, 0, width, height);
  return {
    blurhash: encodeBlurhash(imageData.data, width, height, 4, 3),
    width: image.naturalWidth,
    height: image.naturalHeight,
  };
}

export async function generateImageMetadataFromUrl(url: string): Promise<ImageMetadata> {
  const { src, blurhash, width, height } = parseImageUrlMetadata(url);
  if (blurhash && width && height) {
    return { blurhash, width, height };
  }

  const image = await loadImageFromUrl(src);
  const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
  if (!longestSide) {
    return {
      blurhash,
      width: width || undefined,
      height: height || undefined,
    };
  }

  const scale = Math.min(1, 48 / longestSide);
  const canvas = document.createElement("canvas");
  const canvasWidth = Math.max(1, Math.round(image.naturalWidth * scale));
  const canvasHeight = Math.max(1, Math.round(image.naturalHeight * scale));
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return {
      blurhash,
      width: width || image.naturalWidth || undefined,
      height: height || image.naturalHeight || undefined,
    };
  }

  context.drawImage(image, 0, 0, canvasWidth, canvasHeight);
  const imageData = context.getImageData(0, 0, canvasWidth, canvasHeight);

  return {
    blurhash: blurhash || encodeBlurhash(imageData.data, canvasWidth, canvasHeight, 4, 3),
    width: width || image.naturalWidth || undefined,
    height: height || image.naturalHeight || undefined,
  };
}

export async function enrichMarkdownImageMetadata(content: string): Promise<MarkdownImageMetadataResult> {
  const markdownPattern = /!\[(.*?)\]\((\S+?)(?:\s+"[^"]*")?\)/g;
  const htmlPattern = /<img\b([^>]*?)\bsrc=["']([^"']+)["']([^>]*?)>/gi;
  const markdownMatches = [...content.matchAll(markdownPattern)].map((match) => ({
    type: "markdown" as const,
    fullMatch: match[0],
    alt: match[1] || "",
    rawUrl: match[2],
  }));
  const htmlMatches = [...content.matchAll(htmlPattern)].map((match) => ({
    type: "html" as const,
    fullMatch: match[0],
    beforeSrc: match[1] || "",
    rawUrl: match[2],
    afterSrc: match[3] || "",
  }));
  const matches = [...markdownMatches, ...htmlMatches];

  if (matches.length === 0) {
    return { content, updated: 0, failed: 0 };
  }

  let nextContent = content;
  let updated = 0;
  let failed = 0;

  for (const match of matches) {
    const { fullMatch, rawUrl } = match;
    if (!fullMatch || !rawUrl) {
      continue;
    }

    const existing = parseImageUrlMetadata(rawUrl);
    if (existing.blurhash && existing.width && existing.height) {
      continue;
    }

    try {
      const metadata = await generateImageMetadataFromUrl(rawUrl);
      if (!metadata.blurhash || !metadata.width || !metadata.height) {
        failed += 1;
        continue;
      }

      const nextUrl = attachImageMetadataToUrl(existing.src, metadata);
      const replacement = match.type === "markdown"
        ? `![${match.alt}](${nextUrl})`
        : `<img${match.beforeSrc}src="${nextUrl}"${match.afterSrc}>`;
      if (replacement !== fullMatch) {
        nextContent = nextContent.replace(fullMatch, replacement);
        updated += 1;
      }
    } catch {
      failed += 1;
    }
  }

  return {
    content: nextContent,
    updated,
    failed,
  };
}

export async function uploadImageFile(
  file: File,
  options: { maxFileSize?: number } = {},
): Promise<UploadedImageResult> {
  const maxFileSize = options.maxFileSize ?? DEFAULT_IMAGE_MAX_FILE_SIZE;
  const prepared = await prepareImageForUpload(file, maxFileSize);

  const [uploadResult, metadataResult] = await Promise.allSettled([
    client.storage.upload(prepared, prepared.name),
    generateImageMetadata(prepared),
  ]);

  if (uploadResult.status === "rejected") {
    throw uploadResult.reason instanceof Error
      ? uploadResult.reason
      : new Error("Upload failed");
  }

  const { data, error } = uploadResult.value;
  if (error) {
    throw new Error(error.value);
  }

  const url =
    typeof data === "string"
      ? data
      : data?.url;

  if (!url) {
    throw new Error("Invalid upload response");
  }

  await uploadThumbnailVariants(prepared, url).catch((error) => {
    console.warn("Client thumbnail upload failed; server will generate variants:", error);
  });

  return {
    url,
    ...(metadataResult.status === "fulfilled" ? metadataResult.value : {}),
  };
}
