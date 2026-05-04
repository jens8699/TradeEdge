// HTML sanitization for AI-generated content rendered via
// dangerouslySetInnerHTML.
//
// Why we need this: Claude generates HTML for Market Brief, Insights, and a
// couple of smaller surfaces. The output is rendered with
// dangerouslySetInnerHTML so it preserves formatting (headings, lists, bold).
// Without sanitization, a crafted user prompt could prompt-inject Claude
// into emitting <script> or onerror handlers that would execute in the
// browser. This is XSS — currently low-severity since each user only sees
// their own AI output, but if we ever add sharing/team features it becomes
// a cross-user attack vector.
//
// We use DOMPurify with the default config plus a few project-specific
// allowances (style attributes are useful for Claude's inline color hints).

import DOMPurify from 'dompurify';

const SAFE_CONFIG = {
  // Default allowed tags + a few extras Claude likes to use in briefs
  ALLOWED_TAGS: [
    'p', 'br', 'hr',
    'strong', 'b', 'em', 'i', 'u', 's',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'blockquote', 'pre', 'code',
    'span', 'div',
    'a',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
  ],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'style'],
  // Force any anchor to be safe — no javascript: URLs, no opener leak
  ADD_ATTR: ['target'],
  // Disallow event handlers (onclick, onerror, etc.) — DOMPurify does this
  // by default, but being explicit helps reviewers understand the intent
  FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover', 'onfocus'],
  // Block dangerous tags even if they sneak in
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'style'],
};

// Force noopener+noreferrer on any link DOMPurify lets through, so a
// malicious href can't reach back to window.opener.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    if (node.getAttribute('target') === '_blank' || node.hasAttribute('href')) {
      node.setAttribute('rel', 'noopener noreferrer');
    }
  }
});

/**
 * Sanitize untrusted HTML for safe rendering via dangerouslySetInnerHTML.
 * Pass through everything visually useful, strip everything that could
 * execute code or exfiltrate data.
 */
export function sanitizeHtml(html) {
  if (!html) return '';
  return DOMPurify.sanitize(html, SAFE_CONFIG);
}
