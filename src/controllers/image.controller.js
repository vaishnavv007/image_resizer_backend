const path = require('path');
const archiver = require('archiver');
const sharp = require('sharp');
const { toPixels } = require('../utils/unitConverter');

// Security: protect against decompression bombs (small compressed images that expand to huge pixel buffers).
// Multer's file size limit alone is not sufficient, so we also cap decoded pixel count.
const MAX_INPUT_PIXELS = 64 * 1000 * 1000;

const PRESETS = {
  instagram_square: { width: 1080, height: 1080 },
  instagram_story: { width: 1080, height: 1920 },
  instagram_portrait: { width: 1080, height: 1350 },
  whatsapp_status: { width: 1080, height: 1920 },
  whatsapp_dp: { width: 640, height: 640 },
  print_a4: { width: 2480, height: 3508 },
  print_letter: { width: 2550, height: 3300 },
};

function safeBaseName(filename) {
  const base = path.parse(filename || 'image').name || 'image';
  return base.replace(/[^a-z0-9._-]/gi, '_');
}

function normalizeFormat(format) {
  const f = String(format || 'jpeg').toLowerCase();
  if (f === 'jpg' || f === 'jpeg') return 'jpeg';
  if (f === 'png') return 'png';
  if (f === 'webp') return 'webp';
  if (f === 'avif') return 'avif';
  if (f === 'heic') return 'heic';
  if (f === 'heif') return 'heif';
  if (f === 'tiff' || f === 'tif') return 'tiff';
  if (f === 'gif') return 'gif';
  return 'jpeg';
}

function mimeTypeForFormat(format) {
  const formatLower = format ? format.toLowerCase() : 'jpeg';
  switch (formatLower) {
    case 'png': return 'image/png';
    case 'webp': return 'image/webp';
    case 'avif': return 'image/avif';
    case 'heif':
    case 'heic': return 'image/heif';
    case 'tiff':
    case 'tif': return 'image/tiff';
    case 'gif': return 'image/gif';
    default: return 'image/jpeg';
  }
}

function getDefaultDpi({ preset, unit }) {
  const u = String(unit || '').toLowerCase();
  const isPhysicalUnit = u === 'mm' || u === 'cm' || u === 'inch' || u === 'in';
  const p = String(preset || '').toLowerCase();
  const isPrintPreset = p.startsWith('print_') || p.includes('a4') || p.includes('letter');

  if (p && !isPrintPreset) return 72;

  if (isPrintPreset || isPhysicalUnit) return 300;
  return 72;
}

function parsePositiveNumber(value) {
  if (value === null || value === undefined || value === '') return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validateOptions(options) {
  if (!isPlainObject(options)) return { ok: true };

  const resize = options.resize;
  if (resize !== undefined && !isPlainObject(resize)) {
    return { ok: false, message: 'Invalid resize options' };
  }

  const unit = String(resize?.unit || 'px').toLowerCase();
  const allowedUnits = ['px', '%', 'mm', 'cm', 'inch', 'in'];
  if (resize && resize.unit !== undefined && !allowedUnits.includes(unit)) {
    return { ok: false, message: 'Invalid resize unit' };
  }

  if (resize) {
    if (resize.width !== undefined && resize.width !== '' && parsePositiveNumber(resize.width) === undefined) {
      return { ok: false, message: 'Invalid resize width' };
    }
    if (resize.height !== undefined && resize.height !== '' && parsePositiveNumber(resize.height) === undefined) {
      return { ok: false, message: 'Invalid resize height' };
    }
  }

  if (options.dpi !== undefined && options.dpi !== '' && parsePositiveNumber(options.dpi) === undefined) {
    return { ok: false, message: 'Invalid DPI value' };
  }

  return { ok: true };
}

function getOrientedOriginalDimensions(meta) {
  const width = meta?.width;
  const height = meta?.height;
  const orientation = Number(meta?.orientation);

  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return { width, height };
  }

  if ([5, 6, 7, 8].includes(orientation)) {
    return { width: height, height: width };
  }

  return { width, height };
}

async function processSingleImage({ file, options }) {
  const input = sharp(file.buffer, { failOn: 'none', limitInputPixels: MAX_INPUT_PIXELS });
  const meta = await input.metadata();
  // Sharp reads width/height without applying EXIF orientation; we rotate() later,
  // so compute "original" dimensions as the oriented display size for % and aspect lock.
  const { width: originalWidth, height: originalHeight } = getOrientedOriginalDimensions(meta);

  const preset = options?.preset ? PRESETS[String(options.preset).toLowerCase()] : undefined;
  const requestedDpi = parsePositiveNumber(options?.dpi);
  const rawDpi = requestedDpi || getDefaultDpi({ preset: options?.preset, unit: options?.resize?.unit });
  const dpi = Math.round(Math.max(1, Math.min(1200, rawDpi)));

  let widthPx;
  let heightPx;

  if (preset) {
    widthPx = preset.width;
    heightPx = preset.height;
  } else {
    const resize = options?.resize || {};
    widthPx = toPixels({ value: resize.width, unit: resize.unit, originalPx: originalWidth, dpi });
    heightPx = toPixels({ value: resize.height, unit: resize.unit, originalPx: originalHeight, dpi });

    const lockAspect = Boolean(resize.lockAspect);
    if (lockAspect && originalWidth && originalHeight) {
      if (widthPx && !heightPx) {
        heightPx = Math.round((widthPx / originalWidth) * originalHeight);
      } else if (heightPx && !widthPx) {
        widthPx = Math.round((heightPx / originalHeight) * originalWidth);
      }
    }
  }

  const crop = Boolean(options?.crop);
  const removeMetadata = Boolean(options?.removeMetadata);
  const background = String(options?.background || 'white').toLowerCase();
  const requestedFormat = String(options?.format || 'jpeg').toLowerCase();
  const format = normalizeFormat(requestedFormat);

  const safeBackground = background === 'transparent' ? 'transparent' : 'white';

  // Configure input options based on file type
  const inputOptions = {
    failOn: 'none',
    // Security: never disable Sharp's input pixel limit; it is a core mitigation for decompression-bomb attacks.
    limitInputPixels: MAX_INPUT_PIXELS,
    sequentialRead: true,
    // Higher density for better SVG to raster conversion
    density: Math.round(dpi) * 2
  };

  // Set format-specific input options
  const fileExt = file.originalname.split('.').pop().toLowerCase();
  if (['tif', 'tiff'].includes(fileExt)) {
    inputOptions.tiff = {
      squash: true,
      xres: dpi,
      yres: dpi,
      bitdepth: 8 // Ensure 8-bit depth for better compatibility
    };
  }

  let pipeline = sharp(file.buffer, inputOptions).rotate();

  if (!removeMetadata) {
    pipeline = pipeline.withMetadata({ 
      density: Math.round(dpi),
      // Preserve more metadata for TIFF
      tiff: {
        xres: dpi,
        yres: dpi
      }
    });
  }

  if (widthPx || heightPx) {
    // "cover" needs both dimensions; when only one dimension is provided we fall back to "inside".
    const canCrop = crop && widthPx && heightPx;
    pipeline = pipeline.resize({
      width: widthPx,
      height: heightPx,
      fit: canCrop ? 'cover' : 'inside',
      position: 'centre',
    });
  }

  if (format === 'jpeg') {
    pipeline = pipeline.flatten({ background: '#ffffff' });
  } else if (safeBackground === 'white') {
    pipeline = pipeline.flatten({ background: '#ffffff' });
  }

  const quality = Math.max(1, Math.min(100, Number(options?.quality) || 80));

  if (format === 'jpeg') {
    pipeline = pipeline.jpeg({ quality, mozjpeg: true });
  } else if (format === 'png') {
    pipeline = pipeline.png({ compressionLevel: 9, quality });
  } else if (format === 'webp') {
    pipeline = pipeline.webp({ quality });
  } else if (format === 'avif') {
    pipeline = pipeline.avif({ quality });
  } else if (format === 'heif' || format === 'heic') {
    pipeline = pipeline.heif({ 
      quality,
      compression: 'av1',
      lossless: false,
      effort: 4
    });
  } else if (format === 'tiff') {
    pipeline = pipeline.tiff({ 
      quality: Math.min(100, Math.max(1, quality)),
      compression: 'lzw',
      predictor: 'horizontal',
      xres: dpi,
      yres: dpi,
      bitdepth: 8, // Ensure 8-bit depth
      tile: false,
      pyramid: false,
      squash: true
    });
  } else if (format === 'gif') {
    // Convert GIF to PNG for static output
    pipeline = pipeline.png({ compressionLevel: 9, quality });
  }

  const outputFormat = format;
  const outputBuffer = await pipeline.toBuffer();
  
  // Generate appropriate file extension
  let fileExtension = outputFormat;
  if (outputFormat === 'jpeg') {
    // Distinguish between JPG and JPEG based on the user's selection
    fileExtension = requestedFormat === 'jpeg' ? 'jpeg' : 'jpg';
  } else if (outputFormat === 'tiff') {
    fileExtension = 'tif';
  } else if (outputFormat === 'heic') {
    fileExtension = 'heic';
  } else if (outputFormat === 'heif') {
    fileExtension = 'heif';
  }
  
  const outputName = `${safeBaseName(file.originalname)}_processed.${fileExtension}`;

  return { outputBuffer, outputName, format };
}

async function processImages(req, res) {
  try {
    const files = req.files || [];
    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ message: 'No images uploaded' });
    }

    let options = {};
    if (req.body?.options) {
      try {
        options = JSON.parse(req.body.options);
      } catch {
        return res.status(400).json({ message: 'Invalid options JSON' });
      }
    }

    const validation = validateOptions(options);
    if (!validation.ok) {
      return res.status(400).json({ message: validation.message || 'Invalid options' });
    }

    // Single image: return the processed image directly for a "Save as" style download.
    // Batch: keep existing ZIP behavior.
    if (files.length === 1) {
      const { outputBuffer, outputName, format } = await processSingleImage({ file: files[0], options });
      res.setHeader('Content-Type', mimeTypeForFormat(format));
      res.setHeader('Content-Disposition', `attachment; filename="${outputName}"`);
      return res.status(200).send(outputBuffer);
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="processed_images.zip"');

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (err) => {
      if (!res.headersSent) {
        res.status(500).json({ message: 'Failed to create ZIP' });
      }
      res.end();
    });

    archive.pipe(res);

    for (const file of files) {
      const { outputBuffer, outputName } = await processSingleImage({ file, options });
      archive.append(outputBuffer, { name: outputName });
    }

    await archive.finalize();
    return undefined;
  } catch (err) {
    if (!res.headersSent) {
      return res.status(500).json({ message: 'Image processing failed' });
    }
    return undefined;
  }
}

module.exports = { processImages };
