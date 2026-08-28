/**
 * Correct HTTP Content-Type for a rendered artifact. Used everywhere an
 * artifact is either returned directly (response headers) or persisted to
 * R2 (object Content-Type), so a video requested as `format=mp4|webm` is
 * never served as `image/mp4`/`image/webm`.
 */
export function artifactContentType(format: string): string {
  switch (format) {
    case "pdf":
      return "application/pdf";
    case "jpeg":
      return "image/jpeg";
    case "mp4":
      return "video/mp4";
    case "webm":
      return "video/webm";
    case "gif":
      return "image/gif";
    default:
      return `image/${format}`;
  }
}