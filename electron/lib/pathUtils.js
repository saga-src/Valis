
import path from 'path';

/**
 * Resolves Windows environment variables (e.g. %APPDATA%) in a path string.
 * Also normalizes slashes.
 * @param {string} inputPath 
 * @returns {string}
 */
export function resolvePath(inputPath) {
  if (!inputPath) return '';
  
  // Replace %VAR% with process.env.VAR
  const resolved = inputPath.replace(/%([^%]+)%/g, (_, n) => {
    return process.env[n] || '';
  });

  return path.normalize(resolved);
}
