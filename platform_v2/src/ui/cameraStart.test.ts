import assert from "node:assert/strict";
import test from "node:test";
import { cameraStartRuntimeSource, requestCameraStream } from "./cameraStart.js";

const constraints = { video: true, audio: false } satisfies MediaStreamConstraints;

function namedError(name: string): Error {
  const error = new Error(name);
  error.name = name;
  return error;
}

function streamWithFocus(focusMode?: string[]) {
  let stopped = false;
  const track = {
    getCapabilities: () => focusMode === undefined ? {} : { focusMode },
    stop: () => { stopped = true; },
  };
  return {
    stream: {
      getVideoTracks: () => [track],
      getTracks: () => [track],
    } as unknown as MediaStream,
    wasStopped: () => stopped,
  };
}

async function assertReason(promise: Promise<unknown>, reason: string): Promise<void> {
  await assert.rejects(promise, (error: Error & { reason?: string }) => {
    assert.equal(error.name, "CameraStartError");
    assert.equal(error.reason, reason);
    return true;
  });
}

test("camera start reports no device", async () => {
  const mediaDevices = { getUserMedia: async () => { throw namedError("NotFoundError"); } };
  await assertReason(requestCameraStream(mediaDevices, constraints), "no_device");
});

test("camera start reports denied permission", async () => {
  const mediaDevices = { getUserMedia: async () => { throw namedError("NotAllowedError"); } };
  await assertReason(requestCameraStream(mediaDevices, constraints), "permission_denied");
});

test("camera start times out instead of hanging", async () => {
  const mediaDevices = { getUserMedia: () => new Promise<MediaStream>(() => undefined) };
  await assertReason(requestCameraStream(mediaDevices, constraints, { timeoutMs: 5 }), "timeout");
});

test("close-up camera stops the stream and reports unsupported focus", async () => {
  const fixture = streamWithFocus();
  const mediaDevices = { getUserMedia: async () => fixture.stream };
  await assertReason(requestCameraStream(mediaDevices, constraints, { requireFocusMode: true }), "focus_unsupported");
  assert.equal(fixture.wasStopped(), true);
});

test("close-up camera returns a focus-capable stream", async () => {
  const fixture = streamWithFocus(["continuous", "single-shot"]);
  const mediaDevices = { getUserMedia: async () => fixture.stream };
  assert.equal(await requestCameraStream(mediaDevices, constraints, { requireFocusMode: true }), fixture.stream);
  assert.equal(fixture.wasStopped(), false);
});

test("materialized camera helper remains executable without module imports", async () => {
  const runtimeRequest = Function(`return (${cameraStartRuntimeSource})`)() as typeof requestCameraStream;
  const fixture = streamWithFocus(["continuous"]);
  assert.equal(await runtimeRequest({ getUserMedia: async () => fixture.stream }, constraints, {
    timeoutMs: 10,
    requireFocusMode: true,
  }), fixture.stream);
});
