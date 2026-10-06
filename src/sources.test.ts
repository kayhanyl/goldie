import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { captureLocales, captureSource, capturesItself, rawDirFor } from "./capture.ts";
import { artDevice, variantDevices } from "./config.ts";
import { DEVICES } from "./specs.ts";

const outDir = "/tmp/app/goldie/out";

describe("captureSource", () => {
  test("a device with a simulator renders its own captures", () => {
    const cfg = { devices: ["iphone-6.9", "iphone-6.3"] as const };
    expect(captureSource({ devices: [...cfg.devices] }, "iphone-6.3")).toBe("iphone-6.3");
    expect(capturesItself({ devices: ["iphone-6.9"] }, "iphone-6.9")).toBe(true);
  });

  test("the Duo has no simulator, so it renders the first listed iPhone that captures", () => {
    expect(captureSource({ devices: ["iphone-6.9", "iphone-duo"] }, "iphone-duo")).toBe(
      "iphone-6.9",
    );
    expect(captureSource({ devices: ["iphone-6.3", "iphone-duo-outer"] }, "iphone-duo-outer")).toBe(
      "iphone-6.3",
    );
    // 6.3 renders 6.9 here, so the Duo skips it and takes 6.9 directly.
    const chained = {
      devices: ["iphone-6.3", "iphone-6.9", "iphone-duo"] as Array<
        "iphone-6.3" | "iphone-6.9" | "iphone-duo"
      >,
      captureFrom: { "iphone-6.3": "iphone-6.9" } as const,
    };
    expect(captureSource(chained, "iphone-duo")).toBe("iphone-6.9");
  });

  test("captureFrom points a device at another device's captures", () => {
    const cfg = {
      devices: ["iphone-6.9", "iphone-6.3"] as Array<"iphone-6.9" | "iphone-6.3">,
      captureFrom: { "iphone-6.3": "iphone-6.9" } as const,
    };
    expect(captureSource(cfg, "iphone-6.3")).toBe("iphone-6.9");
    expect(capturesItself(cfg, "iphone-6.3")).toBe(false);
    // Raw captures, and their per-locale split, follow the source.
    expect(rawDirFor({ ...cfg, outDir }, "iphone-6.3", "en-US")).toBe(
      join(outDir, "raw", "iphone-6.9"),
    );
    expect(rawDirFor({ ...cfg, outDir, localizedCaptures: true }, "iphone-6.3", "en-US")).toBe(
      join(outDir, "raw", "iphone-6.9", "en-US"),
    );
    expect(
      captureLocales({ ...cfg, locales: ["en-US", "tr"], localizedCaptures: true }, "iphone-6.3"),
    ).toEqual(["en-US", "tr"]);
  });

  test("rejects a source the device cannot render, or one nothing captures", () => {
    expect(() =>
      captureSource(
        { devices: ["iphone-6.9", "ipad-13"], captureFrom: { "ipad-13": "iphone-6.9" } },
        "ipad-13",
      ),
    ).toThrow(/cannot render iphone-6.9/);
    expect(() =>
      captureSource(
        { devices: ["iphone-6.3"], captureFrom: { "iphone-6.3": "iphone-6.9" } },
        "iphone-6.3",
      ),
    ).toThrow(/add "iphone-6.9" to devices/);
    expect(() => captureSource({ devices: ["iphone-duo"] }, "iphone-duo")).toThrow(
      /has no simulator/,
    );
  });
});

describe("devices", () => {
  test("new iPhone sizes match App Store Connect's screenshot table", () => {
    expect(DEVICES["iphone-6.3"].screenshot).toEqual({ width: 1206, height: 2622 });
    expect(DEVICES["iphone-duo"].screenshot).toEqual({ width: 2007, height: 2853 });
    expect(DEVICES["iphone-duo-outer"].screenshot).toEqual({ width: 1398, height: 2034 });
    expect(DEVICES["iphone-duo"].simulatorName).toBeUndefined();
  });

  test("the 17 Pro bezel art dresses every iPhone, and only iPhones", () => {
    expect(artDevice("iphone-duo")).toBe("iphone-6.9");
    expect(artDevice("ipad-13")).toBe("ipad-13");
    expect(variantDevices("17-pro-blue")).toEqual([
      "iphone-6.9",
      "iphone-6.3",
      "iphone-duo",
      "iphone-duo-outer",
    ]);
    expect(variantDevices("ipad-pro-13-silver")).toEqual(["ipad-13"]);
  });
});
