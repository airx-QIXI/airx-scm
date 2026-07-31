import request from './request';

export interface IntegrationSnapshotSummary {
  id: number;
  sourceCacheTime: string | null;
  availableStock: number;
  inTransitStock: number;
  sales30Days: number;
  avgDailySales: number;
  turnoverDays: number | null;
  recommendedRestock: number;
  riskLevel: string;
  syncedAt: string;
}

export interface IntegrationProject {
  id: number;
  externalId: string;
  code?: string;
  sku?: string;
  name: string;
  brand?: string;
  category?: string;
  modelName?: string;
  source: string;
  updatedAt: string;
  latestSnapshot: IntegrationSnapshotSummary | null;
}

export interface IntegrationProjectsResult {
  total: number;
  projects: IntegrationProject[];
}

export interface ProductionRestockSyncParams {
  cachePath?: string;
}

export interface ProductionRestockSyncResult {
  source: string;
  sourceCacheTime: string | null;
  projectCount: number;
  syncedAt: string;
  snapshots: IntegrationSnapshotSummary[];
}

export interface ProjectIdentity {
  externalId: string;
  code?: string;
  sku?: string;
  name: string;
  brand?: string;
  category?: string;
  modelName?: string;
}

export interface InventoryTurnoverProject {
  project: ProjectIdentity;
  metrics: {
    availableStock: number;
    sales30Days: number;
    avgDailySales: number;
    turnoverDays: number | null;
    turnoverRate30Days: number;
    riskLevel: string;
    riskText: string;
  };
}

export interface InventoryWarehouse {
  name: string;
  availableStock: number;
  inTransitStock: number;
  sales30Days: number;
  projectCount: number;
}

export interface InventoryAnalysisProject {
  project: ProjectIdentity;
  summary: {
    availableStock: number;
    factoryStock: number;
    inTransitStock: number;
    sales7Days: number;
    sales30Days: number;
  };
}

export interface RestockReminder {
  project: ProjectIdentity;
  priority: string;
  riskLevel: string;
  riskText: string;
  recommendedRestock: number;
  stockCoverageDays: number | null;
  availableStock: number;
  inTransitStock: number;
  avgDailySales: number;
}

export interface ProductionRestockDashboardsResult {
  generatedAt: string;
  projectCount: number;
  dashboards: {
    inventoryTurnover: {
      title: string;
      summary: {
        projectCount: number;
        avgTurnoverDays: number | null;
        fastRiskCount: number;
        overstockCount: number;
      };
      projects: InventoryTurnoverProject[];
    };
    inventoryAnalysis: {
      title: string;
      summary: {
        projectCount: number;
        availableStock: number;
        inTransitStock: number;
        sales30Days: number;
      };
      warehouses: InventoryWarehouse[];
      projects: InventoryAnalysisProject[];
    };
    restockReminder: {
      title: string;
      summary: {
        reminderCount: number;
        urgentCount: number;
        recommendedRestockTotal: number;
      };
      reminders: RestockReminder[];
    };
  };
}

export function getIntegrationProjects(): Promise<IntegrationProjectsResult> {
  return request.get<IntegrationProjectsResult>('/integrations/projects').then((res) => res.data);
}

export function syncProductionRestock(
  data?: ProductionRestockSyncParams,
): Promise<ProductionRestockSyncResult> {
  return request
    .post<ProductionRestockSyncResult>('/integrations/production-restock/sync', data ?? {})
    .then((res) => res.data);
}

export function getProductionRestockDashboards(): Promise<ProductionRestockDashboardsResult> {
  return request
    .get<ProductionRestockDashboardsResult>('/integrations/production-restock/dashboards')
    .then((res) => res.data);
}

export interface ProductionPlanningDashboardsResult {
  source: string;
  generatedAt: string;
  dashboards: {
    demand: any;
    factorySchedule: any;
    forecastFulfillment: any;
  };
  raw: {
    demand: any;
    factorySchedule: any;
    forecastFulfillment: any;
  };
}

export interface ProductionPlanningSyncResult {
  source: string;
  syncedAt: string;
  demandModels: number;
  factoryModels: number;
  fulfillmentRecords: number;
  dashboards: ProductionPlanningDashboardsResult['dashboards'];
}

export function syncProductionPlanningDashboards(): Promise<ProductionPlanningSyncResult> {
  return request
    .post<ProductionPlanningSyncResult>('/integrations/production-planning/sync', {})
    .then((res) => res.data);
}

export function getProductionPlanningDashboards(): Promise<ProductionPlanningDashboardsResult> {
  return request
    .get<ProductionPlanningDashboardsResult>('/integrations/production-planning/dashboards')
    .then((res) => res.data);
}
