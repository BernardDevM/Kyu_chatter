/**
 * Maximum permitted upload file size (25 megabytes).
 */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/**
 * Regular expression allow-list for supported upload media MIME types.
 * Allows images, videos, audio, and PDF documents.
 */
export const ALLOWED_MIME_TYPES_REGEX =
  /^(image\/(jpeg|png|gif|webp)|video\/(mp4|webm|quicktime)|audio\/(mpeg|wav|ogg)|application\/pdf)$/;
