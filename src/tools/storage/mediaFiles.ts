/**
 * Mobile Freedom — M9
 * Duplicate Photo & Video Analyzer
 *
 * Identifies photo and video files locally.
 * Does not upload or delete files.
 */

const PHOTO_EXTENSIONS = new Set([
  "avif",
  "bmp",
  "gif",
  "heic",
  "heif",
  "jpeg",
  "jpg",
  "png",
  "tif",
  "tiff",
  "webp",
]);

const VIDEO_EXTENSIONS = new Set([
  "3g2",
  "3gp",
  "avi",
  "m4v",
  "mkv",
  "mov",
  "mp4",
  "mpeg",
  "mpg",
  "webm",
  "wmv",
]);

export type MediaFileKind =
  | "photo"
  | "video"
  | "unsupported";

function getExtension(name: string): string {
  const dot = name.lastIndexOf(".");

  if (dot <= 0 || dot === name.length - 1) {
    return "";
  }

  return name.slice(dot + 1).toLowerCase();
}

/**
 * Classifies files using MIME type and known extensions.
 * Classification alone does not validate file contents.
 */
export function getMediaFileKind(
  file: Pick<File, "name" | "type">,
): MediaFileKind {
  const mime = file.type.toLowerCase();

  if (mime.startsWith("image/")) {
    return "photo";
  }

  if (mime.startsWith("video/")) {
    return "video";
  }

  const extension = getExtension(file.name);

  if (PHOTO_EXTENSIONS.has(extension)) {
    return "photo";
  }

  if (VIDEO_EXTENSIONS.has(extension)) {
    return "video";
  }

  return "unsupported";
}

/**
 * Filters recognized media files.
 * Preserves their original order.
 */
export function filterMediaFiles<
  T extends Pick<File, "name" | "type">
>(files: T[]): T[] {
  return files.filter(
    (file) =>
      getMediaFileKind(file) !== "unsupported",
  );
}
