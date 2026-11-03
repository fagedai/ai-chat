"use client";

import { useState } from "react";
import Link from "next/link";
import { Alert, Button, Card, Form, Input, Typography } from "antd";
import { LockOutlined, MailOutlined } from "@ant-design/icons";

interface RegisterFormValues {
  email: string;
  password: string;
  confirm?: string;
}

/**
 * 注册页
 * 服务端会再次校验邮箱格式与密码强度（lib/auth-validate.ts），
 * 这里的规则只是前端提示，不能作为安全边界。
 */
export default function RegisterPage() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (values: RegisterFormValues) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: values.email, password: values.password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "注册失败");
        return;
      }
      // 注册即登录，整页跳转让布局按登录态重新渲染
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
          创建账号
        </Typography.Title>
        <Typography.Paragraph type="secondary" className="!mb-4 !text-xs">
          注册后即可上传文档、使用 RAG 问答
        </Typography.Paragraph>

        {error && (
          <Alert type="error" showIcon title={error} className="mb-3" />
        )}

        <Form
          layout="vertical"
          requiredMark={false}
          onFinish={handleSubmit}
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
              autoComplete="email"
            />
          </Form.Item>

          <Form.Item
            name="password"
            label="密码"
            rules={[
              { required: true, message: "请输入密码" },
              { min: 8, message: "密码至少 8 位" },
              {
                pattern: /(?=.*[A-Za-z])(?=.*\d)/,
                message: "密码需同时包含字母和数字",
              },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="至少 8 位，含字母和数字"
              autoComplete="new-password"
            />
          </Form.Item>

          <Form.Item
            name="confirm"
            label="确认密码"
            dependencies={["password"]}
            rules={[
              { required: true, message: "请再次输入密码" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("password") === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error("两次输入的密码不一致"));
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="再次输入密码"
              autoComplete="new-password"
            />
          </Form.Item>

          <Button type="primary" htmlType="submit" block loading={submitting}>
            注册
          </Button>
        </Form>

        <div className="mt-4 text-center text-xs">
          已有账号？
          <Link href="/login" className="text-blue-600">
            去登录
          </Link>
        </div>
      </Card>
    </div>
  );
}
