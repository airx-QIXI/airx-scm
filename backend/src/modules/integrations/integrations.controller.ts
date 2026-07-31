import { Body, Controller, Get, Post } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';

/**
 * 外部系统集成控制器
 * 提供京东自营补货预测项目识别、同步和看板查询接口
 */
@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  /**
   * 获取已识别项目列表
   * GET /api/integrations/projects
   */
  @Get('projects')
  getProjects() {
    return this.integrationsService.getProjects();
  }

  /**
   * 同步旧项目补货缓存，并生成最新预测看板快照
   * POST /api/integrations/production-restock/sync
   */
  @Post('production-restock/sync')
  syncProductionRestock(@Body() body?: { cachePath?: string }) {
    return this.integrationsService.syncProductionRestock(body?.cachePath);
  }

  /**
   * 获取库存周转、库存分析、补货提醒 3 个预测看板
   * GET /api/integrations/production-restock/dashboards
   */
  @Get('production-restock/dashboards')
  getProductionRestockDashboards() {
    return this.integrationsService.getProductionRestockDashboards();
  }

  /**
   * 同步正确的排产补货预测项目
   * POST /api/integrations/production-planning/sync
   */
  @Post('production-planning/sync')
  syncProductionPlanningDashboards() {
    return this.integrationsService.syncProductionPlanningDashboards();
  }

  /**
   * 获取用户截图对应的 3 个排产补货预测看板
   * GET /api/integrations/production-planning/dashboards
   */
  @Get('production-planning/dashboards')
  getProductionPlanningDashboards() {
    return this.integrationsService.getProductionPlanningDashboards();
  }
}
