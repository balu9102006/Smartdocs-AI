/**
 * Semantic text chunker with sliding window overlap and natural boundary preservation.
 */

export function chunkText(text, options = {}) {
  const {
    chunkSize = 800, // Character limit per chunk
    chunkOverlap = 150, // Character overlap to preserve boundary context
    totalPages = 1
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
      // Estimate page number based on character offset through the document
      const estimatedPage = Math.min(
        totalPages,
        Math.max(1, Math.ceil((start / textLength) * totalPages))
      );

      chunks.push({
        chunkIndex,
        content: chunkContent,
        pageNumber: estimatedPage,
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
 * Searches for natural language split boundaries.
 */
function findBestBoundary(subtext) {
  // 1. Paragraph break
  const paraBreak = subtext.indexOf('\n\n');
  if (paraBreak !== -1) return paraBreak + 2;

  // 2. Sentence end (.!?) followed by space or newline
  const sentenceMatch = subtext.match(/[.!?](\s|\n)/);
  if (sentenceMatch && sentenceMatch.index !== undefined) {
    return sentenceMatch.index + 2;
  }

  // 3. Newline
  const newline = subtext.indexOf('\n');
  if (newline !== -1) return newline + 1;

  // 4. Space
  const lastSpace = subtext.lastIndexOf(' ');
  if (lastSpace !== -1) return lastSpace + 1;

  return -1;
}

