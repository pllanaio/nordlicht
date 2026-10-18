// Public error messages deliberately exclude provider response bodies and secrets.
export class VideoError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "VideoError";
    this.code = code;
  }
}

export function publicError(error) {
  if (error instanceof VideoError) return { code: error.code, message: error.message };
  if (error?.name === "AbortError" || error?.name === "TimeoutError") {
    return { code: "interrupted", message: "Die Verarbeitung wurde abgebrochen oder hat das Zeitlimit erreicht." };
  }
  return { code: "generation_failed", message: "Das Video konnte nicht erstellt werden. Bitte versuche es mit einem neuen Auftrag erneut." };
}

export function checkAbort(signal) {
  signal?.throwIfAborted();
}
