import type { MedicationInfo } from "./types";

/** AI 응답이 placeholder 수준인지 판별 (확실한 DB 매칭이 아님). */
export function isLowConfidenceMedicationInfo(
  info: MedicationInfo,
  query: string,
): boolean {
  if (info.category === "확인 필요") return true;
  if (/약사\s*확인|확인\s*필요|알\s*수\s*없/i.test(info.description)) return true;

  const nq = query.replace(/\s+/g, "").toLowerCase();
  const nn = info.name.replace(/\s+/g, "").toLowerCase();
  if (
    nn === nq &&
    info.aliases.length === 0 &&
    info.avoidFoods.length === 0 &&
    info.category === "확인 필요"
  ) {
    return true;
  }
  return false;
}
