/**
 * Semantic text chunker with sliding window overlap and natural boundary preservation.
 */

export function chunkText(text, options = {}) {
  const {
    chunkSize = 800, // Character limit per chunk
    chunkOverlap = 150, // Character overlap to preserve boundary context
    totalPages = 1,
    // Real per-page character ranges from parser.js (PDF only — see
    // resolvePageNumber below for why DOCX can't have this). When absent,
    // falls back to the character-offset-ratio estimate.
    pageMap = null
  } = options;

  if (!text || text.trim().length === 0) {
    return [];
  }

  const chunks = [];
  const textLength = text.length;
  let start = 0;
  let chunkIndex = 0;

  while (start < textLength) {
    let end = start + chunkSize;

    if (end >= textLength) {
      end = textLength;
    } else {
      // Find natural boundary (paragraph, newline, period, space)
      const lookaheadRange = text.substring(start + Math.floor(chunkSize * 0.75), end + 50);
      const boundaryIndex = findBestBoundary(lookaheadRange);

      if (boundaryIndex !== -1) {
        end = start + Math.floor(chunkSize * 0.75) + boundaryIndex;
      }
    }

    const chunkContent = text.substring(start, end).trim();

    if (chunkContent.length > 30) {
      chunks.push({
        chunkIndex,
        content: chunkContent,
        pageNumber: resolvePageNumber(start, pageMap, textLength, totalPages),
        charStart: start,
        charEnd: end,
        tokenEstimate: Math.ceil(chunkContent.length / 4)
      });

      chunkIndex++;
    }

    // Step forward by chunkSize - chunkOverlap
    const nextStart = end - chunkOverlap;
    if (nextStart <= start) {
      start = end; // Prevent infinite loop
    } else {
      start = nextStart;
    }
  }

  return chunks;
}

/**
 * A chunk's real page is whichever page's character range (from parser.js)
 * contains its start offset. Falls back to the old offset-ratio estimate
 * when no pageMap is available — currently only DOCX, where there simply
 * is no ground truth: page breaks in a .docx are a rendering-time outcome
 * of page size/margins/fonts, not stored in the document's raw text, so an
 * exact page number isn't obtainable from text extraction at all. That
 * estimate stays clearly an estimate, not a claimed-precise citation.
 */
function resolvePageNumber(charOffset, pageMap, textLength, totalPages) {
  if (pageMap) {
    const match = pageMap.find((p) => charOffset >= p.charStart && charOffset < p.charEnd);
    if (match) return match.page;
    // Offset fell in a separator/edge position between pages — clamp to
    // the nearest real page rather than falling through to the estimate.
    if (pageMap.length > 0) {
      return charOffset < pageMap[0].charStart
        ? pageMap[0].page
        : pageMap[pageMap.length - 1].page;
    }
  }
  return Math.min(totalPages, Math.max(1, Math.ceil((charOffset / textLength) * totalPages)));
}

/**
 * Searches for natural language split boundaries, preferring the LATEST
 * acceptable boundary in range (closest to the chunkSize target) over the
 * first one found — taking the first match of each tier consistently
 * undershot the configured chunk size by ~20% in practice, since a
 * sentence end or newline often appears early in the lookahead window.
 */
function findBestBoundary(subtext) {
  // 1. Paragraph break
  const paraBreak = subtext.lastIndexOf('\n\n');
  if (paraBreak !== -1) return paraBreak + 2;

  // 2. Sentence end (.!?) followed by space or newline
  const sentenceMatches = [...subtext.matchAll(/[.!?](\s|\n)/g)];
  if (sentenceMatches.length > 0) {
    return sentenceMatches[sentenceMatches.length - 1].index + 2;
  }

  // 3. Newline
  const newline = subtext.lastIndexOf('\n');
  if (newline !== -1) return newline + 1;

  // 4. Space
  const lastSpace = subtext.lastIndexOf(' ');
  if (lastSpace !== -1) return lastSpace + 1;

  return -1;
}

