/**
 * Utility for sanitizing and escaping strings before rendering in DOM/Leaflet HTML
 * Prevents Cross-Site Scripting (XSS) in map markers, labels and reports.
 */

export const escapeHtml = (text) => {
  if (text === null || text === undefined) return '';
  const str = String(text);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};
