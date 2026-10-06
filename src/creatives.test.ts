import { describe, expect, test } from "bun:test";
import { composeCreative } from "./creatives.ts";
import { compose, LAYOUTS } from "./layouts.ts";
import { CREATIVE_KEYS, CREATIVES, DEVICES } from "./specs.ts";

const EPS = 1e-6;
const inside = (
  r: { left: number; top: number; width: number; height: number },
  box: { left: number; top: number; width: number; height: number },
) =>
  r.left >= box.left - EPS &&
  r.top >= box.top - EPS &&
  r.left + r.width <= box.left + box.width + EPS &&
  r.top + r.height <= box.top + box.height + EPS;

/** Axis-aligned bounds of a frame rotated about its centre. */
function rotatedBounds(
  f: { left: number; top: number; width: number; height: number },
  deg: number,
) {
  const r = (Math.abs(deg) * Math.PI) / 180;
  const w = f.width * Math.cos(r) + f.height * Math.sin(r);
  const h = f.height * Math.cos(r) + f.width * Math.sin(r);
  const cx = f.left + f.width / 2;
  const cy = f.top + f.height / 2;
  return { left: cx - w / 2, top: cy - h / 2, width: w, height: h };
}

describe("creative specs", () => {
  test("canvases match Apple's templates", () => {
    expect(CREATIVES.header).toMatchObject({ width: 3840, height: 1646 });
    expect(CREATIVES["search-results"]).toMatchObject({ width: 3840, height: 2560 });
    expect(CREATIVES.universal).toMatchObject({ width: 5244, height: 2950 });
  });

  test("the universal safe box survives both of Apple's crops", () => {
    const { width, height, safe } = CREATIVES.universal;
    // 21:9 header crop keeps full width, 3:2 search crop keeps full height.
    const headerCropHeight = width / (CREATIVES.header.width / CREATIVES.header.height);
    const searchCropWidth =
      height * (CREATIVES["search-results"].width / CREATIVES["search-results"].height);
    expect(safe!.height).toBeLessThanOrEqual(Math.ceil(headerCropHeight));
    expect(safe!.width).toBeLessThanOrEqual(Math.ceil(searchCropWidth));
    expect(safe).toEqual({ width: 4425, height: 2248 });
  });
});

describe("composeCreative", () => {
  for (const key of CREATIVE_KEYS) {
    for (const count of [1, 2, 3]) {
      test(`${key} with ${count} capture(s) keeps copy and devices in the safe box`, () => {
        const c = composeCreative(key, count);
        expect(c.width).toBe(CREATIVES[key].width);
        expect(c.height).toBe(CREATIVES[key].height);
        expect(c.devices).toHaveLength(count);
        expect(inside(c.copy.box, c.safe)).toBe(true);
        for (const d of c.devices) {
          expect(inside(rotatedBounds(d.frame, d.rotate), c.safe)).toBe(true);
          expect(inside(d.screen, d.frame)).toBe(true);
        }
        // The copy column sits left of every device.
        const copyRight = c.copy.box.left + c.copy.box.width;
        for (const d of c.devices)
          expect(rotatedBounds(d.frame, d.rotate).left).toBeGreaterThan(copyRight);
        // Each scene shows once, the first one front and centre (drawn last).
        expect(c.devices.map((d) => d.index).sort()).toEqual([...Array(count).keys()]);
        expect(c.devices.at(-1)!.index).toBe(0);
      });
    }
  }

  test("universal composes inside its centred safe box", () => {
    const c = composeCreative("universal", 3);
    expect(c.safe.left).toBeCloseTo((5244 - 4425) / 2);
    expect(c.safe.top).toBeCloseTo((2950 - 2248) / 2);
  });

  test("screen-only devices are the bare screen", () => {
    const c = composeCreative("header", 1, { screenOnly: true });
    const d = c.devices[0]!;
    expect(d.screen.width).toBeCloseTo(d.frame.width);
    expect(d.screen.height).toBeCloseTo(d.frame.height);
  });

  test("rejects a capture count outside 1-3", () => {
    expect(() => composeCreative("header", 0)).toThrow();
    expect(() => composeCreative("header", 4)).toThrow();
  });
});

describe("Duo tiles", () => {
  for (const key of ["iphone-duo", "iphone-duo-outer"] as const) {
    test(`${key}: every layout sizes the iPhone as on the 6.9" reference tile (columnDevices)`, () => {
      const tile = DEVICES[key].screenshot;
      const ref = DEVICES["iphone-6.9"].screenshot;
      const theme = { copyHeightRatio: 0.24, deviceWidthRatio: 0.84 };
      for (const spec of Object.values(LAYOUTS)) {
        const duo = compose(spec, tile, theme, {
          copyScale: DEVICES[key].copyScale,
          columnDevices: DEVICES[key].columnDevices,
        });
        const six9 = compose(spec, ref, theme);
        duo.devices.forEach((d, i) => {
          expect(d.frame.height / tile.height).toBeCloseTo(
            six9.devices[i]!.frame.height / ref.height,
            6,
          );
        });
      }
    });
  }

  for (const key of ["iphone-duo", "iphone-duo-outer"] as const) {
    test(`${key}: the classic layout keeps the device inside the tile`, () => {
      const tile = DEVICES[key].screenshot;
      const c = compose(
        LAYOUTS.classic,
        tile,
        { copyHeightRatio: 0.24, deviceWidthRatio: 0.84 },
        {
          copyScale: DEVICES[key].copyScale,
        },
      );
      const f = c.devices[0]!.frame;
      expect(f.left).toBeGreaterThanOrEqual(0);
      expect(f.top).toBeGreaterThanOrEqual(c.copy!.box.height - EPS);
      expect(f.left + f.width).toBeLessThanOrEqual(tile.width + EPS);
      expect(f.top + f.height).toBeLessThanOrEqual(tile.height + EPS);
    });
  }
});
