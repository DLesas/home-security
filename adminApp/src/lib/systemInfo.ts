import si from 'systeminformation';

export interface MemoryInfo {
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
  swapTotal: number;
  swapUsed: number;
  swapFree: number;
}

export interface CpuInfo {
  manufacturer: string;
  brand: string;
  architecture: string;
  cores: {
    physical: number;
    logical: number;
  };
  speed: {
    min: number;
    max: number;
    current: number;
  };
  virtualization: boolean;
  virtualizationType?: string;
}

export interface PlatformInfo {
  platform: NodeJS.Platform;
  distro?: string;
  release?: string;
  arch: string;
  hostname: string;
  kernel: string;
  uptime: number;
}

export interface GpuInfo {
  controllers: Array<{
    vendor: string;
    model: string;
    vram?: number;
    driverVersion?: string;
  }>;
  displays: Array<{
    vendor: string;
    model: string;
    resolutionX: number;
    resolutionY: number;
  }>;
}

/**
 * Gets detailed system memory information.
 * @returns An object containing total, free, used, and swap memory information.
 */
export async function getMemoryInfo(): Promise<MemoryInfo> {
  const mem = await si.mem();
  return {
    totalBytes: mem.total,
    freeBytes: mem.free,
    usedBytes: mem.used,
    swapTotal: mem.swaptotal,
    swapUsed: mem.swapused,
    swapFree: mem.swapfree,
  };
}

/**
 * Gets detailed CPU information including virtualization support.
 * @returns An object containing CPU details including architecture, cores, speed, and virtualization status.
 */
export async function getCpuInfo(): Promise<CpuInfo> {
  const [cpu, cpuFlags] = await Promise.all([
    si.cpu(),
    si.cpuFlags()
  ]);

  return {
    manufacturer: cpu.manufacturer,
    brand: cpu.brand,
    architecture: process.arch,
    cores: {
      physical: cpu.physicalCores,
      logical: cpu.cores,
    },
    speed: {
      min: cpu.speedMin,
      max: cpu.speedMax,
      current: cpu.speed,
    },
    virtualization: cpu.virtualization,
    virtualizationType: cpuFlags.includes('vmx') ? 'Intel VT-x' : cpuFlags.includes('svm') ? 'AMD-V' : undefined,
  };
}

/**
 * Gets detailed operating system platform information.
 * @returns An object containing platform details including distribution, release, and system information.
 */
export async function getPlatformInfo(): Promise<PlatformInfo> {
  const [os, system, time] = await Promise.all([
    si.osInfo(),
    si.system(),
    si.time()
  ]);

  return {
    platform: os.platform as NodeJS.Platform,
    distro: os.distro,
    release: os.release,
    arch: os.arch,
    hostname: os.hostname,
    kernel: os.kernel,
    uptime: time.uptime || 0,
  };
}

/**
 * Gets detailed GPU and display information.
 * @returns An object containing GPU controllers and display information.
 */
export async function getGpuInfo(): Promise<GpuInfo> {
  const graphics = await si.graphics();

  return {
    controllers: graphics.controllers.map(controller => ({
      vendor: controller.vendor,
      model: controller.model,
      vram: controller.vram || undefined,
      driverVersion: controller.driverVersion,
    })),
    displays: graphics.displays.map(display => ({
      vendor: display.vendor,
      model: display.model,
      resolutionX: display.resolutionX || 0,
      resolutionY: display.resolutionY || 0,
    })),
  };
}

/**
 * Gets virtualization support information.
 * @returns An object containing virtualization support details.
 */
export async function getVirtualizationInfo(): Promise<{
  supported: boolean;
  type?: string;
  enabled: boolean;
}> {
  const cpuFlags = await si.cpuFlags();
  const isSupported = cpuFlags.includes('vmx') || cpuFlags.includes('svm');
  
  return {
    supported: isSupported,
    type: cpuFlags.includes('vmx') ? 'Intel VT-x' : cpuFlags.includes('svm') ? 'AMD-V' : undefined,
    enabled: isSupported && (cpuFlags.includes('vmx') || cpuFlags.includes('svm')),
  };
}

/**
 * Gets comprehensive system information.
 * @returns An object containing all system information.
 */
export async function getAllSystemInfo() {
  const [memory, cpu, platform, gpu, virtualization] = await Promise.all([
    getMemoryInfo(),
    getCpuInfo(),
    getPlatformInfo(),
    getGpuInfo(),
    getVirtualizationInfo(),
  ]);

  return {
    memory,
    cpu,
    platform,
    gpu,
    virtualization,
  };
}

// You could add more functions here for other characteristics like hostname (os.hostname()), uptime (os.uptime()), etc. 