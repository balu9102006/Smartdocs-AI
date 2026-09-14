import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Renders AI-generated markdown (bold, lists, headings, tables, code).
 * react-markdown does not render raw HTML unless rehype-raw is added, so
 * model output stays escaped and cannot inject markup.
 *
 * Styled as ink printed on paper — these surfaces are always sheets.
 */
export default function Markdown({ children, className = '' }) {
  if (!children) return null;

  return (
    <div className={`markdown-body ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}

const components = {
  p: ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>,
  strong: ({ children }) => (
    <strong className="font-semibold text-ink-text">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  h1: ({ children }) => (
    <h1 className="font-display text-lg font-semibold text-ink-text mt-5 mb-2 first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="font-display text-base font-semibold text-ink-text mt-5 mb-2 first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="font-display text-[15px] font-semibold text-ink-text mt-4 mb-1.5 first:mt-0">{children}</h3>
  ),
  ul: ({ children }) => (
    <ul className="list-disc pl-5 mb-3 last:mb-0 space-y-1.5 marker:text-brass">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-5 mb-3 last:mb-0 space-y-1.5 marker:text-brass marker:font-mono">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-brass bg-ink/5 pl-3 py-1.5 my-3 italic">
      {children}
    </blockquote>
  ),
  // react-markdown v9+ dropped the `inline` prop from `code`'s props, so
  // block vs. inline has to be inferred: a fenced block either declares a
  // language (className="language-x") or spans multiple lines; a single
  // backtick span never contains a newline.
  code: ({ className, children }) => {
    const text = String(children).replace(/\n$/, '');
    const isBlock = /language-/.test(className || '') || text.includes('\n');
    return isBlock ? (
      <code className="block p-3 my-3 rounded-sm bg-ink text-parchment text-xs font-mono overflow-x-auto">
        {text}
      </code>
    ) : (
      <code className="px-1.5 py-0.5 rounded-sm bg-ink/10 border border-ink/15 text-[0.85em] font-mono text-brass-dim">
        {text}
      </code>
    );
  },
  pre: ({ children }) => <pre className="my-0">{children}</pre>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-brass-dim hover:text-brass underline underline-offset-2"
    >
      {children}
    </a>
  ),
  hr: () => <hr className="my-4 border-ink/15" />,
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto">
      <table className="w-full text-left border-collapse text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-ink/20 bg-ink/5 px-2.5 py-1.5 font-semibold text-ink-text">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-ink/15 px-2.5 py-1.5">{children}</td>
  )
};
