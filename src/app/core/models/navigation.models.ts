export interface NavigationEntry {
  id: string;
  name: string;
  route: string | null;
  icon: string;
  parentId: string | null;
  displayOrder: number;
  isActive: boolean;
  isGroup: boolean;
}
export interface NavigationLayout { revision: string; items: NavigationEntry[]; }
export const MENU_ICONS = ['dashboard', 'api', 'applications', 'test', 'history', 'reference', 'vendor', 'users', 'password', 'access', 'roles', 'permissions', 'audit', 'folder', 'settings'];
export function childrenOf(items: NavigationEntry[], parentId: string | null): NavigationEntry[] {
  return items.filter(x => x.parentId === parentId).sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));
}
