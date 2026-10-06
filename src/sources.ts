import type { LoadedConfig } from "./config.ts";
import { DEVICES, type DeviceKey } from "./specs.ts";

export type SourceConfig = Partial<Pick<LoadedConfig, "captureFrom" | "devices">>;

/**
 * The device whose raw captures a device renders: itself, unless the config's
 * `captureFrom` names one of its `rendersFrom` devices, or it has no simulator
 * of its own (the iPhone Duo), in which case it takes the first of those that
 * the config lists and that captures for itself. Throws on a source the
 * device cannot render or that is not in `devices` (nothing would capture it).
 */
export function captureSource(cfg: SourceConfig, deviceKey: DeviceKey): DeviceKey {
  const spec = DEVICES[deviceKey];
  const devices = cfg.devices ?? [];
  const chosen = cfg.captureFrom?.[deviceKey];
  if (chosen !== undefined && chosen !== deviceKey) {
    if (!spec.rendersFrom?.includes(chosen)) {
      const allowed = spec.rendersFrom?.join(", ") ?? "none, it captures for itself";
      throw new Error(
        `captureFrom: ${deviceKey} cannot render ${chosen}'s captures (it renders: ${allowed}).`,
      );
    }
    if (!devices.includes(chosen)) {
      throw new Error(
        `captureFrom: ${deviceKey} renders ${chosen}'s captures, so add "${chosen}" to devices.`,
      );
    }
    if (captureSource(cfg, chosen) !== chosen) {
      throw new Error(
        `captureFrom: ${chosen} renders another device's captures itself; point ${deviceKey} at that device.`,
      );
    }
    return chosen;
  }
  if (spec.simulatorName || spec.avdDeviceNames) return deviceKey;
  const source = spec.rendersFrom?.find((d) => devices.includes(d) && captureSource(cfg, d) === d);
  if (!source) {
    throw new Error(
      `${deviceKey} has no simulator; it renders the captures of ${spec.rendersFrom?.join(" or ")}. Add one of them to devices.`,
    );
  }
  return source;
}

/** Whether a device replays the flows itself (false: it renders another device's captures). */
export function capturesItself(cfg: SourceConfig, deviceKey: DeviceKey): boolean {
  return captureSource(cfg, deviceKey) === deviceKey;
}
