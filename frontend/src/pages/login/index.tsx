import { useState } from 'react';
import { Card, Form, Input, Button, Spin, message } from 'antd';
import {
  UserOutlined,
  LockOutlined,
  InboxOutlined,
  ShoppingCartOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '@/stores/auth';
import { login, type LoginParams } from '@/api/auth';
import './index.css';

const Login = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  // 表单提交：调用登录接口
  const onFinish = async (values: LoginParams) => {
    setLoading(true);
    try {
      const result = await login(values);
      setAuth(result);
      message.success('登录成功');
      navigate('/dashboard');
    } catch {
      // 错误已由 axios 响应拦截器统一提示
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      {/* 左侧品牌展示区 */}
      <div className="login-brand">
        <div className="brand-logo">AIRX</div>
        <div className="brand-title">供应链管理系统</div>
        <div className="brand-desc">
          企业级供应链智能管理平台，覆盖库存、订单、供应商与数据分析全流程，助力企业高效协同。
        </div>
        <div className="brand-features">
          <div className="brand-feature">
            <InboxOutlined className="feature-icon" />
            <span className="feature-text">库存管理</span>
          </div>
          <div className="brand-feature">
            <ShoppingCartOutlined className="feature-icon" />
            <span className="feature-text">订单管理</span>
          </div>
          <div className="brand-feature">
            <BarChartOutlined className="feature-icon" />
            <span className="feature-text">数据分析</span>
          </div>
        </div>
      </div>

      {/* 右侧登录表单区 */}
      <div className="login-form-wrapper">
        <Card className="login-card" variant="borderless">
          <div className="login-title">欢迎登录</div>
          <div className="login-subtitle">请输入您的账号信息</div>
          <Spin spinning={loading}>
            <Form
              name="login"
              size="large"
              onFinish={onFinish}
              autoComplete="off"
              initialValues={{ username: '', password: '' }}
            >
              <Form.Item
                name="username"
                rules={[{ required: true, message: '请输入用户名' }]}
              >
                <Input prefix={<UserOutlined />} placeholder="用户名" />
              </Form.Item>
              <Form.Item
                name="password"
                rules={[{ required: true, message: '请输入密码' }]}
              >
                <Input.Password prefix={<LockOutlined />} placeholder="密码" />
              </Form.Item>
              <Form.Item style={{ marginBottom: 0 }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  block
                  className="login-form-button"
                >
                  登录
                </Button>
              </Form.Item>
            </Form>
          </Spin>
        </Card>
      </div>
    </div>
  );
};

export default Login;
