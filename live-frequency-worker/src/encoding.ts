import { ENCODING_SCALE, NOMINAL_FREQUENCY_HZ } from "./constants";

const INT16_MIN = -32768;
const INT16_MAX = 32767;

export function encodeFrequencyHz(frequencyHz: number): number {
  if (!Number.isFinite(frequencyHz)) {
    throw new Error("Frequency must be a finite number");
  }
  const encoded = Math.round((frequencyHz - NOMINAL_FREQUENCY_HZ) * ENCODING_SCALE);
  if (encoded < INT16_MIN || encoded > INT16_MAX) {
    throw new Error(`Encoded frequency is outside signed Int16 range: ${encoded}`);
  }
  return encoded;
}

export function decodeFrequencyValue(encoded: number): number {
  if (!Number.isInteger(encoded) || encoded < INT16_MIN || encoded > INT16_MAX) {
    throw new Error(`Encoded frequency is outside signed Int16 range: ${encoded}`);
  }
  return NOMINAL_FREQUENCY_HZ + encoded / ENCODING_SCALE;
}

export function cloneArrayBuffer(view: ArrayBufferView): ArrayBuffer {
  const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}
