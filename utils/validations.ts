import { z } from "zod";
import type { fingerprintDetails } from "../hooks/useFingerprint";
import escape from "validator/es/lib/escape";

// Fingerprint Details Schema

const AudioSchema = z.object({
  sampleHash: z.number().nonnegative().finite().optional(),
  oscillator: z.string().max(255).optional(),
  maxChannels: z.number().nonnegative().finite().int().safe().optional(),
  channelCountMode: z.string().max(255).optional(),
});

const FontsSchema = z.record(z.number().finite().nullable());

const VideocardSchema = z.object({
  vendor: z.string().max(255).optional(),
  renderer: z.string().max(255).optional(),
  version: z.string().max(255).optional(),
  shadingLanguageVersion: z.string().max(255).optional(),
});

const SystemBrowserSchema = z.object({
  name: z.string().max(255).optional(),
  version: z.string().max(255).optional(),
});

const SystemSchema = z.object({
  platform: z.string().max(255).optional(),
  cookieEnabled: z.boolean().optional(),
  productSub: z.string().max(255).optional(),
  product: z.string().max(255).optional(),
  useragent: z.string().max(255).optional(),
  browser: SystemBrowserSchema.optional(),
  applePayVersion: z.number().finite().optional(),
});

const PluginsSchema = z.object({
  plugins: z.array(z.string().max(255)).optional(),
});

const ScreenSchema = z.object({
  is_touchscreen: z.boolean().optional(),
  maxTouchPoints: z.number().nonnegative().finite().int().safe().optional(),
  colorDepth: z.number().nonnegative().finite().int().safe().optional(),
});

const HardwareSchema = z.object({
  videocard: VideocardSchema.optional(),
  architecture: z.number().finite().int().safe().optional(),
  deviceMemory: z.string().max(255).optional(),
  jsHeapSizeLimit: z.number().finite().int().safe().optional(),
});

const LocalesSchema = z.object({
  languages: z.string().max(255).optional(),
  timezone: z.string().max(255).optional(),
});

const WebGLSchema = z.object({
  commonImageHash: z.string().max(255).optional(),
});

const MathDataSchema = z.object({
  acos: z.number().optional(),
  asin: z.number().optional(),
  atan: z.number().optional(),
  cos: z.number().optional(),
  cosh: z.number().optional(),
  e: z.number().optional(),
  largeCos: z.number().optional(),
  largeSin: z.number().optional(),
  largeTan: z.number().optional(),
  log: z.number().optional(),
  pi: z.number().optional(),
  sin: z.number().optional(),
  sinh: z.number().optional(),
  sqrt: z.number().optional(),
  tan: z.number().optional(),
  tanh: z.number().optional(),
});

export const fingerprintDetailsSchema = z.object({
  audio: AudioSchema,
  canvas: z.object({
    commonImageDataHash: z.string().max(255).optional(),
  }),
  fonts: FontsSchema,
  hardware: HardwareSchema,
  locales: LocalesSchema,
  plugins: PluginsSchema,
  screen: ScreenSchema,
  system: SystemSchema,
  webgl: WebGLSchema,
  math: MathDataSchema,
});

// Actual Validation Functions

/**
 * Iterates through an object and escapes all the strings.
 * @param {Object} obj - The object to iterate through.
 * @returns {Object} The object with all the strings escaped.
 */
const iterateEscapeStrings = (obj: any) => {
  const stack: any[] = [{ parent: {}, key: undefined, data: obj }];
  while (stack.length) {
    const { parent, key, data } = stack.pop();
    if (typeof data === "object" && data !== null) {
      parent[key] = Array.isArray(data) ? [] : {};
      for (let k in data) {
        stack.push({ parent: parent[key], key: k, data: data[k] });
      }
    } else if (typeof data === "string") {
      parent[key] = escape(data);
    } else {
      parent[key] = data;
    }
  }
  return obj;
};

/**
 * Validates the fingerprint details string.
 * @param {fingerprintDetails} details - The fingerprint details to validate.
 * @returns {fingerprintDetails} The cleaned validated fingerprint details.
 * @throws {Error} If the validation fails.
 */
export function validateFingerprintDetailsString(details: fingerprintDetails): fingerprintDetails {
  const result = fingerprintDetailsSchema.parse(details);
  return iterateEscapeStrings(result);
}
