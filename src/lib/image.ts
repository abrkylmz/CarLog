/**
 * Shrinks a photo from the camera or gallery to a JPEG data URL that fits the upload limit (about
 * 1 MB): at most `maxSide` pixels on the long side, lowering the quality further if needed.
 */
export async function compressImage(file: File, maxSide = 1600): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Fotoğraf işlenemedi.");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  for (const quality of [0.82, 0.7, 0.55, 0.4]) {
    const url = canvas.toDataURL("image/jpeg", quality);
    if (url.length <= 1_400_000) return url;
  }
  throw new Error("Fotoğraf çok büyük; daha yakından ya da daha düşük çözünürlükle çekin.");
}
