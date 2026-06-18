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
  {
    name: "센트롬",
    aliases: ["센트룸", "샌트롬", "centrum", "centrum silver", "센트롬 실버"],
    category: "종합비타민·미네랄",
    description:
      "비타민과 미네랄을 함께 포함한 종합영양제입니다. 제품 구성(철분/칼슘/마그네슘 등)에 따라 흡수에 영향을 받습니다.",
    defaultFrequency: 1,
    foodTiming: "with",
    avoidFoods: [
      {
        food: "커피·차 (복용 직후)",
        reason:
          "탄닌/카페인 성분이 철분 등 일부 미네랄의 흡수를 떨어뜨릴 수 있습니다. 1~2시간 간격을 권장합니다.",
        severity: "medium",
      },
      {
        food: "고섬유질 식품 (복용 직후)",
        reason:
          "식이섬유가 미네랄 흡수를 방해할 수 있습니다. 위가 불편하지 않다면 식사와 함께, 민감하면 시간 간격을 두세요.",
        severity: "low",
      },
    ],
    notes:
      "특정 처방약(갑상선호르몬제, 일부 항생제 등)과는 성분(철분/칼슘) 때문에 '약-약' 상호작용이 더 중요할 수 있어 복용 간격을 약사에게 확인하세요.",
  },
  {
    name: "철분제",
    aliases: ["iron", "ferrous", "페로바", "훼로", "철분"],
    category: "영양제·미네랄",
    description: "철 결핍 예방/치료에 사용됩니다. 흡수에 영향을 받기 쉬운 성분입니다.",
    defaultFrequency: 1,
    foodTiming: "any",
    avoidFoods: [
      {
        food: "커피·차",
        reason: "탄닌 성분이 철분 흡수를 떨어뜨릴 수 있습니다. 1~2시간 간격을 권장합니다.",
        severity: "high",
      },
      {
        food: "우유·요구르트·치즈 (유제품)",
        reason: "칼슘이 철분 흡수를 방해할 수 있습니다. 1~2시간 간격을 권장합니다.",
        severity: "medium",
      },
      {
        food: "고섬유질 식품 (복용 직후)",
        reason: "식이섬유가 흡수를 저해할 수 있습니다. 시간 간격을 두면 도움이 됩니다.",
        severity: "low",
      },
    ],
    notes: "속이 불편하면 식후로 옮기되, 흡수 저하 가능성을 고려해 의사·약사 지시를 우선하세요.",
  },
  {
    name: "칼슘제",
    aliases: ["calcium", "칼슘", "칼슘 보충제"],
    category: "영양제·미네랄",
    description: "골 건강을 위해 복용하는 칼슘 보충제입니다. 일부 약물 흡수에 영향을 줄 수 있습니다.",
    defaultFrequency: 1,
    foodTiming: "with",
    avoidFoods: [
      {
        food: "커피·카페인 음료 (다량)",
        reason: "칼슘 배출 증가 등으로 효과가 떨어질 수 있어 과량 섭취는 피하는 편이 좋습니다.",
        severity: "low",
      },
    ],
    notes: "갑상선호르몬제·일부 항생제 등과는 성분 때문에 복용 간격이 중요할 수 있습니다.",
  },
  {
    name: "마그네슘",
    aliases: ["magnesium", "마그네슘 보충제", "마그네슘제"],
    category: "영양제·미네랄",
    description: "근육 경련, 수면 보조 등 목적으로 복용하는 미네랄 보충제입니다.",
    defaultFrequency: 1,
    foodTiming: "any",
    avoidFoods: [
      {
        food: "알코올 (술)",
        reason: "위장 자극/설사 위험을 높일 수 있어 함께 복용은 피하는 편이 좋습니다.",
        severity: "low",
      },
    ],
    notes: "속이 예민하면 식후 복용이 편할 수 있습니다.",
  },
  {
    name: "프로바이오틱스",
    aliases: ["유산균", "probiotics", "lactobacillus", "비피더스"],
    category: "영양제",
    description: "장 건강을 위해 복용하는 유산균 제품입니다.",
    defaultFrequency: 1,
    foodTiming: "any",
    avoidFoods: [
      {
        food: "뜨거운 음료 (복용 직후)",
        reason: "고온이 균 생존에 불리할 수 있어 미지근한 물과 함께 복용을 권장합니다.",
        severity: "low",
      },
      {
        food: "알코올 (술, 다량)",
        reason: "장 점막 자극으로 효과가 떨어질 수 있습니다.",
        severity: "low",
      },
    ],
    notes: "항생제와 함께 복용 시에는 보통 2시간 이상 간격을 두는 경우가 많습니다(약사 확인 권장).",
  },
  {
    name: "오메가3",
    aliases: ["omega-3", "omega3", "오메가-3", "fish oil", "피쉬오일", "EPA", "DHA"],
    category: "영양제",
    description: "EPA/DHA가 포함된 생선기름 보충제입니다.",
    defaultFrequency: 1,
    foodTiming: "with",
    avoidFoods: [
      {
        food: "알코올 (술, 다량)",
        reason: "위장 자극/출혈 경향(특히 항응고제 복용자) 우려가 있어 과량 음주는 피하는 편이 좋습니다.",
        severity: "low",
      },
    ],
    notes: "출혈 위험 약(항응고제/항혈소판제) 복용 중이면 전문의와 상의하세요.",
  },
  {
    name: "비타민 D",
    aliases: ["vitamin d", "vitaminD", "비타민디", "D3", "cholecalciferol", "콜레칼시페롤"],
    category: "비타민",
    description: "지용성 비타민으로, 흡수에 식사가 영향을 줄 수 있습니다.",
    defaultFrequency: 1,
    foodTiming: "with",
    avoidFoods: [],
    notes: "일반적으로 식사(특히 지방이 포함된 식사)와 함께 복용하면 흡수에 도움이 될 수 있습니다.",
  },
  {
    name: "비타민 C",
    aliases: ["vitamin c", "vitaminC", "비타민씨", "ascorbic acid", "아스코르빈산"],
    category: "비타민",
    description: "수용성 비타민입니다. 위가 예민하면 자극이 있을 수 있습니다.",
    defaultFrequency: 1,
    foodTiming: "any",
    avoidFoods: [
      {
        food: "알코올 (술)",
        reason: "위장 자극이 심해질 수 있어 함께 복용은 피하는 편이 좋습니다.",
        severity: "low",
      },
    ],
    notes: "속이 쓰리면 식후로 옮겨 보세요.",
  },
  {
    name: "밀크시슬",
    aliases: ["milk thistle", "실리마린", "silymarin", "밀크 시슬"],
    category: "영양제",
    description: "간 건강 보조 목적으로 복용하는 성분(실리마린) 기반의 보충제입니다.",
    defaultFrequency: 1,
    foodTiming: "any",
    avoidFoods: [
      {
        food: "알코올 (술)",
        reason: "간 건강을 위해 복용하는 경우가 많아, 음주는 목적과 상충할 수 있습니다.",
        severity: "medium",
      },
    ],
    notes: "복용 중인 처방약이 많다면 약사와 상호작용 가능성을 확인하세요.",
  },
  {
    name: "리라글루타이드 (비만·체중)",
    aliases: [
      "삭센다",
      "saxenda",
      "liraglutide",
      "리라글루타이드",
      "Saxenda",
    ],
    category: "GLP-1 수용체 작용제 (비만·체중관리, 주사)",
    description:
      "비만·체중 관리를 위해 하루 1회 피하 주사로 사용하는 GLP-1 유사체입니다. 식욕 억제와 체중 감량 보조 목적의 처방약입니다.",
    defaultFrequency: 1,
    foodTiming: "any",
    avoidFoods: [
      {
        food: "고지방·과식",
        reason: "구역, 구토, 설사 등 위장 부작용이 심해질 수 있습니다.",
        severity: "medium",
      },
      {
        food: "알코올 (술)",
        reason: "위장 자극과 어지러움이 심해질 수 있으며, 당뇨약과 병용 시 저혈당 위험이 있습니다.",
        severity: "medium",
      },
    ],
    notes:
      "매일 비슷한 시간에 주사합니다. 개봉 전 냉장 보관이 필요합니다. 용량은 의사 지시에 따라 점진적으로 올립니다. 임신·수유 중에는 사용하지 않습니다.",
  },
  {
    name: "세마글루타이드 (비만·체중)",
    aliases: [
      "위고비",
      "wegovy",
      "semaglutide",
      "세마글루타이드",
      "Wegovy",
    ],
    category: "GLP-1 수용체 작용제 (비만·체중관리, 주사)",
    description:
      "비만·체중 관리를 위해 주 1회 피하 주사로 사용하는 GLP-1 유사체입니다. 식욕 조절과 체중 감량을 돕는 처방약입니다.",
    defaultFrequency: 1,
    foodTiming: "any",
    avoidFoods: [
      {
        food: "고지방·과식",
        reason: "구역, 구토, 복부 불편감 등 위장 부작용이 악화될 수 있습니다.",
        severity: "medium",
      },
      {
        food: "알코올 (술)",
        reason: "위장 증상과 어지러움이 심해질 수 있으며, 인슐린·설포닐우레아 등과 병용 시 저혈당에 주의해야 합니다.",
        severity: "medium",
      },
    ],
    notes:
      "매주 같은 요일·비슷한 시간에 주사합니다. 식전·식후와 관계없이 투여 가능합니다. 개봉 전 냉장 보관, 개봉 후 사용 기한을 지키세요. 당뇨 치료용 오젬픽(저용량)과 용도·용량이 다릅니다.",
  },
  {
    name: "티르제파타이드 (비만·체중)",
    aliases: [
      "마운자로",
      "mounjaro",
      "tirzepatide",
      "티르제파타이드",
      "Mounjaro",
      "zepbound",
      "젭바운드",
    ],
    category: "GIP/GLP-1 이중 작용제 (비만·체중관리, 주사)",
    description:
      "비만·체중 관리를 위해 주 1회 피하 주사로 사용하는 GIP·GLP-1 이중 작용제입니다. 식욕 억제와 체중 감량 보조에 쓰입니다.",
    defaultFrequency: 1,
    foodTiming: "any",
    avoidFoods: [
      {
        food: "고지방·과식",
        reason: "구역, 구토, 설사 등 위장 부작용이 두드러질 수 있습니다.",
        severity: "medium",
      },
      {
        food: "알코올 (술)",
        reason: "위장 증상 악화 및 당뇨약 병용 시 저혈당 위험이 있습니다.",
        severity: "medium",
      },
    ],
    notes:
      "매주 같은 날 주사합니다. 용량은 처방에 따라 단계적으로 증량합니다. 개봉 전 냉장 보관이 필요합니다. 췌장염(지속 복통) 증상 시 즉시 진료를 받으세요.",
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
