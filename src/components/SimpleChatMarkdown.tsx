/**
 * Simple Chat Markdown Renderer
 * 
 * Lightweight alternative to ReactMarkdown specifically for chat interfaces.
 * Handles the most common formatting without the complexity of full markdown parsing.
 */

import React, { memo } from 'react';
import { colors, spacing, effects, typography } from '@/lib/design-tokens';

interface SimpleChatMarkdownProps {
  content: string;
  style?: React.CSSProperties;
}

export const SimpleChatMarkdown = memo(function SimpleChatMarkdown({
  content,
  style = {},
}: SimpleChatMarkdownProps) {
  
  const renderContent = () => {
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Code blocks (```)
      if (line.trim().startsWith('```')) {
        const codeLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }
        elements.push(
          <pre key={`code-${i}`} style={{ 
            margin: `${spacing[3]} 0`,
            padding: spacing[3],
            backgroundColor: colors.bg.inset,
            border: `1px solid ${colors.border.muted}`,
            borderRadius: effects.border.radius.default,
            overflowX: 'auto',
            fontSize: typography.sizes.xs,
            lineHeight: 1.5,
            fontFamily: typography.fonts.code,
          }}>
            <code>{codeLines.join('\n')}</code>
          </pre>
        );
        i++;
        continue;
      }

      // Headers
      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headerMatch) {
        const level = headerMatch[1].length;
        const text = headerMatch[2];
        // Chat-friendly sizes (not as dramatic as documents)
        const sizes = [typography.sizes.lg, typography.sizes.base, '15px', typography.sizes.sm, typography.sizes.xs, typography.sizes.xs];
        const weights = [typography.weights.bold, typography.weights.bold, typography.weights.semibold, typography.weights.semibold, typography.weights.semibold, typography.weights.medium];
        const topMargins = [spacing[4], spacing[3], spacing[3], spacing[2], spacing[2], spacing[2]];
        const bottomMargins = [spacing[2], spacing[2], spacing[1], spacing[1], spacing[1], spacing[1]];
        
        elements.push(
          <div key={`h-${i}`} style={{ 
            fontSize: sizes[level - 1],
            fontWeight: weights[level - 1],
            margin: `${topMargins[level - 1]} 0 ${bottomMargins[level - 1]} 0`,
            lineHeight: 1.3,
            color: colors.fg.primary,
          }}>
            {formatInline(text)}
          </div>
        );
        i++;
        continue;
      }

      // Lists
      const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s+(.+)$/);
      if (listMatch) {
        const items: React.ReactNode[] = [];
        
        while (i < lines.length) {
          const listLine = lines[i];
          const match = listLine.match(/^(\s*)([-*+]|\d+\.)\s+(.+)$/);
          if (!match) break;
          
          items.push(
            <li key={`li-${i}`} style={{ marginBottom: spacing[1], paddingLeft: spacing[2] }}>
              {formatInline(match[3])}
            </li>
          );
          i++;
        }
        
        elements.push(
          <ul key={`ul-${i}`} style={{ 
            margin: `${spacing[2]} 0`,
            paddingLeft: spacing[5],
            listStylePosition: 'outside',
          }}>
            {items}
          </ul>
        );
        continue;
      }

      // Blockquotes
      if (line.trim().startsWith('>')) {
        const text = line.replace(/^>\s*/, '');
        elements.push(
          <div key={`quote-${i}`} style={{
            margin: `${spacing[3]} 0`,
            paddingLeft: spacing[4],
            borderLeft: `3px solid ${colors.border.default}`,
            color: colors.fg.secondary,
            fontStyle: 'italic',
          }}>
            {formatInline(text)}
          </div>
        );
        i++;
        continue;
      }

      // Horizontal rule
      if (line.trim().match(/^[-*_]{3,}$/)) {
        elements.push(
          <hr key={`hr-${i}`} style={{
            margin: `${spacing[4]} 0`,
            border: 'none',
            borderTop: `1px solid ${colors.border.muted}`,
          }} />
        );
        i++;
        continue;
      }

      // Empty line (paragraph break)
      if (line.trim() === '') {
        // Only add spacing if next line has content
        if (i + 1 < lines.length && lines[i + 1].trim() !== '') {
          elements.push(<div key={`br-${i}`} style={{ height: spacing[3] }} />);
        }
        i++;
        continue;
      }

      // Regular text line
      elements.push(
        <div key={`p-${i}`} style={{ lineHeight: 1.6, fontSize: typography.sizes.sm }}>
          {formatInline(line)}
        </div>
      );
      i++;
    }

    return elements;
  };

  // Format inline elements (bold, italic, code, links)
  const formatInline = (text: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let key = 0;

    // Combined regex for all inline patterns including plain URLs
    // Matches: **bold**, *italic*, `code`, [text](url), and plain URLs
    const pattern = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`(.+?)`)|(\[(.+?)\]\((.+?)\))|(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g;
    let match;

    while ((match = pattern.exec(text)) !== null) {
      // Add text before match
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }

      if (match[2]) {
        // Bold: **text**
        parts.push(<strong key={key++}>{match[2]}</strong>);
      } else if (match[4]) {
        // Italic: *text*
        parts.push(<em key={key++}>{match[4]}</em>);
      } else if (match[6]) {
        // Inline code: `text`
        parts.push(
          <code key={key++} style={{
            fontFamily: typography.fonts.code,
            backgroundColor: colors.bg.inset,
            border: `1px solid ${colors.border.muted}`,
            borderRadius: effects.border.radius.sm,
            padding: `2px ${spacing[1]}`,
            fontSize: '0.9em',
          }}>
            {match[6]}
          </code>
        );
      } else if (match[8] && match[9]) {
        // Markdown link: [text](url)
        parts.push(
          <a key={key++} href={match[9]} target="_blank" rel="noopener noreferrer" style={{
            color: colors.accent.primary,
            textDecoration: 'underline',
            cursor: 'pointer',
          }}>
            {match[8]}
          </a>
        );
      } else if (match[10]) {
        // Plain URL: https://example.com
        const url = match[10];
        parts.push(
          <a key={key++} href={url} target="_blank" rel="noopener noreferrer" style={{
            color: colors.accent.primary,
            textDecoration: 'underline',
            cursor: 'pointer',
            wordBreak: 'break-all',
          }}>
            {url}
          </a>
        );
      }

      lastIndex = pattern.lastIndex;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  return (
    <div style={style}>
      {renderContent()}
    </div>
  );
});
