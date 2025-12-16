function mmToInches(mm) {
  return mm / 25.4;
}

function cmToInches(cm) {
  return cm / 2.54;
}

function inchesToPixels(inches, dpi) {
  return inches * dpi;
}

function toPixels({ value, unit, originalPx, dpi = 96 }) {
  if (value === null || value === undefined || value === '') return undefined;

  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return undefined;

  const normalizedUnit = String(unit || 'px').toLowerCase();

  if (normalizedUnit === 'px') return Math.round(numeric);

  if (normalizedUnit === '%') {
    if (!originalPx || !Number.isFinite(originalPx) || originalPx <= 0) return undefined;
    return Math.round((numeric / 100) * originalPx);
  }

  if (normalizedUnit === 'mm') return Math.round(inchesToPixels(mmToInches(numeric), dpi));
  if (normalizedUnit === 'cm') return Math.round(inchesToPixels(cmToInches(numeric), dpi));
  if (normalizedUnit === 'inch' || normalizedUnit === 'in') return Math.round(inchesToPixels(numeric, dpi));

  return undefined;
}

module.exports = { toPixels };
