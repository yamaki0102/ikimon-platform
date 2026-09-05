/** Existing 2560px/JPEG policy shared by every browser photo entry. No network writes. */
export const PHOTO_UPLOAD_PREPARATION_SCRIPT = String.raw`
  const PHOTO_UPLOAD_MAX_EDGE = 2560;
  const PHOTO_UPLOAD_JPEG_QUALITY = 0.88;
  const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('file_read_failed'));
    reader.readAsDataURL(file);
  });
  const canvasToJpegDataUrl = (canvas, quality) => new Promise((resolve) => {
    if (!canvas || typeof canvas.toBlob !== 'function') {
      resolve(canvas.toDataURL('image/jpeg', quality));
      return;
    }
    canvas.toBlob((blob) => {
      if (!blob) {
        resolve(canvas.toDataURL('image/jpeg', quality));
        return;
      }
      readFileAsDataUrl(blob).then(resolve).catch(() => resolve(canvas.toDataURL('image/jpeg', quality)));
    }, 'image/jpeg', quality);
  });
  const loadImageElementForUpload = (file) => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('photo_decode_failed'));
    };
    image.src = url;
  });
  const loadImageForUpload = async (file) => {
    const createBitmap = typeof window.createImageBitmap === 'function'
      ? window.createImageBitmap.bind(window)
      : (typeof createImageBitmap === 'function' ? createImageBitmap : null);
    if (createBitmap) {
      try {
        return await createBitmap(file, { imageOrientation: 'from-image' });
      } catch (_) {
        try {
          return await createBitmap(file);
        } catch (_) {
          // Fall back to HTMLImageElement decoding below.
        }
      }
    }
    return await loadImageElementForUpload(file);
  };
  const preparePhotoUpload = async (file) => {
    const originalType = String(file && file.type || 'image/jpeg').toLowerCase();
    if (originalType === 'image/gif') {
      return {
        filename: file.name || 'upload.gif',
        mimeType: originalType,
        base64Data: await readFileAsDataUrl(file),
      };
    }
    let image = null;
    let canvas = null;
    try {
      image = await loadImageForUpload(file);
      const width = Number(image.naturalWidth || image.width || 0);
      const height = Number(image.naturalHeight || image.height || 0);
      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw new Error('photo_decode_failed');
      const scale = Math.min(1, PHOTO_UPLOAD_MAX_EDGE / Math.max(width, height));
      const targetWidth = Math.max(1, Math.round(width * scale));
      const targetHeight = Math.max(1, Math.round(height * scale));
      canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('photo_canvas_unavailable');
      context.drawImage(image, 0, 0, targetWidth, targetHeight);
      if (image && typeof image.close === 'function') image.close();
      image = null;
      const base64Data = await canvasToJpegDataUrl(canvas, PHOTO_UPLOAD_JPEG_QUALITY);
      const safeName = String(file.name || 'upload.jpg').replace(/\.[A-Za-z0-9]+$/, '') || 'upload';
      return {
        filename: safeName + '.jpg',
        mimeType: 'image/jpeg',
        base64Data,
        facePrivacy: { detector: 'server_async_face_privacy', status: 'pending', faceCount: 0, error: null },
      };
    } catch (_) {
      return {
        filename: file.name || 'upload.jpg',
        mimeType: file.type || 'image/jpeg',
        base64Data: await readFileAsDataUrl(file),
        facePrivacy: { detector: 'server_async_face_privacy', status: 'pending', faceCount: 0, error: 'photo_canvas_fallback' },
      };
    } finally {
      if (image && typeof image.close === 'function') image.close();
      if (canvas) { canvas.width = 1; canvas.height = 1; }
    }
  };
`;
