import exifr from 'exifr';
import { detectImageType } from './utils.js';

export enum Orientation {
  Horizontal = 1,
  MirrorHorizontal = 2,
  Rotate180 = 3,
  MirrorVertical = 4,
  MirrorHorizontalAndRotate270CW = 5,
  Rotate90CW = 6,
  MirrorHorizontalAndRotate90CW = 7,
  Rotate270CW = 8,
}

export interface Rotation {
  deg: number;
  rad: number;
  scaleX: number;
  scaleY: number;
  dimensionSwapped: boolean;
  css: boolean;
  canvas: boolean;
}

export async function getImageOrientation(buffer: ArrayBuffer): Promise<Orientation | undefined> {
  try {
    return await exifr.orientation(buffer);
  } catch (error) {
    console.warn('[@pdfme/converter] Failed to read EXIF orientation:', error);
    return undefined;
  }
}

export async function getImageRotation(buffer: ArrayBuffer): Promise<Rotation | undefined> {
  try {
    return await exifr.rotation(buffer);
  } catch (error) {
    console.warn('[@pdfme/converter] Failed to read EXIF rotation:', error);
    return undefined;
  }
}

interface Environment {
  applyRotation: (buffer: ArrayBuffer, rotation: Rotation) => Promise<ArrayBuffer>;
  dataURLToArrayBuffer: (dataURL: string) => ArrayBuffer;
}

export async function normalizeImageOrientation(
  buffer: ArrayBuffer,
  env: Environment,
): Promise<ArrayBuffer> {
  const { applyRotation } = env;

  try {
    const type = detectImageType(buffer);

    if (type !== 'jpeg') {
      return buffer;
    }

    const orientation = await getImageOrientation(buffer);
    if (!orientation || orientation === Orientation.Horizontal) {
      return buffer;
    }

    const rotation = await getImageRotation(buffer);
    if (!rotation) {
      return buffer;
    }

    const normalizedBuffer = await applyRotation(buffer, rotation);

    return normalizedBuffer;
  } catch (error) {
    console.warn('[@pdfme/converter] Failed to normalize image orientation:', error);
    return buffer;
  }
}
