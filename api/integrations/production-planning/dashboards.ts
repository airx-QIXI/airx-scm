import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sendSuccess, sendError, handlePreflight } from '../../_lib/response';

/**
 * 获取排产补货预测项目看板
 * GET /api/integrations/production-planning/dashboards
 *
 * 注意：此接口在本地开发环境从 JSON 文件读取数据。
 * 在 Vercel 云端部署中，本地文件系统不可用，返回空数据结构。
 * 后续可通过数据库或外部 API 接入数据源。
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req.method, res)) return;

  if (req.method !== 'GET') {
    return sendError(res, '仅支持 GET 请求', 405);
  }

  // 云端部署返回空数据结构，前端页面将显示空状态
  return sendSuccess(res, {
    source: 'cloud-deployment',
    generatedAt: new Date(),
    dashboards: {
      demand: {
        title: '生产需求看板',
        updatedAt: null,
        source: null,
        rules: null,
        summary: {
          total_models: 0,
          high_risk_count: 0,
          suggested_production_models: 0,
          suggested_total_qty: 0,
        },
        riskCounts: [],
        topProduction7d: [],
        topProduction30d: [],
        topProduction61To90d: [],
        items: [],
      },
      factorySchedule: {
        title: '工厂排产看板',
        updatedAt: null,
        source: null,
        rules: null,
        summary: {
          total_models: 0,
          total_demand: 0,
          total_suggested_qty: 0,
          completion_rate: 0,
        },
        weeks: [],
        blocks: [],
      },
      forecastFulfillment: {
        title: '需求与实际出货达成',
        updatedAt: null,
        source: null,
        rules: null,
        summary: {
          recordCount: 0,
          forecastTotal: 0,
          actualTotal: null,
          pendingItems: 0,
          latestStatus: null,
        },
        records: [],
        latest: null,
        items: [],
      },
    },
    raw: {
      demand: null,
      factorySchedule: null,
      forecastFulfillment: null,
    },
  });
}
