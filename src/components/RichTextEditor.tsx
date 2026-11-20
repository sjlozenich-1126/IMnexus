import React, { useEffect, useRef, useState } from 'react';
import {
  Bold,
  Check,
  Heading2,
  Heading3,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  RemoveFormatting,
  Strikethrough,
  Underline,
} from 'lucide-react';

function isSafeLinkHref(href: string): boolean {
  const clean = href.trim().toLowerCase();
  return (
    clean.startsWith('https://') ||
    clean.startsWith('http://') ||
    clean.startsWith('mailto:') ||
    clean.startsWith('/')
  );
}

/**
 * Converts stored rich HTML (or legacy plain text) into clean plain text
 * for PDF exports, CSV exports, and Nexus keyword indexing.
 */
export function stripRichHtmlToPlainText(raw: string): string {
  const input = raw || '';
  if (!input.trim()) return '';
  if (!/[<>]/.test(input)) return input;

  const formatted = input
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h1|h2|h3|h4|blockquote)>/gi, '\n\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/li>/gi, '\n');

  if (typeof DOMParser !== 'undefined') {
    try {
      const doc = new DOMParser().parseFromString(formatted, 'text/html');
      const txt = doc.body.textContent || '';
      return txt.replace(/\n{3,}/g, '\n\n').trim();
    } catch {
      // Fallback regex strip
    }
  }

  return formatted
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function renderSanitizedNode(node: ChildNode, key: string): React.ReactNode {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }

  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  const children = Array.from(el.childNodes).map((child, idx) =>
    renderSanitizedNode(child, `${key}-${idx}`)
  );

  switch (tag) {
    case 'br':
      return <br key={key} />;
    case 'p':
      return (
        <p key={key} className="mb-3 last:mb-0 leading-[1.78]">
          {children}
        </p>
      );
    case 'div':
      return (
        <div key={key} className="mb-2 last:mb-0 leading-[1.78]">
          {children}
        </div>
      );
    case 'strong':
    case 'b':
      return (
        <strong key={key} className="font-semibold text-[#0f1210] dark:text-[#f3f0e9]">
          {children}
        </strong>
      );
    case 'em':
    case 'i':
      return (
        <em key={key} className="italic">
          {children}
        </em>
      );
    case 'u':
      return (
        <u key={key} className="underline underline-offset-4">
          {children}
        </u>
      );
    case 's':
    case 'strike':
    case 'del':
      return (
        <s key={key} className="line-through opacity-75">
          {children}
        </s>
      );
    case 'h1':
    case 'h2':
      return (
        <h4
          key={key}
          className="font-serif-editorial text-lg font-semibold text-[#0f1210] dark:text-[#f3f0e9] mt-4 mb-2"
        >
          {children}
        </h4>
      );
    case 'h3':
    case 'h4':
      return (
        <h5
          key={key}
          className="text-sm font-semibold uppercase tracking-[0.04em] text-[#0f1210] dark:text-[#f3f0e9] mt-3.5 mb-1.5"
        >
          {children}
        </h5>
      );
    case 'ul':
      return (
        <ul key={key} className="list-disc pl-5 my-3 space-y-1.5">
          {children}
        </ul>
      );
    case 'ol':
      return (
        <ol key={key} className="list-decimal pl-5 my-3 space-y-1.5">
          {children}
        </ol>
      );
    case 'li':
      return (
        <li key={key} className="leading-[1.7]">
          {children}
        </li>
      );
    case 'blockquote':
      return (
        <blockquote
          key={key}
          className="my-3 pl-4 py-1 border-l-2 border-[#ef4423] dark:border-[#ff6b3d] italic text-[#2b302c]/90 dark:text-[#d8d3c8]/90 bg-[#e9e5db]/40 dark:bg-[#1a1e1b]/60"
        >
          {children}
        </blockquote>
      );
    case 'code':
      return (
        <code
          key={key}
          className="font-mono-tabular text-[0.9em] px-1.5 py-0.5 bg-[#e9e5db] dark:bg-[#1e221e] text-[#0f1210] dark:text-[#f3f0e9]"
        >
          {children}
        </code>
      );
    case 'a': {
      const href = el.getAttribute('href') || '';
      if (!isSafeLinkHref(href)) {
        return <span key={key}>{children}</span>;
      }
      return (
        <a
          key={key}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-4 text-[#ef4423] dark:text-[#ff6b3d] hover:opacity-80"
        >
          {children}
        </a>
      );
    }
    case 'span': {
      // Honor basic bold/italic inline styles created by contentEditable browsers
      const fw = el.style?.fontWeight;
      const fs = el.style?.fontStyle;
      const td = el.style?.textDecoration;
      let cls = '';
      if (fw === 'bold' || fw === '700' || fw === '600') cls += ' font-semibold';
      if (fs === 'italic') cls += ' italic';
      if (td?.includes('underline')) cls += ' underline underline-offset-4';
      if (td?.includes('line-through')) cls += ' line-through';
      return (
        <span key={key} className={cls.trim() || undefined}>
          {children}
        </span>
      );
    }
    default:
      return <React.Fragment key={key}>{children}</React.Fragment>;
  }
}

interface RichTextContentProps {
  content: string;
  className?: string;
  emptyFallback?: string;
}

/**
 * Safely renders rich HTML (bold, italic, underline, lists, headings, blockquotes, links)
 * without dangerouslySetInnerHTML, falling back cleanly for legacy plain-text sections.
 */
export const RichTextContent: React.FC<RichTextContentProps> = ({
  content,
  className = '',
  emptyFallback = '',
}) => {
  const raw = (content || '').trim();
  if (!raw) {
    return emptyFallback ? <p className={className}>{emptyFallback}</p> : null;
  }

  // Plain-text fallback if no HTML markup exists
  if (!/<[a-z][\s\S]*>/i.test(raw)) {
    return <div className={`whitespace-pre-line ${className}`}>{raw}</div>;
  }

  if (typeof DOMParser !== 'undefined') {
    try {
      const doc = new DOMParser().parseFromString(raw, 'text/html');
      const rendered = Array.from(doc.body.childNodes).map((child, idx) =>
        renderSanitizedNode(child, `rt-${idx}`)
      );
      return <div className={className}>{rendered}</div>;
    } catch {
      // Fallback below
    }
  }

  return <div className={`whitespace-pre-line ${className}`}>{stripRichHtmlToPlainText(raw)}</div>;
};

function sanitizeEditorHtml(rawHtml: string): string {
  if (typeof DOMParser === 'undefined') return rawHtml;
  const doc = new DOMParser().parseFromString(rawHtml, 'text/html');

  const ALLOWED = new Set([
    'p',
    'div',
    'br',
    'strong',
    'b',
    'em',
    'i',
    'u',
    's',
    'strike',
    'del',
    'h1',
    'h2',
    'h3',
    'h4',
    'ul',
    'ol',
    'li',
    'blockquote',
    'a',
    'code',
    'span',
  ]);

  const walk = (parent: Node) => {
    const children = Array.from(parent.childNodes);
    for (const child of children) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as HTMLElement;
        const tag = el.tagName.toLowerCase();
        if (tag === 'script' || tag === 'style' || tag === 'iframe' || tag === 'object') {
          parent.removeChild(el);
          continue;
        }
        walk(el);
        // Strip unsafe attributes/event handlers
        for (const attr of Array.from(el.attributes)) {
          const name = attr.name.toLowerCase();
          if (tag === 'a' && name === 'href') {
            if (!isSafeLinkHref(attr.value)) {
              el.removeAttribute(attr.name);
            }
          } else if (tag === 'span' && name === 'style') {
            const safeParts: string[] = [];
            if (el.style.fontWeight) safeParts.push(`font-weight:${el.style.fontWeight}`);
            if (el.style.fontStyle) safeParts.push(`font-style:${el.style.fontStyle}`);
            if (el.style.textDecoration) safeParts.push(`text-decoration:${el.style.textDecoration}`);
            if (safeParts.length > 0) {
              el.setAttribute('style', safeParts.join(';'));
            } else {
              el.removeAttribute('style');
            }
          } else {
            el.removeAttribute(attr.name);
          }
        }
        if (!ALLOWED.has(tag)) {
          const frag = doc.createDocumentFragment();
          while (el.firstChild) frag.appendChild(el.firstChild);
          parent.replaceChild(frag, el);
        }
      }
    }
  };

  walk(doc.body);
  return doc.body.innerHTML;
}

interface RichTextEditorProps {
  sectionId: string;
  initialContent: string;
  onSave: (sanitizedHtml: string) => Promise<void> | void;
  placeholder?: string;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  sectionId,
  initialContent,
  onSave,
  placeholder = 'Write formatted findings, legal analysis, or case narrative…',
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedFlag, setSavedFlag] = useState(false);
  const [showLinkPrompt, setShowLinkPrompt] = useState(false);
  const [linkUrlInput, setLinkUrlInput] = useState('https://');
  const savedRangeRef = useRef<Range | null>(null);

  // Sync incoming content when switching sections or after initial load
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const raw = initialContent || '';
    if (!raw) {
      el.textContent = '';
    } else if (/<[a-z][\s\S]*>/i.test(raw)) {
      el.innerHTML = sanitizeEditorHtml(raw);
    } else {
      // Preserve line breaks from legacy plain-text sections
      el.innerHTML = raw
        .split(/\n{2,}/)
        .map((para) => {
          const escaped = para
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, '<br>');
          return `<p>${escaped}</p>`;
        })
        .join('');
    }
    setDirty(false);
  }, [sectionId, initialContent]);

  const applyCommand = (command: string, value?: string) => {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    try {
      document.execCommand(command, false, value);
      setDirty(true);
      setSavedFlag(false);
    } catch {
      // Ignore browser quirks
    }
  };

  const openLinkDialog = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    }
    setLinkUrlInput('https://');
    setShowLinkPrompt((prev) => !prev);
  };

  const insertLink = () => {
    const href = linkUrlInput.trim();
    if (!isSafeLinkHref(href)) return;
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    if (savedRangeRef.current) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(savedRangeRef.current);
    }
    document.execCommand('createLink', false, href);
    setShowLinkPrompt(false);
    setDirty(true);
    setSavedFlag(false);
  };

  const handleSave = async () => {
    const el = editorRef.current;
    if (!el) return;
    setSaving(true);
    try {
      const cleanHtml = sanitizeEditorHtml(el.innerHTML);
      const plainCheck = stripRichHtmlToPlainText(cleanHtml);
      await onSave(plainCheck ? cleanHtml : '');
      setDirty(false);
      setSavedFlag(true);
      window.setTimeout(() => setSavedFlag(false), 2200);
    } finally {
      setSaving(false);
    }
  };

  const toolbarBtnCls =
    'p-1.5 min-w-[30px] h-[30px] inline-flex items-center justify-center border border-transparent hover:border-[#ddd8ce] dark:hover:border-[#343b36] hover:bg-[#faf8f4] dark:hover:bg-[#1c201d] text-[#0f1210] dark:text-[#f3f0e9] transition-colors cursor-pointer';

  return (
    <div className="border border-[#ddd8ce] dark:border-[#262b27] bg-[#faf8f4] dark:bg-[#161916]">
      {/* Formatting Toolbar */}
      <div className="px-2.5 py-2 border-b border-[#ddd8ce] dark:border-[#262b27] bg-[#f3f0e9]/80 dark:bg-[#101311] flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-0.5">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyCommand('bold')}
            title="Bold (Ctrl+B)"
            className={toolbarBtnCls}
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyCommand('italic')}
            title="Italic (Ctrl+I)"
            className={toolbarBtnCls}
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyCommand('underline')}
            title="Underline (Ctrl+U)"
            className={toolbarBtnCls}
          >
            <Underline className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyCommand('strikeThrough')}
            title="Strikethrough"
            className={toolbarBtnCls}
          >
            <Strikethrough className="w-3.5 h-3.5" />
          </button>

          <span className="w-px h-4 bg-[#ddd8ce] dark:bg-[#2a302b] mx-1" aria-hidden="true" />

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyCommand('formatBlock', '<h2>')}
            title="Section Heading (H2)"
            className={toolbarBtnCls}
          >
            <Heading2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyCommand('formatBlock', '<h3>')}
            title="Subheading (H3)"
            className={toolbarBtnCls}
          >
            <Heading3 className="w-3.5 h-3.5" />
          </button>

          <span className="w-px h-4 bg-[#ddd8ce] dark:bg-[#2a302b] mx-1" aria-hidden="true" />

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyCommand('insertUnorderedList')}
            title="Bullet List"
            className={toolbarBtnCls}
          >
            <List className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyCommand('insertOrderedList')}
            title="Numbered List"
            className={toolbarBtnCls}
          >
            <ListOrdered className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyCommand('formatBlock', '<blockquote>')}
            title="Blockquote / Citation"
            className={toolbarBtnCls}
          >
            <Quote className="w-3.5 h-3.5" />
          </button>

          <span className="w-px h-4 bg-[#ddd8ce] dark:bg-[#2a302b] mx-1" aria-hidden="true" />

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={openLinkDialog}
            title="Insert Citation Link"
            className={toolbarBtnCls}
          >
            <LinkIcon className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              applyCommand('removeFormat');
              applyCommand('formatBlock', '<p>');
            }}
            title="Clear Formatting"
            className={toolbarBtnCls}
          >
            <RemoveFormatting className="w-3.5 h-3.5" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
            dirty
              ? 'bg-[#ef4423] text-white hover:bg-[#d63618]'
              : 'bg-[#0f1210] dark:bg-[#f3f0e9] text-[#faf8f4] dark:text-[#0f1210] hover:opacity-85'
          } disabled:opacity-50`}
        >
          {savedFlag && !dirty ? <Check className="w-3.5 h-3.5" /> : null}
          <span>
            {saving
              ? 'Saving…'
              : savedFlag && !dirty
              ? 'Section Saved'
              : dirty
              ? 'Save Formatted Section'
              : 'Save Section'}
          </span>
        </button>
      </div>

      {showLinkPrompt && (
        <div className="px-3 py-2 border-b border-[#ddd8ce] dark:border-[#262b27] bg-[#e9e5db]/50 dark:bg-[#121614] flex flex-wrap items-center gap-2">
          <input
            type="url"
            value={linkUrlInput}
            onChange={(e) => setLinkUrlInput(e.target.value)}
            placeholder="https://example.org/filing.pdf"
            className="flex-1 min-w-[200px] px-2.5 py-1 text-xs bg-[#faf8f4] dark:bg-[#0c0e0c] border border-[#ddd8ce] dark:border-[#262b27] outline-none"
          />
          <button
            type="button"
            onClick={insertLink}
            className="px-2.5 py-1 text-xs font-medium bg-[#0f1210] dark:bg-[#f3f0e9] text-[#faf8f4] dark:text-[#0f1210] cursor-pointer"
          >
            Apply Link
          </button>
          <button
            type="button"
            onClick={() => setShowLinkPrompt(false)}
            className="px-2 py-1 text-xs text-[#6a716b] cursor-pointer"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Editable Content Surface */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={() => {
          setDirty(true);
          setSavedFlag(false);
        }}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
            e.preventDefault();
            void handleSave();
          }
        }}
        className="min-h-[190px] max-h-[420px] overflow-y-auto px-4 py-3 text-[13.5px] leading-[1.7] text-[#0f1210] dark:text-[#f3f0e9] outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-[#6a716b]/70 [&_h2]:font-serif-editorial [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1.5 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:uppercase [&_h3]:tracking-wider [&_h3]:mt-2.5 [&_h3]:mb-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-[#ef4423] [&_blockquote]:pl-3 [&_blockquote]:italic [&_a]:underline [&_a]:text-[#ef4423]"
      />
    </div>
  );
};
