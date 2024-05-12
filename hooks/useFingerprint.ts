"use client";

import { useEffect, useState } from "react";
import {
  getFingerprint,
  getFingerprintData,
  setOption,
} from "@thumbmarkjs/thumbmarkjs";

interface componentInterface {
  [key: string]: string | string[] | number | boolean | componentInterface;
}

setOption("exclude", ["screen.mediaMatches", "permissions"]);

export function useFingerprint() {
  const [fingerprint, setFingerprint] = useState("");

  useEffect(() => {
    getFingerprint()
      .then((result) => {
        setFingerprint(result as string);
      })
      .catch((error) => {
        console.error("Error getting fingerprint:", error);
      });
  }, []);

  return fingerprint;
}

export function useFingerprintDetails() {
  const [fingerprintDetails, setFingerprintDetails] = useState<
    fingerprintDetails | undefined
  >(undefined);

  useEffect(() => {
    getFingerprintData()
      .then((result) => {
        setFingerprintDetails(result as fingerprintDetails);
      })
      .catch((error) => {
        console.error("Error getting fingerprint:", error);
      });
  }, []);

  return fingerprintDetails;
}

type Audio = {
  sampleHash?: number;
  oscillator?: string;
  maxChannels?: number;
  channelCountMode?: string;
};

type Fonts = {
  [fontName: string]: number | undefined;
};

type Videocard = {
  vendor?: string;
  renderer?: string;
  version?: string;
  shadingLanguageVersion?: string;
};

type System = {
  platform?: string;
  cookieEnabled?: boolean;
  productSub?: string;
  product?: string;
  useragent?: string;
  browser?: {
    name?: string;
    version?: string;
  };
  applePayVersion?: number;
};

type Plugins = {
  plugins?: string[];
};

type Screen = {
  is_touchscreen?: boolean;
  maxTouchPoints?: number;
  colorDepth?: number;
};

type Hardware = {
  videocard?: Videocard;
  architecture?: number;
  deviceMemory?: string;
  jsHeapSizeLimit?: number;
};

type Locales = {
  languages?: string;
  timezone?: string;
};

type WebGL = {
  commonImageHash?: string;
};

type MathData = {
  acos?: number;
  asin?: number;
  atan?: number;
  cos?: number;
  cosh?: number;
  e?: number;
  largeCos?: number;
  largeSin?: number;
  largeTan?: number;
  log?: number;
  pi?: number;
  sin?: number;
  sinh?: number;
  sqrt?: number;
  tan?: number;
  tanh?: number;
};

export type fingerprintDetails = {
  audio: Audio;
  canvas: { commonImageDataHash?: string };
  fonts: Fonts;
  hardware: Hardware;
  locales: Locales;
  plugins: Plugins;
  screen: Screen;
  system: System;
  webgl: WebGL;
  math: MathData;
};
