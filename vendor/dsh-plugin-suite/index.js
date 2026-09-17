/**
 * The suite has no runtime side effects of its own. Its bundle patch is the
 * explicit composition surface; keeping this entry as a function plugin makes
 * the package visible in Loader diagnostics and gives it a stable identity.
 */
export const name = 'dsh-plugin-suite';
export const inject = [];
export function apply() {}
