import type { MedicationInfo } from "./types";

/**
 * 흔히 처방되는 약물에 대한 로컬 지식 베이스.
 * 검색은 name + aliases (한/영 모두)로 이루어진다.
 *
 * 주의: 본 데이터는 일반적인 참고용 정보이며, 실제 복약 지시는
 * 반드시 의사 또는 약사의 처방·지도를 따라야 합니다.
 */
export const MEDICATION_DATABASE: MedicationInfo[] = [
  {
    name: "아세트아미노펜",
    aliases: ["타이레놀", "tylenol", "acetaminophen", "paracetamol", "파라세타몰"],
    category: "해열·진통제",
    description: "두통, 발열, 근육통 등에 사용되는 일반 진통제입니다.",
    defaultFrequency: 3,
    foodTiming: "any",
    avoidFoods: [
      {
        food: "알코올 (술)",
        reason: "간 손상 위험이 크게 증가합니다.",
        severity: "high",
      },
    ],
    notes: "공복에도 복용 가능하지만, 위가 약하면 식후 복용을 권장합니다.",
  },
  {
    name: "이부프로펜",
    aliases: ["애드빌", "ibuprofen", "advil", "부루펜", "brufen"],
    category: "비스테로이드성 소염진통제 (NSAIDs)",
    description: "통증, 염증, 발열을 줄이는 NSAID 계열 진통제입니다.",
    defaultFrequency: 3,
    foodTiming: "with",
    avoidFoods: [
      {
        food: "알코올 (술)",
        reason: "위장 출혈 위험이 증가합니다.",
        severity: "high",
      },
      {
        food: "커피·카페인 음료 (다량)",
        reason: "위 자극이 심해질 수 있습니다.",
        severity: "low",
      },
    ],
    notes: "위장 자극을 줄이기 위해 반드시 음식과 함께 또는 식후 복용하세요.",
  },
  {
    name: "아스피린",
    aliases: ["aspirin", "bayer aspirin", "아스파라"],
    category: "항혈소판제·진통제",
    description: "통증·염증 완화 또는 저용량의 경우 혈전 예방에 사용됩니다.",
    defaultFrequency: 1,
    foodTiming: "with",
    avoidFoods: [
      {
        food: "알코올 (술)",
        reason: "위출혈 위험이 크게 증가합니다.",
        severity: "high",
      },
      {
        food: "은행, 마늘 보충제",
        reason: "출혈 경향이 강해질 수 있습니다.",
        severity: "medium",
      },
    ],
    notes: "꼭 식사와 함께 또는 식후에 복용하세요.",
  },
  {
    name: "와파린",
    aliases: ["warfarin", "쿠마딘", "coumadin"],
    category: "항응고제",
    description: "혈전 예방을 위한 항응고제입니다. 식이 관리가 매우 중요합니다.",
    defaultFrequency: 1,
    foodTiming: "any",
    avoidFoods: [
      {
        food: "케일·시금치·브로콜리 (비타민 K 풍부 채소)",
        reason: "비타민 K가 약효를 떨어뜨립니다. 일정한 양을 유지해야 합니다.",
        severity: "high",
      },
      {
        food: "자몽·자몽주스",
        reason: "약물 대사를 방해해 혈중 농도가 비정상적으로 변합니다.",
        severity: "high",
      },
      {
        food: "크랜베리 주스",
        reason: "출혈 위험이 증가합니다.",
        severity: "medium",
      },
      {
        food: "알코올 (술)",
        reason: "출혈 위험과 약효 변동을 모두 일으킵니다.",
        severity: "high",
      },
    ],
    notes: "INR 검사 결과에 따라 용량이 조절됩니다. 자가 판단으로 식단을 급변경하지 마세요.",
  },
  {
    name: "암로디핀",
    aliases: ["amlodipine", "노바스크", "norvasc"],
    category: "혈압강하제 (칼슘채널차단제)",
    description: "고혈압과 협심증 치료에 사용됩니다.",
    defaultFrequency: 1,
    foodTiming: "any",
    avoidFoods: [
      {
        food: "자몽·자몽주스",
        reason: "약물 농도가 비정상적으로 상승해 저혈압·부종 위험이 커집니다.",
        severity: "high",
      },
      {
        food: "감초 (한약재 포함)",
        reason: "혈압 조절을 방해할 수 있습니다.",
        severity: "medium",
      },
    ],
    notes: "매일 같은 시간에 복용하는 것이 효과적입니다.",
  },
  {
    name: "심바스타틴",
    aliases: ["simvastatin", "조코", "zocor"],
    category: "고지혈증 치료제 (스타틴)",
    description: "콜레스테롤 수치를 낮추는 약물입니다.",
    defaultFrequency: 1,
    foodTiming: "any",
    avoidFoods: [
      {
        food: "자몽·자몽주스",
        reason: "약물 농도가 급상승해 근육손상(횡문근융해증) 위험이 커집니다.",
        severity: "high",
      },
      {
        food: "알코올 (술)",
        reason: "간 손상 위험이 증가합니다.",
        severity: "medium",
      },
    ],
    notes: "보통 저녁 또는 취침 전 복용 시 효과가 좋습니다.",
  },
  {
    name: "메트포르민",
    aliases: ["metformin", "글루코파지", "glucophage", "다이아벡스"],
    category: "당뇨병 치료제",
    description: "제2형 당뇨병의 혈당 조절에 사용되는 1차 선택약입니다.",
    defaultFrequency: 2,
    foodTiming: "with",
    avoidFoods: [
      {
        food: "알코올 (술)",
        reason: "젖산산증(Lactic acidosis) 위험이 증가합니다.",
        severity: "high",
      },
      {
        food: "고당분 음료·디저트 (다량)",
        reason: "혈당 조절을 어렵게 합니다.",
        severity: "medium",
      },
    ],
    notes: "위장 부작용을 줄이기 위해 식사와 함께 복용하세요.",
  },
  {
    name: "오메프라졸",
    aliases: ["omeprazole", "프릴로섹", "prilosec", "로섹"],
    category: "위산분비 억제제 (PPI)",
    description: "위식도 역류, 위궤양 등 위산 관련 질환에 사용됩니다.",
    defaultFrequency: 1,
    foodTiming: "before",
    avoidFoods: [
      {
        food: "탄산음료, 매운 음식, 카페인",
        reason: "위산 분비를 자극해 약효를 떨어뜨립니다.",
        severity: "low",
      },
    ],
    notes: "식전 30분~1시간 전 복용이 가장 효과적입니다.",
  },
  {
    name: "레보티록신",
    aliases: ["levothyroxine", "씬지로이드", "synthroid", "씬지록신"],
    category: "갑상선호르몬제",
    description: "갑상선 기능 저하증의 호르몬 보충 치료제입니다.",
    defaultFrequency: 1,
    foodTiming: "before",
    avoidFoods: [
      {
        food: "우유·요구르트·치즈 (칼슘 풍부 식품)",
        reason: "약물 흡수를 60% 이상 떨어뜨립니다.",
        severity: "high",
      },
      {
        food: "커피",
        reason: "흡수를 방해합니다.",
        severity: "high",
      },
      {
        food: "두유·콩 제품",
        reason: "흡수율이 떨어집니다.",
        severity: "medium",
      },
      {
        food: "철분제·칼슘제 보충제",
        reason: "복용 간격을 4시간 이상 두어야 합니다.",
        severity: "high",
      },
    ],
    notes: "기상 직후 공복에 물과 함께 복용하고, 30~60분간 다른 음식을 섭취하지 마세요.",
  },
  {
    name: "시프로플록사신",
    aliases: ["ciprofloxacin", "씨프로", "cipro"],
    category: "항생제 (퀴놀론계)",
    description: "요로감염, 호흡기감염 등에 사용되는 항생제입니다.",
    defaultFrequency: 2,
    foodTiming: "any",
    avoidFoods: [
      {
        food: "우유·요구르트·치즈 (유제품)",
        reason: "칼슘이 약물 흡수를 크게 떨어뜨립니다.",
        severity: "high",
      },
      {
        food: "철분제·칼슘제·제산제",
        reason: "약물 흡수를 방해합니다.",
        severity: "high",
      },
      {
        food: "카페인 (커피·에너지 음료)",
        reason: "카페인 대사가 느려져 부작용이 강해집니다.",
        severity: "medium",
      },
    ],
    notes: "유제품·보충제와는 최소 2시간 간격을 두고 복용하세요.",
  },
  {
    name: "아목시실린",
    aliases: ["amoxicillin", "오구멘틴", "augmentin"],
    category: "항생제 (페니실린계)",
    description: "세균성 감염 치료에 널리 사용되는 항생제입니다.",
    defaultFrequency: 3,
    foodTiming: "any",
    avoidFoods: [
      {
        food: "알코올 (술)",
        reason: "위장 부작용을 악화시키고 간 부담이 커집니다.",
        severity: "medium",
      },
    ],
    notes: "처방받은 기간을 끝까지 복용해야 내성을 막을 수 있습니다.",
  },
  {
    name: "디아제팜",
    aliases: ["diazepam", "발륨", "valium"],
    category: "신경안정제 (벤조디아제핀)",
    description: "불안, 경련, 근육 경직 완화에 사용됩니다.",
    defaultFrequency: 2,
    foodTiming: "any",
    avoidFoods: [
      {
        food: "알코올 (술)",
        reason: "호흡 억제 등 심각한 중추신경 억제가 발생할 수 있습니다.",
        severity: "high",
      },
      {
        food: "자몽·자몽주스",
        reason: "약물 농도가 비정상적으로 상승합니다.",
        severity: "high",
      },
    ],
    notes: "운전 및 기계 조작 시 졸음에 주의하세요.",
  },
  {
    name: "프레드니솔론",
    aliases: ["prednisolone", "솔론도", "solondo", "프레드니손", "prednisone"],
    category: "스테로이드 (코르티코스테로이드)",
    description: "염증, 알레르기, 자가면역 질환 등에 사용되는 강력한 항염증제입니다.",
    defaultFrequency: 1,
    foodTiming: "with",
    avoidFoods: [
      {
        food: "짠 음식 (과량의 나트륨)",
        reason: "부종과 혈압 상승을 악화시킵니다.",
        severity: "medium",
      },
      {
        food: "알코올 (술)",
        reason: "위출혈 위험이 증가합니다.",
        severity: "high",
      },
      {
        food: "자몽·자몽주스",
        reason: "약물 농도가 변동될 수 있습니다.",
        severity: "medium",
      },
    ],
    notes: "임의로 중단하지 말고 의사 지시에 따라 천천히 감량하세요.",
  },
];

const normalize = (s: string) => s.replace(/\s+/g, "").toLowerCase();

export function findMedication(query: string): MedicationInfo | null {
  const q = normalize(query);
  if (!q) return null;

  for (const med of MEDICATION_DATABASE) {
    if (normalize(med.name) === q) return med;
    if (med.aliases.some((alias) => normalize(alias) === q)) return med;
  }
  for (const med of MEDICATION_DATABASE) {
    if (normalize(med.name).includes(q)) return med;
    if (med.aliases.some((alias) => normalize(alias).includes(q))) return med;
  }

  return null;
}
