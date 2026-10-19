import { invalid } from './api-errors';

// Server-side check for images sent as data URLs (logo, watermark, personnel photos).
const SIGNATURES: Array<{ mime: string; test: (b: Buffer) => boolean }> = [
  { mime: 'image/png', test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: 'image/jpeg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/webp', test: (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP' },
];

export function decodeImage(dataUrl: string, maxBytes: number, field = 'image'): { mime: string; data: Buffer } {
  const m = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) throw invalid('Upload a JPG, PNG or WebP image.', { [field]: 'Not an image.' });
  const data = Buffer.from(m[2], 'base64');
  if (data.length > maxBytes) throw invalid(`The image is larger than ${Math.round(maxBytes / 1024)} KB.`, { [field]: 'Too large.' });
  const sig = SIGNATURES.find((s) => s.test(data));
  if (!sig) throw invalid('That file is not a valid image.', { [field]: 'Not an image.' });
  return { mime: sig.mime, data };
}
