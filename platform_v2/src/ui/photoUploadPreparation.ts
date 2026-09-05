/** 2560px WebP-first policy shared by every browser photo entry. No network writes. */
export const PHOTO_UPLOAD_PREPARATION_SCRIPT = String.raw`
  const PHOTO_UPLOAD_MAX_EDGE = 2560;
  const PHOTO_UPLOAD_WEBP_QUALITY = 0.82;
  const PHOTO_UPLOAD_JPEG_FALLBACK_QUALITY = 0.88;
  const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('file_read_failed'));
    reader.readAsDataURL(file);
  });
  const encodeCanvas = (canvas, mimeType, quality) => new Promise((resolve) => {
    if (!canvas) {
      resolve(null);
      return;
    }
    if (typeof canvas.toBlob !== 'function') {
      try {
        const dataUrl = canvas.toDataURL(mimeType, quality);
        resolve(String(dataUrl || '').startsWith('data:' + mimeType) ? dataUrl : null);
      } catch (_) {
        resolve(null);
      }
      return;
    }
    canvas.toBlob((blob) => {
      if (!blob || String(blob.type || '').toLowerCase() !== mimeType) {
        resolve(null);
        return;
      }
      readFileAsDataUrl(blob)
        .then((dataUrl) => resolve(String(dataUrl || '').startsWith('data:' + mimeType) ? dataUrl : null))
        .catch(() => resolve(null));
    }, mimeType, quality);
  });
  const canvasToPreparedPhoto = async (canvas) => {
    const webp = await encodeCanvas(canvas, 'image/webp', PHOTO_UPLOAD_WEBP_QUALITY);
    if (webp) {
      return { base64Data: webp, mimeType: 'image/webp', extension: '.webp' };
    }
    const jpeg = await encodeCanvas(canvas, 'image/jpeg', PHOTO_UPLOAD_JPEG_FALLBACK_QUALITY);
    if (jpeg) {
      return { base64Data: jpeg, mimeType: 'image/jpeg', extension: '.jpg' };
    }
    const base64Data = canvas.toDataURL('image/jpeg', PHOTO_UPLOAD_JPEG_FALLBACK_QUALITY);
    return { base64Data, mimeType: 'image/jpeg', extension: '.jpg' };
  };
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
      const prepared = await canvasToPreparedPhoto(canvas);
      const safeName = String(file.name || 'upload').replace(/\.[A-Za-z0-9]+$/, '') || 'upload';
      return {
        filename: safeName + prepared.extension,
        mimeType: prepared.mimeType,
        base64Data: prepared.base64Data,
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
