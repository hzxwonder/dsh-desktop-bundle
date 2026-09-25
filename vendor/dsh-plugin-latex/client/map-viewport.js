export const clampScale = (scale) => Math.max(0.08, Math.min(2.4, scale));

// Keep the same document point under the pointer while changing magnification.
export function zoomAt(view, scale, point) {
  scale = clampScale(scale);
  const ratio = scale / view.scale;
  return { scale, x: point.x - (point.x - view.x) * ratio, y: point.y - (point.y - view.y) * ratio };
}

export function fitMap(width, height, areaWidth, areaHeight) {
  const scale = clampScale(Math.min(1.2, Math.max(1, areaWidth - 64) / width, Math.max(1, areaHeight - 96) / height));
  return { scale, x: (areaWidth - width * scale) / 2, y: (areaHeight - height * scale) / 2 };
}
