/** 2560px WebP-first upload policy shared by browser photo entries. No network writes. */
export const PHOTO_UPLOAD_PREPARATION_SCRIPT = String.raw`
  const PHOTO_UPLOAD_MAX_EDGE = 2560;
  const PHOTO_UPLOAD_QUALITY = 0.88;
  const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('file_read_failed'));
    reader.readAsDataURL(file);
  });
  const canvasToImageDataUrl = (canvas, mimeType) => new Promise((resolve, reject) => {
    const fallback = () => {
      try { resolve(canvas.toDataURL(mimeType, PHOTO_UPLOAD_QUALITY)); }
      catch (error) { reject(error); }
    };
    if (typeof canvas.toBlob !== 'function') { fallback(); return; }
    try {
      canvas.toBlob((blob) => {
        if (!blob) { fallback(); return; }
        readFileAsDataUrl(blob).then(resolve).catch(fallback);
      }, mimeType, PHOTO_UPLOAD_QUALITY);
    } catch (_) { fallback(); }
  });
  const loadImageElementForUpload = (file) => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('photo_decode_failed')); };
    image.src = url;
  });
  const loadImageForUpload = async (file) => {
    const createBitmap = typeof window.createImageBitmap === 'function'
      ? window.createImageBitmap.bind(window)
      : (typeof createImageBitmap === 'function' ? createImageBitmap : null);
    if (createBitmap) {
      try { return await createBitmap(file, { imageOrientation: 'from-image' }); }
      catch (_) {
        try { return await createBitmap(file); }
        catch (_) { /* Fall back to HTMLImageElement decoding below. */ }
      }
    }
    return await loadImageElementForUpload(file);
  };
  const preparePhotoUpload = async (file) => {
    const originalType = String(file && file.type || 'image/jpeg').toLowerCase();
    if (originalType === 'image/gif') {
      return { filename: file.name || 'upload.gif', mimeType: originalType, base64Data: await readFileAsDataUrl(file) };
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
      let base64Data = await canvasToImageDataUrl(canvas, 'image/webp');
      // Unsupported canvas encoders silently return PNG: never label that data WebP.
      if (!base64Data.startsWith('data:image/webp;base64,') && originalType === 'image/jpeg') {
        base64Data = await canvasToImageDataUrl(canvas, 'image/jpeg');
      }
      const match = /^data:(image\/(?:webp|jpeg|png));base64,([A-Za-z0-9+/]+={0,2})$/.exec(base64Data);
      if (!match) throw new Error('photo_encode_failed');
      const mimeType = match[1];
      const facePrivacy = { detector: 'server_async_face_privacy', status: 'pending', faceCount: 0, error: null };
      const encodedBytes = match[2].length * 3 / 4 - (match[2].endsWith('==') ? 2 : match[2].endsWith('=') ? 1 : 0);
      // Keep an already smaller original only when the existing dimension limit is met.
      // The server's existing privacy/metadata checks still control every public derivative.
      if (scale === 1 && file.size > 0 && file.size <= encodedBytes && /^image\/(?:jpeg|png|webp|avif)$/.test(originalType)) {
        return { filename: file.name || 'upload', mimeType: originalType, base64Data: await readFileAsDataUrl(file), facePrivacy };
      }
      const extension = mimeType === 'image/webp' ? 'webp' : mimeType === 'image/png' ? 'png' : 'jpg';
      const safeName = String(file.name || 'upload').replace(/\.[A-Za-z0-9]+$/, '') || 'upload';
      return { filename: safeName + '.' + extension, mimeType, base64Data, facePrivacy };
    } catch (_) {
      return {
        filename: file.name || 'upload.jpg', mimeType: file.type || 'image/jpeg',
        base64Data: await readFileAsDataUrl(file),
        facePrivacy: { detector: 'server_async_face_privacy', status: 'pending', faceCount: 0, error: 'photo_canvas_fallback' },
      };
    } finally {
      if (image && typeof image.close === 'function') image.close();
      if (canvas) { canvas.width = 1; canvas.height = 1; }
    }
  };
`;
