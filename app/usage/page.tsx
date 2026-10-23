"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Card, Col, Progress, Row, Spin, Statistic, Table } from "antd";
import {
  ClockCircleOutlined,
  ThunderboltOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { apiFetch } from "@/lib/api-fetch";

interface UsageSummary {
  today: {
    calls: number;
    chatCalls: number;
    workflowCalls: number;
    inputTokens: number;
    outputTokens: number;
    avgLatencyMs: number;
  };
  limits: { perUser: number; global: number; globalUsed: number };
  cost: { input: number; output: number; total: number } | null;
  days: Array<{ date: string; calls: number }>;
}

export default function UsagePage() {
  const [data, setData] = useState<UsageSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/usage");
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "加载失败");
        return;
      }
      setData(json);
    } catch {
      setError("加载失败，请检查网络");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !data) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spin />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Alert type="error" showIcon title="加载失败" description={error} />
      </div>
    );
  }

  if (!data) return null;

  const { today, limits, cost, days } = data;
  const usedPercent = Math.min(
    100,
    Math.round((today.calls / Math.max(1, limits.perUser)) * 100)
  );
  const globalPercent = Math.min(
    100,
    Math.round((limits.globalUsed / Math.max(1, limits.global)) * 100)
  );
  const maxDay = Math.max(1, ...days.map((d) => d.calls));
  const remaining = Math.max(0, limits.perUser - today.calls);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-4 py-6">
        <h1 className="text-lg font-semibold mb-1">用量与配额</h1>
        <p className="text-xs text-zinc-500 mb-5">
          按北京时间自然日统计，每天 00:00 重置。配额是为了控制演示成本，
          用尽后第二天自动恢复。
        </p>

        {remaining === 0 && (
          <Alert
            className="mb-4"
            type="warning"
            showIcon
            icon={<WarningOutlined />}
            title="今日额度已用尽"
            description="明天 00:00 后重置，期间仍可浏览历史对话和知识库。"
          />
        )}

        <Row gutter={[12, 12]}>
          <Col xs={12} md={6}>
            <Card size="small">
              <Statistic
                title="今日调用"
                value={today.calls}
                suffix={`/ ${limits.perUser}`}
              />
              <Progress
                percent={usedPercent}
                showInfo={false}
                size="small"
                status={usedPercent >= 100 ? "exception" : "active"}
                className="!mt-1"
              />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card size="small">
              <Statistic
                title="剩余额度"
                value={remaining}
                suffix="次"
                prefix={<ThunderboltOutlined />}
              />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card size="small">
              <Statistic
                title="今日 token"
                value={today.inputTokens + today.outputTokens}
                prefix={<span className="text-xs text-zinc-400">≈</span>}
              />
              <div className="text-[11px] text-zinc-400 mt-1">
                输入 {today.inputTokens} / 输出 {today.outputTokens}
              </div>
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card size="small">
              <Statistic
                title="平均响应"
                value={today.avgLatencyMs ? (today.avgLatencyMs / 1000).toFixed(1) : "-"}
                suffix="s"
                prefix={<ClockCircleOutlined />}
              />
              <div className="text-[11px] text-zinc-400 mt-1">
                对话 {today.chatCalls} · 工作流 {today.workflowCalls}
              </div>
            </Card>
          </Col>
        </Row>

        <Card size="small" title="全站今日额度" className="mt-4">
          <div className="flex items-center gap-3">
            <Progress
              percent={globalPercent}
              status={globalPercent >= 100 ? "exception" : "active"}
              className="!mb-0 flex-1"
            />
            <span className="text-xs text-zinc-500 whitespace-nowrap">
              {limits.globalUsed} / {limits.global} 次
            </span>
          </div>
          <div className="text-[11px] text-zinc-400 mt-2">
            所有用户共享这个上限，达到后当天不再接受新的问答请求。
          </div>
        </Card>

        {cost && (
          <Card size="small" title="今日估算成本" className="mt-4">
            <Statistic
              value={cost.total}
              precision={4}
              prefix="¥"
              valueStyle={{ fontSize: 20 }}
            />
            <div className="text-[11px] text-zinc-400 mt-1">
              输入 ¥{cost.input.toFixed(4)} + 输出 ¥{cost.output.toFixed(4)}
              ，按环境变量中的单价估算
            </div>
          </Card>
        )}

        <Card size="small" title="最近 7 天" className="mt-4">
          {days.length === 0 ? (
            <div className="text-xs text-zinc-400 py-2">还没有调用记录</div>
          ) : (
            <Table
              size="small"
              pagination={false}
              rowKey="date"
              dataSource={days}
              columns={[
                { title: "日期", dataIndex: "date", width: 90 },
                {
                  title: "调用次数",
                  dataIndex: "calls",
                  width: 90,
                },
                {
                  title: "",
                  dataIndex: "calls",
                  render: (calls: number) => (
                    <Progress
                      percent={Math.round((calls / maxDay) * 100)}
                      showInfo={false}
                      size="small"
                      className="!mb-0"
                    />
                  ),
                },
              ]}
            />
          )}
        </Card>
      </div>
    </div>
  );
}
