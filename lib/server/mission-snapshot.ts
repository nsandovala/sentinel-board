import fs from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { missionSnapshotSchema, snapshotFreshness, type MissionResponse } from "../mission/snapshot";
const MAX = 256 * 1024;

/** Reads a host-configured projection only. No private store, process execution or caller paths. */
export async function readMissionSnapshot(file = process.env.AMON_MISSIONS_PATH, now = Date.now()): Promise<MissionResponse> {
  if (!file?.trim()) return {status: "unconfigured"};
  try {
    if (!path.isAbsolute(file) || await fs.realpath(file) !== file) return {status: "invalid"};
    const parent = await fs.stat(path.dirname(file));
    if (parent.uid !== process.geteuid?.() || (parent.mode & 0o022) !== 0) return {status: "invalid"};
    const fd = await fs.open(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const stat = await fd.stat();
      if (!stat.isFile() || stat.nlink !== 1 || stat.uid !== process.geteuid?.() || (stat.mode & 0o077) !== 0 || stat.size > MAX) return {status: "invalid"};
      const buffer = Buffer.alloc(MAX + 1);
      // Bounded even if the file grows after fstat. Exporters replace atomically.
      let size = 0;
      while (size < buffer.length) {
        const { bytesRead } = await fd.read(buffer, size, buffer.length - size, null);
        if (!bytesRead) break;
        size += bytesRead;
      }
      if (size > MAX) return {status: "invalid"};
      const snapshot = missionSnapshotSchema.parse(JSON.parse(buffer.subarray(0, size).toString("utf8")));
      const status = snapshotFreshness(snapshot, now);
      return status === "invalid" ? {status} : {status, snapshot};
    } finally { await fd.close(); }
  } catch (e) {
    return {status: (e as NodeJS.ErrnoException).code === "ENOENT" ? "unavailable" : "invalid"};
  }
}
