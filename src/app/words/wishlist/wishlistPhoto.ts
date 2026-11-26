/**
 * Shrinks a parent's photo in the browser before upload (roadmap item U, 2026-11-26): the
 * longest side becomes at most WISHLIST_PHOTO_MAX_SIDE px and it's saved as a JPEG, so a
 * large phone photo uploads quickly and stays under the bucket's 2 MB limit.
 */
import { scaleToFit, WISHLIST_PHOTO_MAX_SIDE } from "@/lib/characterTokens";

const JPEG_QUALITY = 0.85;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The photo could not be read."));
    image.src = url;
  });
}

/** Rejects when the browser can't read the file (e.g. a format it doesn't support). */
export async function compressWishlistPhoto(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    const { width, height } = scaleToFit(image.naturalWidth, image.naturalHeight, WISHLIST_PHOTO_MAX_SIDE);
    if (width === 0 || height === 0) throw new Error("The photo has no size.");
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is not available.");
    // JPEG has no transparency: paint a white backdrop first so transparent PNGs don't turn black.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("The photo could not be encoded."))), "image/jpeg", JPEG_QUALITY);
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
