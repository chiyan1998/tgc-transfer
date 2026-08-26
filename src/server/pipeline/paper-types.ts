/**
 * 论文类型分类学（design/data-model.md §2 paper_briefs）：
 * 五分类、非互斥、多标签。定义注入系统提示词，保证分类一致性。
 */
export const PAPER_TYPES = {
  quant_empirical: "量化实证：用统计/计量方法分析经验数据检验假设",
  qualitative: "质性研究：访谈、案例、民族志、扎根理论等非数值化方法",
  model: "模型：构建数学/理论/计算模型推导或模拟现象",
  methodology: "方法论研究：提出或改进研究方法、算法、测量工具",
  theory: "理论研究：概念框架、综述、理论命题构建与批判",
} as const;

export type PaperType = keyof typeof PAPER_TYPES;

export const PAPER_TYPE_KEYS = Object.keys(PAPER_TYPES) as PaperType[];

export function paperTypesPromptBlock(): string {
  return PAPER_TYPE_KEYS.map((k) => `- ${k}: ${PAPER_TYPES[k]}`).join("\n");
}

export function paperTypeLabel(key: string): string {
  const labels: Record<string, string> = {
    quant_empirical: "量化实证",
    qualitative: "质性研究",
    model: "模型",
    methodology: "方法论",
    theory: "理论研究",
  };
  return labels[key] ?? key;
}
