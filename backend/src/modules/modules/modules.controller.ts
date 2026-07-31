import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ModulesService, type ModuleConfig, type ModuleStatus } from './modules.service';

/**
 * 模块注册表控制器
 * 提供模块列表查询、单个模块详情、模块注册/状态更新接口
 */
@Controller('modules')
export class ModulesController {
  constructor(private readonly modulesService: ModulesService) {}

  /**
   * 获取模块注册表概要（含所有模块列表）
   * GET /api/modules
   */
  @Get()
  getRegistry() {
    return this.modulesService.getRegistry();
  }

  /**
   * 获取导航可见的模块列表（排除 disabled）
   * GET /api/modules/nav
   */
  @Get('nav')
  getNavModules() {
    return this.modulesService.getNavModules();
  }

  /**
   * 按 ID 获取单个模块详情
   * GET /api/modules/:id
   */
  @Get(':id')
  getModuleById(@Param('id') id: string) {
    return this.modulesService.getModuleById(id);
  }

  /**
   * 注册新模块或更新已有模块
   * POST /api/modules
   */
  @Post()
  upsertModule(@Body() body: ModuleConfig) {
    return this.modulesService.upsertModule(body);
  }

  /**
   * 更新模块状态（active / pending / disabled）
   * PATCH /api/modules/:id/status
   */
  @Patch(':id/status')
  updateModuleStatus(@Param('id') id: string, @Body('status') status: ModuleStatus) {
    return this.modulesService.updateModuleStatus(id, status);
  }
}
