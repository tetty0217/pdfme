import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf';
// @ts-expect-error - PDFJSWorker import is not properly typed but required for functionality
import PDFJSWorker from 'pdfjs-dist/legacy/build/pdf.worker.js';
import { createCanvas, loadImage } from 'canvas';
import { pdf2img as _pdf2img, Pdf2ImgOptions } from './pdf2img.js';
import { pdf2size as _pdf2size, Pdf2SizeOptions } from './pdf2size.js';
import { img2pdf as _img2pdf, Img2PdfOptions } from './img2pdf.js';
import { normalizeImageOrientation as _normalizeImageOrientation } from './normalizeImageOrientation.js';
import { detectImageType } from './utils.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJSWorker as unknown as string;

export const arrayBufferToDataURL = (buffer: ArrayBuffer): Promise<string> => {
  const type = detectImageType(buffer);
  const mimeType = type === 'jpeg' ? 'image/jpeg' : 'image/png';
  const base64String = Buffer.from(buffer).toString('base64');
  const dataUrl = `data:${mimeType};base64,${base64String}`;

  return Promise.resolve(dataUrl);
};

export const dataURLToArrayBuffer = (dataURL: string): ArrayBuffer => {
  const base64String = dataURL.split(',')[1];
  const buffer = Buffer.from(base64String, 'base64');

  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
};

export const pdf2img = async (
  pdf: ArrayBuffer | Uint8Array,
  options: Pdf2ImgOptions = {},
): Promise<ArrayBuffer[]> =>
  _pdf2img(pdf, options, {
    getDocument: (pdf) => pdfjsLib.getDocument({ data: pdf, isEvalSupported: false }).promise,
    createCanvas: (width, height) => createCanvas(width, height) as unknown as HTMLCanvasElement,
    canvasToArrayBuffer: (canvas) => {
      // Using a more specific type for the canvas from the 'canvas' package
      const nodeCanvas = canvas as unknown as import('canvas').Canvas;
      // Get buffer from the canvas - using the synchronous version without parameters
      // This will use the default PNG format
      const buffer = nodeCanvas.toBuffer();
      // Convert to ArrayBuffer
      return new Uint8Array(buffer).buffer;
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
    applyRotation: async (buffer, rotation) => {
      const nodeBuffer = Buffer.from(buffer);
      const img = await loadImage(nodeBuffer);

      const canvasWidth = rotation.dimensionSwapped ? img.height : img.width;
      const canvasHeight = rotation.dimensionSwapped ? img.width : img.height;

      const canvas = createCanvas(canvasWidth, canvasHeight);
      const ctx = canvas.getContext('2d');

      // Set the origin at the center of the canvas.
      ctx.translate(canvasWidth / 2, canvasHeight / 2);

      ctx.rotate(rotation.rad);
      ctx.scale(rotation.scaleX, rotation.scaleY);

      ctx.drawImage(img, -img.width / 2, -img.height / 2);

      const newBuffer = canvas.toBuffer('image/jpeg');
      const arrayBuffer = new ArrayBuffer(newBuffer.byteLength);
      const view = new Uint8Array(arrayBuffer);
      view.set(newBuffer);

      return arrayBuffer;
    },
    dataURLToArrayBuffer: dataURLToArrayBuffer,
  });
