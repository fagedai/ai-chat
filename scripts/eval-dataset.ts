/**
 * RAG 检索评测集
 *
 * 每条用例基于 test-docs/ 中的真实语料标注：
 *   - expectedFile：答案所在的文档；null 表示知识库中不存在答案，应拒答
 *   - mustContain：命中片段必须同时包含的关键词（chunk 级判定）
 *
 * 新增用例时请确保关键词确实出现在原文中，且能区分正确文档与干扰文档。
 */

export interface EvalCase {
  id: string;
  question: string;
  expectedFile: string | null;
  mustContain?: string[];
}

export const EVAL_CASES: EvalCase[] = [
  // ---- 系统错误码手册 ----
  {
    id: "err-01",
    question: "E-1001 的 HTTP 状态码是什么？",
    expectedFile: "系统错误码手册.md",
    mustContain: ["E-1001", "401"],
  },
  {
    id: "err-02",
    question: "单次批量请求最多允许多少条记录？",
    expectedFile: "系统错误码手册.md",
    mustContain: ["E-2002", "1000"],
  },
  {
    id: "err-03",
    question: "E-9001 数据库连接池默认上限是多少个连接？",
    expectedFile: "系统错误码手册.md",
    mustContain: ["E-9001", "20"],
  },
  {
    id: "err-04",
    question: "专业版的存储配额是多少？",
    expectedFile: "系统错误码手册.md",
    mustContain: ["专业版", "100GB"],
  },

  // ---- 运维故障排查手册 ----
  {
    id: "ops-01",
    question: "P0 级告警的响应时间要求是多久？",
    expectedFile: "运维故障排查手册.md",
    mustContain: ["P0", "5 分钟"],
  },
  {
    id: "ops-02",
    question: "服务 OOM 的短期解决方案是什么？",
    expectedFile: "运维故障排查手册.md",
    mustContain: ["memory limit", "4Gi"],
  },
  {
    id: "ops-03",
    question: "缓存雪崩的短期解决方案是什么？",
    expectedFile: "运维故障排查手册.md",
    mustContain: ["TTL", "随机偏移"],
  },
  {
    id: "ops-04",
    question: "Kafka Consumer Lag 超过多少会触发告警？",
    expectedFile: "运维故障排查手册.md",
    mustContain: ["10000"],
  },

  // ---- 新员工入职手册 ----
  {
    id: "hr-01",
    question: "入职当天需要携带哪些材料？",
    expectedFile: "新员工入职手册.txt",
    mustContain: ["身份证", "离职证明"],
  },
  {
    id: "hr-02",
    question: "入职满 5 年可以享受多少天年假？",
    expectedFile: "新员工入职手册.txt",
    mustContain: ["满5年", "10天"],
  },
  {
    id: "hr-03",
    question: "婚假一共多少天？",
    expectedFile: "新员工入职手册.txt",
    mustContain: ["婚假", "10天"],
  },
  {
    id: "hr-04",
    question: "每位员工每年的培训经费是多少？",
    expectedFile: "新员工入职手册.txt",
    mustContain: ["5000元"],
  },

  // ---- 星辰科技产品介绍 ----
  {
    id: "prod-01",
    question: "星云客服基础版的月费是多少？",
    expectedFile: "星辰科技产品介绍.txt",
    mustContain: ["基础版", "2980"],
  },
  {
    id: "prod-02",
    question: "专业版包含多少个坐席？",
    expectedFile: "星辰科技产品介绍.txt",
    mustContain: ["专业版", "10个坐席"],
  },
  {
    id: "prod-03",
    question: "电商平台案例中客服人力成本降低了多少？",
    expectedFile: "星辰科技产品介绍.txt",
    mustContain: ["40%"],
  },
  {
    id: "prod-04",
    question: "企业级支持的响应时间是多少？",
    expectedFile: "星辰科技产品介绍.txt",
    mustContain: ["15分钟"],
  },

  // ---- 智慧园区技术白皮书 ----
  {
    id: "park-01",
    question: "门禁人脸识别的响应时间是多少？",
    expectedFile: "智慧园区管理系统技术白皮书.txt",
    mustContain: ["300ms"],
  },
  {
    id: "park-02",
    question: "烟感探测器的响应时间要求是多少？",
    expectedFile: "智慧园区管理系统技术白皮书.txt",
    mustContain: ["10秒"],
  },
  {
    id: "park-03",
    question: "能耗基准线模型使用的是什么算法？",
    expectedFile: "智慧园区管理系统技术白皮书.txt",
    mustContain: ["XGBoost"],
  },
  {
    id: "park-04",
    question: "访客二维码的有效期规则是什么？",
    expectedFile: "智慧园区管理系统技术白皮书.txt",
    mustContain: ["前后各30分钟"],
  },

  // ---- 平台架构设计文档 ----
  {
    id: "arch-01",
    question: "第三阶段采用的是什么架构策略？",
    expectedFile: "平台架构设计文档.md",
    mustContain: ["务实的微服务"],
  },
  {
    id: "arch-02",
    question: "订单创建接口的 P99 延迟是多少？",
    expectedFile: "平台架构设计文档.md",
    mustContain: ["350ms"],
  },
  {
    id: "arch-03",
    question: "密码哈希使用的算法和 cost factor 是多少？",
    expectedFile: "平台架构设计文档.md",
    mustContain: ["bcrypt", "12"],
  },
  {
    id: "arch-04",
    question: "灰度发布时新版本先承接多少流量？",
    expectedFile: "平台架构设计文档.md",
    mustContain: ["10%"],
  },

  // ---- 应拒答：知识库中不存在答案 ----
  {
    id: "miss-01",
    question: "公司创始人的生日是哪天？",
    expectedFile: null,
  },
  {
    id: "miss-02",
    question: "智慧园区系统支持区块链存证吗？",
    expectedFile: null,
  },
  {
    id: "miss-03",
    question: "E-5001 错误码代表什么含义？",
    expectedFile: null,
  },
  {
    id: "miss-04",
    question: "新员工入职需要提供体检报告吗？",
    expectedFile: null,
  },
  {
    id: "miss-05",
    question: "星云客服的源代码使用什么开源许可证？",
    expectedFile: null,
  },
  {
    id: "miss-06",
    question: "平台架构文档中 SRE 工程师的月薪是多少？",
    expectedFile: null,
  },
];
