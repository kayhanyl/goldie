/**
 * Store asset specifications.
 * iOS: App Store Connect, developer.apple.com/help/app-store-connect/reference/
 *   screenshot-specifications | app-preview-specifications. Verified 2026-08-24;
 *   iPhone 6.3" and iPhone Duo added 2026-10-06.
 * Android: Play Console help, "Add preview assets". Phone screenshots are
 *   PNG/JPEG, 16:9 or 9:16, each side 320-3840px for promotional eligibility.
 *   Play accepts no video uploads: the promo video is a YouTube link, so the
 *   android preview renders at a YouTube-friendly size for the user to post
 *   themselves, with no store constraints enforced.
 */

export type DeviceKey =
  | "iphone-6.9"
  | "iphone-6.3"
  | "iphone-duo"
  | "iphone-duo-outer"
  | "ipad-13"
  | "pixel-10-pro";

/**
 * The studio's device-type tabs. Finer than the platform: iPhones and iPads
 * share the App Store pipeline but are shown apart.
 */
export type DeviceType = "iphone" | "ipad" | "android";

export type DeviceSpec = {
  /**
   * Display label for the studio and logs. Output paths use the DeviceKey,
   * so raw/, screenshots/ and previews/ all share one naming scheme.
   */
  label: string;
  platform: "ios" | "android";
  type: DeviceType;
  /**
   * `xcrun simctl` device type name; the toolkit picks the newest runtime that
   * has it. iOS only - android resolves a running emulator's adb serial instead.
   */
  simulatorName?: string;
  /**
   * Accepted AVD hardware profiles (`hw.device.name` in the AVD's config.ini),
   * in boot-preference order. Android only - a running emulator qualifies only
   * when its profile is listed, so captures always come from the intended
   * screen geometry. Every profile in the list must share that geometry.
   */
  avdDeviceNames?: string[];
  /**
   * Native capture resolution, portrait. null accepts the device's native
   * capture size as-is (Android emulators vary).
   */
  native: { width: number; height: number } | null;
  /** Required screenshot upload size, portrait. */
  screenshot: { width: number; height: number };
  /**
   * Preview video render size, portrait. On iOS this is the upload size Apple
   * requires; on android it is the size of the YouTube video the user posts
   * themselves (Play takes no video uploads). null: no preview pipeline.
   */
  preview: { width: number; height: number } | null;
  /** Render bare screens with the drop shadow instead of a bezel. */
  screenOnly?: true;
  /**
   * Headline and subhead size relative to the reference column's type. A tile
   * much wider than the 6.9" reference composes in a narrow column, whose type
   * reads small across the full tile. Default 1.
   */
  copyScale?: number;
  /**
   * Size devices from the reference column instead of the real tile. A tile
   * wider than its bezel art (the iPhone on the Duo's near-4:3 tiles) would
   * otherwise grow the device past the tile's height; the iPad's own art is
   * wide enough not to need it.
   */
  columnDevices?: true;
  /**
   * Devices whose raw captures this one can render, in preference order. A
   * device with no simulator (the iPhone Duo: none ships) always renders one
   * of them; a device with a simulator renders its own unless the config's
   * `captureFrom` points it at one of these (see captureSource in capture.ts).
   */
  rendersFrom?: DeviceKey[];
};

export const DEVICES: Record<DeviceKey, DeviceSpec> = {
  "iphone-6.9": {
    label: "6.9",
    platform: "ios",
    type: "iphone",
    simulatorName: "iPhone 17 Pro Max",
    native: { width: 1320, height: 2868 },
    screenshot: { width: 1320, height: 2868 },
    preview: { width: 886, height: 1920 },
  },
  // Dynamic Island (medium display). App Store Connect only requires it when
  // no 6.9" set is uploaded, but a native set is sharper than the downscale.
  // Its screen has the 6.9" aspect, so 6.9" captures render it 1:1
  // (captureFrom) when a flow is coordinate-driven and recorded on one size.
  "iphone-6.3": {
    label: "6.3",
    platform: "ios",
    type: "iphone",
    simulatorName: "iPhone 17 Pro",
    native: { width: 1206, height: 2622 },
    screenshot: { width: 1206, height: 2622 },
    preview: { width: 886, height: 1920 },
    rendersFrom: ["iphone-6.9"],
  },
  // iPhone Duo, the inner (unfolded) display. No Duo simulator ships, so it
  // renders iPhone captures in the iPhone bezel on its own wider tile, the way
  // the iPad tile composes. Apple publishes no Duo preview size yet.
  "iphone-duo": {
    label: "Duo",
    platform: "ios",
    type: "iphone",
    copyScale: 1.3,
    columnDevices: true,
    native: null,
    screenshot: { width: 2007, height: 2853 },
    preview: null,
    rendersFrom: ["iphone-6.9", "iphone-6.3"],
  },
  /** iPhone Duo, the outer (folded) display. */
  "iphone-duo-outer": {
    label: "Duo outer",
    platform: "ios",
    type: "iphone",
    copyScale: 1.3,
    columnDevices: true,
    native: null,
    screenshot: { width: 1398, height: 2034 },
    preview: null,
    rendersFrom: ["iphone-6.9", "iphone-6.3"],
  },
  "ipad-13": {
    label: "13",
    platform: "ios",
    type: "ipad",
    simulatorName: "iPad Pro 13-inch (M4)",
    copyScale: 1.3,
    native: { width: 2064, height: 2752 },
    screenshot: { width: 2064, height: 2752 },
    preview: { width: 1200, height: 1600 },
  },
  // Framed with the bundled Pixel 10 Pro art (src/frame.ts), not the config's
  // frame variant, which is iPhone art with iPhone geometry. The Pixel 9 Pro
  // shares the 1280x2856 screen, so its emulator captures compose identically.
  "pixel-10-pro": {
    label: "Play phone",
    platform: "android",
    type: "android",
    avdDeviceNames: ["pixel_10_pro", "pixel_9_pro"],
    native: null,
    screenshot: { width: 1080, height: 1920 },
    // Near the 1280x2856 Pixel screen's aspect, so the cover-crop trims only a
    // sliver; YouTube accepts any portrait size.
    preview: { width: 1080, height: 2400 },
  },
};

export const DEVICE_KEYS = Object.keys(DEVICES) as DeviceKey[];

export function isDeviceKey(key: string): key is DeviceKey {
  return key in DEVICES;
}

/**
 * Preview constraints Apple enforces at upload time. Both platforms encode
 * with these settings; the duration and file-size bounds apply on iOS only
 * (the android video goes to YouTube, which imposes none that matter here).
 */
export const PREVIEW = {
  fps: 30,
  minSeconds: 15,
  maxSeconds: 30,
  /** Apple asks for 10-12 Mbps VBR on H.264. */
  videoBitrate: "11M",
  audioBitrate: "256k",
  audioSampleRate: 48000,
  maxBytes: 500 * 1024 * 1024,
} as const;

/** Screenshots may not carry an alpha channel. */
export const SCREENSHOT_PIXEL_FORMAT = "rgb24";

/**
 * App Store creative assets, shown on iOS 27 / iPadOS 27 and later: the
 * product page header, the search results asset, and the universal asset
 * that serves as both. Sizes are the canvases of Apple's templates
 * (developer.apple.com/app-store/asset-best-practices, the
 * creative_assets-*_template-static.psd files), read 2026-10-06.
 */
export type CreativeKey = "header" | "search-results" | "universal";

export type CreativeSpec = {
  label: string;
  width: number;
  height: number;
  /**
   * Centred box that survives every crop the App Store takes from the asset.
   * The universal asset is cropped to the header's 21:9 and to the search
   * results' 3:2, so its key content stays inside both: 4425 x 2248 of the
   * 5244 x 2950 canvas. Absent: the whole canvas is safe.
   */
  safe?: { width: number; height: number };
};

export const CREATIVES: Record<CreativeKey, CreativeSpec> = {
  header: { label: "Product page header", width: 3840, height: 1646 },
  "search-results": { label: "Search results", width: 3840, height: 2560 },
  universal: {
    label: "Universal",
    width: 5244,
    height: 2950,
    safe: {
      width: Math.round(2950 * (3840 / 2560)),
      height: Math.round(5244 / (3840 / 1646)),
    },
  },
};

export const CREATIVE_KEYS = Object.keys(CREATIVES) as CreativeKey[];

export function isCreativeKey(key: string): key is CreativeKey {
  return key in CREATIVES;
}
