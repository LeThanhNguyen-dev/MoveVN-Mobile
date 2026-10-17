export function inspectionImageUrl(original: string) {
  try {
    const url = new URL(original);
    return url.protocol === "https:" && url.hostname === "res.cloudinary.com"
      ? original.replace("/image/upload/", "/image/upload/e_trim:10:white/") : original;
  } catch { return original; }
}
