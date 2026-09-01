import { randomBytes } from "crypto";

/** Simple collision-resistant id, sortable-ish, no external deps with native binaries. */
export function createId(): string {
  const time = Date.now().toString(36);
  const rand = randomBytes(9).toString("hex");
  return `${time}${rand}`;
}

/** Long random token for public, unauthenticated links (signature links). */
export function createToken(): string {
  return randomBytes(24).toString("base64url");
}
