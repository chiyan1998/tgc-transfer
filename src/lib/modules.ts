/**
 * 模块注册表（design/architecture.md §4）：
 * 导航与模块状态单一事实源；新增模块只改这里。
 */
export interface ModuleDef {
  key: string;
  route: string;
  label: string;
  labelEn: string;
  status: "active" | "planned";
  description: string;
}

export const MODULES: ModuleDef[] = [
  {
    key: "feed",
    route: "/feed",
    label: "文献集市",
    labelEn: "Literature",
    status: "active",
    description: "期刊 / arXiv / NBER 聚合信息流与快速概要",
  },
  {
    key: "conferences",
    route: "/conferences",
    label: "学术会议",
    labelEn: "Conferences",
    status: "planned",
    description: "截稿日期与征稿信息聚合",
  },
  {
    key: "funding",
    route: "/funding",
    label: "基金资助",
    labelEn: "Funding",
    status: "planned",
    description: "基金/助学金/奖学金机会聚合",
  },
  {
    key: "projects",
    route: "/projects",
    label: "项目管理",
    labelEn: "Projects",
    status: "planned",
    description: "工作与研究项目管理（复杂系统，待启动）",
  },
  {
    key: "notes",
    route: "/notes",
    label: "阅读笔记",
    labelEn: "Notes",
    status: "active",
    description: "上传论文正文与附加材料，后续自动生成阅读笔记并写入本地 Obsidian",
  },
];
