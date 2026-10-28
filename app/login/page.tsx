"use client";

import { useState } from "react";
import { Alert, Button, Card, Form, Input, Typography } from "antd";
import { LockOutlined, MailOutlined } from "@ant-design/icons";
import { DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/demo";

/**
 * 登录页
 * 本版不开放注册，只提供演示账号（邮箱和密码均已预填，直接点登录即可）。
 * 预填密码的前提是每用户/全站都有调用配额，不怕被动消耗 token。
 */
export default function LoginPage() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (values: { email: string; password: string }) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "登录失败");
        return;
      }
      // 整页跳转，确保布局按登录态重新渲染
      window.location.href = "/";
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-full flex items-center justify-center px-4 py-10">
      <Card className="w-full max-w-sm shadow-sm">
        <Typography.Title level={4} className="!mb-1">
          知识库问答
        </Typography.Title>
        <Typography.Paragraph type="secondary" className="!mb-4 !text-xs">
          登录后使用 RAG 问答与文档管理
        </Typography.Paragraph>

        {error && (
          <Alert type="error" showIcon title={error} className="mb-3" />
        )}

        <Form
          layout="vertical"
          requiredMark={false}
          onFinish={handleSubmit}
          initialValues={{ email: DEMO_EMAIL, password: DEMO_PASSWORD }}
        >
          <Form.Item
            name="email"
            label="邮箱"
            rules={[
              { required: true, message: "请输入邮箱" },
              { type: "email", message: "邮箱格式不正确" },
            ]}
          >
            <Input
              prefix={<MailOutlined />}
              placeholder="you@example.com"
              autoComplete="username"
            />
          </Form.Item>

          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, message: "请输入密码" }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="请输入密码"
            />
          </Form.Item>

          <Button type="primary" htmlType="submit" block loading={submitting}>
            登录
          </Button>
        </Form>

        <Alert
          className="mt-4"
          type="info"
          showIcon
          title="演示账号（已自动填入，直接点登录）"
          description={`${DEMO_EMAIL} / ${DEMO_PASSWORD}`}
        />
      </Card>
    </div>
  );
}
