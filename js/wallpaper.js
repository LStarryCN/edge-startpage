const DB_NAME = "lstarry-wallpapers-v1";
const STORE_NAME = "wallpapers";
const MAX_WALLPAPER_BYTES = 12 * 1024 * 1024;
const SUPPORTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(mode, action) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const request = action(transaction.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
    transaction.onabort = () => reject(transaction.error);
  });
}

export function validateWallpaperFile(file) {
  if (!file || !SUPPORTED_TYPES.has(file.type)) return "请选择 JPG、PNG 或 WebP 图片。";
  if (file.size > MAX_WALLPAPER_BYTES) return "图片不能超过 12 MB。";
  return "";
}

function componentToHex(value) {
  return Math.round(value).toString(16).padStart(2, "0");
}

export function extractAccentFromPixels(data) {
  let red = 0;
  let green = 0;
  let blue = 0;
  let count = 0;
  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] < 128) continue;
    const brightness = (data[index] + data[index + 1] + data[index + 2]) / 3;
    if (brightness < 20 || brightness > 245) continue;
    red += data[index];
    green += data[index + 1];
    blue += data[index + 2];
    count += 1;
  }
  if (!count) return "#9BAFD0";

  // Blend toward the established blue-gray so extracted colors stay restrained.
  const blend = (value, anchor) => (value / count) * 0.55 + anchor * 0.45;
  const values = [blend(red, 155), blend(green, 175), blend(blue, 208)];
  const average = values.reduce((sum, value) => sum + value, 0) / 3;
  const softened = values.map((value) => Math.min(210, Math.max(112, average + (value - average) * 0.55)));
  return `#${softened.map(componentToHex).join("")}`.toUpperCase();
}

async function analyzeWallpaper(file) {
  const bitmap = await createImageBitmap(file);
  const sample = document.createElement("canvas");
  sample.width = 32;
  sample.height = 32;
  const sampleContext = sample.getContext("2d", { willReadFrequently: true });
  sampleContext.drawImage(bitmap, 0, 0, 32, 32);
  const accent = extractAccentFromPixels(sampleContext.getImageData(0, 0, 32, 32).data);

  const scale = Math.min(1, 320 / bitmap.width, 180 / bitmap.height);
  const thumbnailCanvas = document.createElement("canvas");
  thumbnailCanvas.width = Math.max(1, Math.round(bitmap.width * scale));
  thumbnailCanvas.height = Math.max(1, Math.round(bitmap.height * scale));
  thumbnailCanvas.getContext("2d").drawImage(bitmap, 0, 0, thumbnailCanvas.width, thumbnailCanvas.height);
  bitmap.close();
  const thumbnail = await new Promise((resolve) => thumbnailCanvas.toBlob(resolve, "image/jpeg", 0.78));
  return { accent, thumbnail };
}

export async function importWallpaper(file) {
  const error = validateWallpaperFile(file);
  if (error) throw new Error(error);
  const id = `custom:${crypto.randomUUID()}`;
  const { accent, thumbnail } = await analyzeWallpaper(file);
  await withStore("readwrite", (store) => store.put({ id, blob: file, thumbnail }));
  return {
    id,
    name: file.name.replace(/\.[^.]+$/, "").slice(0, 64) || "自定义壁纸",
    accent,
    type: file.type,
    size: file.size,
    createdAt: Date.now()
  };
}

export function getWallpaperRecord(id) {
  return withStore("readonly", (store) => store.get(id));
}

export function deleteWallpaperRecord(id) {
  return withStore("readwrite", (store) => store.delete(id));
}
