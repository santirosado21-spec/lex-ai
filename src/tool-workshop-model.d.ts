/** Public/synthetic workshop recipe ONLY; never an executable plugin or a saved law-firm matter. */
export type WorkshopPrivacy = 'public-or-synthetic' | 'private-local-locked';
export type WorkshopAutomation = 'none' | 'n8n-planned';
export interface WorkshopTool {
  readonly id: string;
  readonly title: string;
  readonly category: string;
  readonly practice: readonly string[];
  readonly summary: string;
  readonly requires: readonly string[];
  readonly privacy: WorkshopPrivacy;
  readonly automation: WorkshopAutomation;
  readonly status: 'simulation-only';
}
export interface WorkshopTemplate {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly modules: readonly string[];
}
export interface WorkshopBlueprint {
  schemaVersion: 1;
  kind: 'rejon.workshop.blueprint';
  templateId: string;
  modules: string[];
  layout: string[];
  mode: 'simulation';
  privacy: 'public-or-synthetic-only';
  integrationsEnabled: false;
}
export const TOOL_CATALOG: readonly WorkshopTool[];
export const TOOL_TEMPLATES: readonly WorkshopTemplate[];
export function getWorkshopTool(toolId: string): WorkshopTool | null;
export function validateBlueprint(raw: unknown): WorkshopBlueprint;
export function buildTemplate(templateId?: string): WorkshopBlueprint;
export function addTool(blueprint: WorkshopBlueprint, toolId: string): WorkshopBlueprint;
export function removeTool(blueprint: WorkshopBlueprint, toolId: string): WorkshopBlueprint;
export function moveTool(blueprint: WorkshopBlueprint, toolId: string, direction: number): WorkshopBlueprint;
export function exportBlueprint(blueprint: WorkshopBlueprint): string;
export function importBlueprint(json: string): WorkshopBlueprint;
