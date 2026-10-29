import type { MotionVersion, ComponentModule } from './types.js';

const registry = new Map<string, ComponentModule>();

export function registerComponent(name: string, module: ComponentModule): void {
  registry.set(name, module);
}

export function getComponent(name: string): ComponentModule | undefined {
  return registry.get(name);
}

export function getVersion(componentName: string, versionId: string): MotionVersion {
  const module = registry.get(componentName);
  if (!module) throw new Error(`Unknown component: "${componentName}"`);
  const version = module.versions.find(v => v.id === versionId);
  if (!version) {
    const fallback = module.versions.find(v => v.id === module.defaultVersion);
    if (!fallback) throw new Error(`Component "${componentName}" has no versions`);
    return fallback;
  }
  return version;
}

export function getDefaultVersion(componentName: string): MotionVersion {
  const module = registry.get(componentName);
  if (!module) throw new Error(`Unknown component: "${componentName}"`);
  return getVersion(componentName, module.defaultVersion);
}
