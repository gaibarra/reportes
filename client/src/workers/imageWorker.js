// imageWorker.js
// Runs in a WebWorker context. Receives messages with { id, file, maxWidth, quality }
// and responds with { id, success, blob, error }.

self.onmessage = async (e) => {
  const { id, file, maxWidth = 1024, quality = 0.6 } = e.data || {};
  try {
    if (!file) throw new Error('No file');

    // createImageBitmap works in workers and is efficient
    const bitmap = await createImageBitmap(file);
    const ratio = bitmap.width / bitmap.height || 1;
    const targetWidth = Math.min(maxWidth, bitmap.width);
    const targetHeight = Math.round(targetWidth / ratio);

    // OffscreenCanvas is required to draw in worker
    if (typeof OffscreenCanvas === 'undefined') throw new Error('OffscreenCanvas not supported');
    const canvas = new OffscreenCanvas(targetWidth, targetHeight);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);

    // convert to blob (JPEG)
    let blob;
    if (canvas.convertToBlob) {
      blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
    } else if (canvas.toBlob) {
      // older impl
      blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
    } else {
      throw new Error('Canvas toBlob not supported in worker');
    }

    self.postMessage({ id, success: true, blob });
  } catch (err) {
    self.postMessage({ id, success: false, error: String(err) });
  }
};
