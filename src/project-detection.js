/**
 * Suggest a dev command from package.json scripts.
 * Simple heuristic: look at existing scripts for something that starts a server.
 */
/**
 * Suggest a dev command from package.json scripts.
 * Picks the best existing script to use as a dev script.
 *
 * @param {object} pkg - Parsed package.json
 * @returns {{ script: string, command: string, reason: string }|null}
 */
export function suggestDevScript(pkg) {
  const scripts = pkg.scripts || {};

  // Prefer existing dev script
  if (scripts.dev) {
    return null; // already has one, just wrap it
  }

  // Priority: web > serve > start > dev-server > develop
  const candidates = ['web', 'serve', 'start', 'dev-server', 'develop'];
  for (const key of candidates) {
    if (scripts[key]) {
      return { script: key, command: scripts[key], reason: `already has "${key}" script` };
    }
  }

  // Fallback: look for common dev server commands in any script
  const devKeywords = ['vite', 'next', 'nuxt', 'ng serve', 'react-scripts', 'gatsby', 'astro', 'remix', 'docusaurus'];
  for (const [name, cmd] of Object.entries(scripts)) {
    for (const kw of devKeywords) {
      if (cmd.includes(kw)) {
        return { script: name, command: cmd, reason: `"${name}" script looks like a dev server` };
      }
    }
  }

  // Last resort: just ask the user what to use
  return null;
}
