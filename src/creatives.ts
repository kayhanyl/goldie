/**
 * Geometry for the App Store creative assets (iOS 27 / iPadOS 27): the
 * product page header, the search results asset and the universal asset.
 * Pure, like layouts.ts: render.ts draws exactly what composeCreative returns.
 *
 * Every asset reads left to right, as Apple's templates do: the copy block in
 * the left of the safe box, one to three framed captures fanned on the right.
 * The universal asset is cropped by the App Store to the header's 21:9 and the
 * search results' 3:2, so it composes inside its safe box (CREATIVES), which
 * survives both crops; the other two compose on their whole canvas.
 */
import { FRAME, type FrameGeometry } from "./frame.ts";
import type { Rect } from "./layouts.ts";
import { CREATIVES, type CreativeKey } from "./specs.ts";

/** Type for the copy block, sized from the safe box (not a tile width, as on screenshots). */
export const CREATIVE_TYPE = {
  /** Headline size: this fraction of the safe box height, capped by `headlineOfWidth` of its width. */
  headlineOfHeight: 0.095,
  headlineOfWidth: 0.042,
  headlineWeight: 700,
  headlineLineHeight: 1.08,
  headlineTracking: -0.012,
  /** Subhead size as a fraction of the headline size. */
  subheadRatio: 0.46,
  subheadWeight: 400,
  subheadLineHeight: 1.3,
  /** Space between headline and subhead, as a fraction of the headline size. */
  gap: 0.45,
} as const;

/** Copy column and device stage, as fractions of the safe box. */
const COPY = { left: 0.05, width: 0.4 } as const;
const STAGE = { left: 0.47, right: 0.97, top: 0.05, bottom: 0.95 } as const;

/**
 * Device placements by capture count, back to front. `dx` offsets the centre
 * by base device widths, `scale` sizes against the base device, `index` is the
 * position in the asset's scene list (the centre device shows the first).
 */
const FANS: Record<
  1 | 2 | 3,
  Array<{ dx: number; scale: number; rotate: number; index: number }>
> = {
  1: [{ dx: 0, scale: 1, rotate: 0, index: 0 }],
  2: [
    { dx: 0.36, scale: 0.92, rotate: 5, index: 1 },
    { dx: -0.36, scale: 1, rotate: -3, index: 0 },
  ],
  3: [
    { dx: -0.66, scale: 0.84, rotate: -7, index: 1 },
    { dx: 0.66, scale: 0.84, rotate: 7, index: 2 },
    { dx: 0, scale: 1, rotate: 0, index: 0 },
  ],
};

export type CreativeComposition = {
  width: number;
  height: number;
  /** The box every element stays in; the whole canvas except on the universal asset. */
  safe: Rect;
  copy: { box: Rect; headlineSize: number; subheadSize: number };
  devices: Array<{
    frame: Rect;
    screen: Rect & { radius: number };
    rotate: number;
    /** Index into the asset's scene list. */
    index: number;
  }>;
};

/** Half extents of a w x h box rotated by `deg` (its axis-aligned bounding box). */
function rotatedHalf(w: number, h: number, deg: number) {
  const r = (Math.abs(deg) * Math.PI) / 180;
  return {
    x: (w * Math.cos(r) + h * Math.sin(r)) / 2,
    y: (h * Math.cos(r) + w * Math.sin(r)) / 2,
  };
}

export function composeCreative(
  key: CreativeKey,
  count: number,
  opts: { geom?: FrameGeometry; screenOnly?: boolean } = {},
): CreativeComposition {
  if (count < 1 || count > 3) throw new Error(`A creative shows 1 to 3 captures, not ${count}.`);
  const spec = CREATIVES[key];
  const geom = opts.geom ?? FRAME;
  const sw = spec.safe?.width ?? spec.width;
  const sh = spec.safe?.height ?? spec.height;
  const safe: Rect = {
    left: (spec.width - sw) / 2,
    top: (spec.height - sh) / 2,
    width: sw,
    height: sh,
  };

  const headlineSize = Math.min(
    sh * CREATIVE_TYPE.headlineOfHeight,
    sw * CREATIVE_TYPE.headlineOfWidth,
  );
  const copy = {
    box: { left: safe.left + sw * COPY.left, top: safe.top, width: sw * COPY.width, height: sh },
    headlineSize,
    subheadSize: headlineSize * CREATIVE_TYPE.subheadRatio,
  };

  const art = opts.screenOnly
    ? { width: geom.screen.width, height: geom.screen.height, screen: { x: 0, y: 0 } }
    : { width: geom.width, height: geom.height, screen: geom.screen };
  const stage: Rect = {
    left: safe.left + sw * STAGE.left,
    top: safe.top + sh * STAGE.top,
    width: sw * (STAGE.right - STAGE.left),
    height: sh * (STAGE.bottom - STAGE.top),
  };

  // Size the base device so the whole fan, rotation included, fits the stage.
  const fan = FANS[count as 1 | 2 | 3];
  const unitW = art.width / art.height; // base height 1
  let halfW = 0;
  let halfH = 0;
  for (const p of fan) {
    const half = rotatedHalf(unitW * p.scale, p.scale, p.rotate);
    halfW = Math.max(halfW, Math.abs(p.dx) * unitW + half.x);
    halfH = Math.max(halfH, half.y);
  }
  const baseH = Math.min(stage.height / (2 * halfH), stage.width / (2 * halfW));
  const baseW = baseH * unitW;
  const cx = stage.left + stage.width / 2;
  const cy = stage.top + stage.height / 2;

  const devices = fan.map((p) => {
    const scale = (baseH * p.scale) / art.height;
    const width = art.width * scale;
    const height = art.height * scale;
    const left = cx + p.dx * baseW - width / 2;
    const top = cy - height / 2;
    return {
      frame: { left, top, width, height },
      screen: {
        left: left + art.screen.x * scale,
        top: top + art.screen.y * scale,
        width: geom.screen.width * scale,
        height: geom.screen.height * scale,
        radius: geom.screenRadius * scale,
      },
      rotate: p.rotate,
      index: p.index,
    };
  });

  return { width: spec.width, height: spec.height, safe, copy, devices };
}
