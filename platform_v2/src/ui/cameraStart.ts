export const CAMERA_START_TIMEOUT_MS = 10_000;

export type CameraStartFailure =
  | "no_device"
  | "permission_denied"
  | "device_busy"
  | "constraints_unsupported"
  | "focus_unsupported"
  | "timeout"
  | "unavailable";

export class CameraStartError extends Error {
  constructor(public readonly reason: CameraStartFailure, cause?: unknown) {
    super(reason, { cause });
    this.name = "CameraStartError";
  }
}

type MediaDevicesLike = {
  getUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream>;
};

export async function requestCameraStream(
  mediaDevices: MediaDevicesLike,
  constraints: MediaStreamConstraints,
  options: { timeoutMs?: number; requireFocusMode?: boolean } = {},
): Promise<MediaStream> {
  const makeError = (reason: CameraStartFailure, cause?: unknown) => {
    const error = new Error(reason, { cause }) as Error & { reason: CameraStartFailure };
    error.name = "CameraStartError";
    error.reason = reason;
    return error;
  };
  const timeoutMs = options.timeoutMs ?? CAMERA_START_TIMEOUT_MS;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  try {
    const mediaRequest = mediaDevices.getUserMedia(constraints).then((stream) => {
      if (timedOut) stream.getTracks().forEach((item) => item.stop());
      return stream;
    });
    const stream = await Promise.race([
      mediaRequest,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => {
          timedOut = true;
          reject(makeError("timeout"));
        }, timeoutMs);
      }),
    ]);
    if (options.requireFocusMode) {
      const track = stream.getVideoTracks()[0];
      const capabilities = track?.getCapabilities?.() as MediaTrackCapabilities & { focusMode?: string[] };
      if (!track || !Array.isArray(capabilities?.focusMode) || capabilities.focusMode.length === 0) {
        stream.getTracks().forEach((item) => item.stop());
        throw makeError("focus_unsupported");
      }
    }
    return stream;
  } catch (error) {
    if ((error as { name?: unknown } | null)?.name === "CameraStartError") throw error;
    const name = String((error as { name?: unknown } | null)?.name ?? "");
    const reason = name === "NotFoundError" || name === "DevicesNotFoundError"
      ? "no_device"
      : name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError"
        ? "permission_denied"
        : name === "NotReadableError" || name === "TrackStartError"
          ? "device_busy"
          : name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError"
            ? "constraints_unsupported"
            : "unavailable";
    throw makeError(reason, error);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

/** Browser-safe source used by the dependency-free, materialized site shell. */
export const cameraStartRuntimeSource = `(function () {
  const __name = (value) => value;
  return ${requestCameraStream.toString()};
})()`;
