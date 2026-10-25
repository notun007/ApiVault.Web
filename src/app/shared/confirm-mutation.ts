/** Ask after validation and before setting saving state or issuing a mutation. */
export type MutationAction = 'create' | 'update' | 'delete' | 'save' | 'reset' | 'change';

export function confirmMutation(action: MutationAction, subject: string): boolean {
  if (typeof window === 'undefined') return false;
  const verb = action.charAt(0).toUpperCase() + action.slice(1);
  // Callers supply a record label only; never include passwords, tokens, or payloads.
  return window.confirm(`${verb} ${subject}?\n\nSelect OK to continue or Cancel to return without saving.`);
}
