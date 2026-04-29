export const FACE_PRIVACY_CLIENT_SCRIPT = `
(function () {
  if (window.ikimonFacePrivacy) return;

  const DEFAULTS = {
    maxFaces: 24,
    paddingRatio: 0.42,
    minPaddingPx: 10,
    blocksPerFace: 11,
    minFaceAreaRatio: 0.00018,
    minDetectionConfidence: 0.5
  };

  let wasmDetectorPromise = null;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function getFacePrivacyAssetBase() {
    const configured = typeof window.ikimonFacePrivacyAssetBase === 'string'
      ? window.ikimonFacePrivacyAssetBase
      : '/assets/face-privacy';
    const trimmed = configured.replace(/\\/+$/, '');
    return trimmed || '/assets/face-privacy';
  }

  function normalizeBox(box) {
    if (!box) return null;
    const x = Number(box.x);
    const y = Number(box.y);
    const width = Number(box.width);
    const height = Number(box.height);
    if (![x, y, width, height].every(Number.isFinite)) return null;
    if (width <= 0 || height <= 0) return null;
    return { x, y, width, height };
  }

  function normalizeMediaPipeBox(detection) {
    const box = detection && detection.boundingBox;
    if (!box) return null;
    return normalizeBox({
      x: box.originX,
      y: box.originY,
      width: box.width,
      height: box.height
    });
  }

  function expandBox(box, canvas, options) {
    const pad = Math.max(
      Number(options.minPaddingPx || DEFAULTS.minPaddingPx),
      Math.max(box.width, box.height) * Number(options.paddingRatio || DEFAULTS.paddingRatio)
    );
    const x = clamp(Math.floor(box.x - pad), 0, canvas.width);
    const y = clamp(Math.floor(box.y - pad), 0, canvas.height);
    const right = clamp(Math.ceil(box.x + box.width + pad), 0, canvas.width);
    const bottom = clamp(Math.ceil(box.y + box.height + pad), 0, canvas.height);
    return {
      x,
      y,
      width: Math.max(1, right - x),
      height: Math.max(1, bottom - y)
    };
  }

  function pixelateRegion(canvas, box, options) {
    const context = canvas.getContext('2d');
    if (!context) return false;
    const blocks = Math.max(5, Number(options.blocksPerFace || DEFAULTS.blocksPerFace));
    const smallWidth = Math.max(1, Math.round(box.width / blocks));
    const smallHeight = Math.max(1, Math.round(box.height / blocks));
    const scratch = document.createElement('canvas');
    scratch.width = smallWidth;
    scratch.height = smallHeight;
    const scratchContext = scratch.getContext('2d');
    if (!scratchContext) return false;
    scratchContext.imageSmoothingEnabled = false;
    scratchContext.drawImage(canvas, box.x, box.y, box.width, box.height, 0, 0, smallWidth, smallHeight);
    const previousSmoothing = context.imageSmoothingEnabled;
    context.imageSmoothingEnabled = false;
    context.drawImage(scratch, 0, 0, smallWidth, smallHeight, box.x, box.y, box.width, box.height);
    context.imageSmoothingEnabled = previousSmoothing;
    return true;
  }

  async function loadWasmFaceDetector(options) {
    if (wasmDetectorPromise) return wasmDetectorPromise;
    wasmDetectorPromise = (async () => {
      const base = getFacePrivacyAssetBase();
      const visionModule = await import(base + '/mediapipe/vision_bundle.mjs');
      const fileset = await visionModule.FilesetResolver.forVisionTasks(base + '/mediapipe/wasm');
      return visionModule.FaceDetector.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: base + '/blaze_face_short_range.tflite',
          delegate: 'CPU'
        },
        runningMode: 'IMAGE',
        minDetectionConfidence: Number(options.minDetectionConfidence || DEFAULTS.minDetectionConfidence)
      });
    })().catch((error) => {
      wasmDetectorPromise = null;
      throw error;
    });
    return wasmDetectorPromise;
  }

  async function detectNativeFaceBoxes(canvas, options) {
    const Detector = window.FaceDetector;
    if (typeof Detector !== 'function') {
      return { available: false, boxes: [], error: 'face_detector_unavailable', detector: 'browser_face_detector' };
    }
    try {
      const detector = new Detector({
        fastMode: true,
        maxDetectedFaces: Number(options.maxFaces || DEFAULTS.maxFaces)
      });
      const faces = await detector.detect(canvas);
      const minArea = Math.max(1, canvas.width * canvas.height * Number(options.minFaceAreaRatio || DEFAULTS.minFaceAreaRatio));
      const boxes = (Array.isArray(faces) ? faces : [])
        .map((face) => normalizeBox(face && face.boundingBox))
        .filter((box) => box && box.width * box.height >= minArea);
      return { available: true, boxes, error: null, detector: 'browser_face_detector' };
    } catch (_) {
      return { available: false, boxes: [], error: 'face_detector_failed', detector: 'browser_face_detector' };
    }
  }

  async function detectWasmFaceBoxes(canvas, options) {
    try {
      const detector = await loadWasmFaceDetector(options);
      const result = detector.detect(canvas);
      const minArea = Math.max(1, canvas.width * canvas.height * Number(options.minFaceAreaRatio || DEFAULTS.minFaceAreaRatio));
      const boxes = (Array.isArray(result && result.detections) ? result.detections : [])
        .map((detection) => normalizeMediaPipeBox(detection))
        .filter((box) => box && box.width * box.height >= minArea)
        .slice(0, Number(options.maxFaces || DEFAULTS.maxFaces));
      return { available: true, boxes, error: null, detector: 'mediapipe_wasm_face_detector' };
    } catch (_) {
      return { available: false, boxes: [], error: 'wasm_face_detector_failed', detector: 'mediapipe_wasm_face_detector' };
    }
  }

  async function detectFaceBoxes(canvas, options) {
    const nativeResult = await detectNativeFaceBoxes(canvas, options);
    if (nativeResult.available && !nativeResult.error) {
      return nativeResult;
    }
    const wasmResult = await detectWasmFaceBoxes(canvas, options);
    if (wasmResult.available && !wasmResult.error) {
      return wasmResult;
    }
    return {
      available: false,
      boxes: [],
      error: wasmResult.error || nativeResult.error || 'face_detector_unavailable',
      detector: wasmResult.detector || nativeResult.detector || 'none'
    };
  }

  async function redactCanvasFaces(canvas, options) {
    const merged = Object.assign({}, DEFAULTS, options || {});
    if (!canvas || !canvas.width || !canvas.height) {
      return { available: false, redacted: false, faceCount: 0, error: 'canvas_unavailable' };
    }
    const detected = await detectFaceBoxes(canvas, merged);
    if (!detected.available || detected.error) {
      return {
        available: false,
        redacted: false,
        faceCount: 0,
        error: detected.error || null,
        detector: detected.detector || 'none'
      };
    }
    let redacted = 0;
    detected.boxes.forEach((box) => {
      const expanded = expandBox(box, canvas, merged);
      if (pixelateRegion(canvas, expanded, merged)) redacted += 1;
    });
    return {
      available: true,
      redacted: redacted > 0,
      faceCount: redacted,
      error: null,
      detector: detected.detector || 'unknown'
    };
  }

  function summarizeFacePrivacy(result) {
    const input = result || {};
    const available = Boolean(input.available);
    const redacted = Boolean(input.redacted);
    const faceCount = Number.isFinite(Number(input.faceCount)) ? Number(input.faceCount) : 0;
    return {
      detector: input.detector || 'unknown',
      status: redacted ? 'redacted' : (available ? 'no_faces' : 'unavailable'),
      faceCount,
      error: input.error || null
    };
  }

  window.ikimonFacePrivacy = {
    redactCanvasFaces,
    summarizeFacePrivacy
  };
})();
`;
