import * as pdfjsLib from 'pdfjs-dist';
import { pdf2img as _pdf2img, Pdf2ImgOptions } from './pdf2img.js';
import { normalizeImageOrientation as _normalizeImageOrientation } from './normalizeImageOrientation.js';
import { pdf2size as _pdf2size, Pdf2SizeOptions } from './pdf2size.js';
import { detectImageType } from './utils.js';
import { img2pdf as _img2pdf, Img2PdfOptions } from './img2pdf.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.js',
  import.meta.url,
).toString();

export const arrayBufferToDataURL = (buffer: ArrayBuffer): Promise<string> => {
  return new Promise((resolve, reject) => {
    const type = detectImageType(buffer);
    const mimeType = type === 'jpeg' ? 'image/jpeg' : 'image/png';

    const blob = new Blob([buffer], { type: mimeType });
    const reader = new FileReader();

    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to File loadend'));
      }
    };

    reader.onerror = () => {
      reject(reader.error ?? new Error('FileReader error'));
    };

    reader.readAsDataURL(blob);
  });
};

export const dataURLToArrayBuffer = (dataURL: string): ArrayBuffer => {
  // Split out the actual base64 string from the data URL scheme
  const base64String = dataURL.split(',')[1];

  // Decode the Base64 string to get the binary data
  const byteString = atob(base64String);

  // Create a typed array from the binary string
  const arrayBuffer = new ArrayBuffer(byteString.length);
  const uintArray = new Uint8Array(arrayBuffer);

  for (let i = 0; i < byteString.length; i++) {
    uintArray[i] = byteString.charCodeAt(i);
  }

  return arrayBuffer;
};

export const pdf2img = async (
  pdf: ArrayBuffer | Uint8Array,
  options: Pdf2ImgOptions = {},
): Promise<ArrayBuffer[]> =>
  _pdf2img(pdf, options, {
    getDocument: (pdf) => pdfjsLib.getDocument({ data: pdf, isEvalSupported: false }).promise,
    createCanvas: (width, height) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      return canvas;
    },
    canvasToArrayBuffer: (canvas, imageType) => {
      // Using type assertion to handle the canvas method
      const dataUrl = (canvas as HTMLCanvasElement).toDataURL(`image/${imageType}`);
      return dataURLToArrayBuffer(dataUrl);
    },
  });

export const pdf2size = async (pdf: ArrayBuffer | Uint8Array, options: Pdf2SizeOptions = {}) =>
  _pdf2size(pdf, options, {
    getDocument: (pdf) => pdfjsLib.getDocument({ data: pdf, isEvalSupported: false }).promise,
  });

export const img2pdf = async (
  imgs: ArrayBuffer[],
  options: Img2PdfOptions = {},
): Promise<ArrayBuffer> =>
  _img2pdf(imgs, options, {
    normalizeImageOrientation: normalizeImageOrientation,
  });

export const normalizeImageOrientation = async (buffer: ArrayBuffer): Promise<ArrayBuffer> =>
  _normalizeImageOrientation(buffer, {
    applyRotation: (buffer, rotation) =>
      new Promise((resolve, reject) => {
        const blob = new Blob([buffer], { type: 'image/jpeg' });
        const url = URL.createObjectURL(blob);
        const img = new Image();

        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              throw new Error('[@pdfme/converter] Failed to get canvas context');
            }

            // Rotation is already applied.
            if (!rotation.canvas) {
              canvas.width = img.width;
              canvas.height = img.height;
              ctx.drawImage(img, 0, 0);
            } else {
              canvas.width = rotation.dimensionSwapped ? img.height : img.width;
              canvas.height = rotation.dimensionSwapped ? img.width : img.height;

              // Set the origin at the center of the canvas.
              ctx.translate(canvas.width / 2, canvas.height / 2);

              ctx.rotate(rotation.rad);
              ctx.scale(rotation.scaleX, rotation.scaleY);

              ctx.drawImage(img, -img.width / 2, -img.height / 2);
            }

            canvas.toBlob((blob) => {
              if (!blob) {
                reject(new Error('[@pdfme/converter] Failed to create blob'));
                return;
              }
              blob.arrayBuffer().then(resolve).catch(reject);
            }, 'image/jpeg');
          } catch {
            reject(new Error('[@pdfme/converter] Failed to draw canvas image'));
          } finally {
            URL.revokeObjectURL(url);
          }
        };

        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error('Failed to load image'));
        };
        img.src = url;
      }),
    dataURLToArrayBuffer: dataURLToArrayBuffer,
  });
