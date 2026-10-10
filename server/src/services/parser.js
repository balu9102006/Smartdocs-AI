import mammoth from 'mammoth';
import JSZip from 'jszip';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from '@napi-rs/canvas';
import { ocrService } from './ocrService.js';

// A page with fewer words than this is treated as scanned/handwritten
// (no usable text layer) and sent through OCR instead.
const MIN_WORDS_PER_PAGE = 12;

/**
 * Cleans and normalizes extracted text.
 */
export function cleanText(rawText) {
  if (!rawText) return '';
  return rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[ \u00A0]+/g, ' ') // Replace consecutive spaces and non-breaking spaces
    .replace(/\n{3,}/g, '\n\n') // Max 2 consecutive newlines
    .trim();
}

/**
 * Extracts raw text and page count from a PDF buffer.
 */
export async function extractTextFromPdf(buffer) {
  try {
    const doc = await getDocument({
      data: new Uint8Array(buffer),
      useWorkerFetch: false,
      isEvalSupported: false
    }).promise;

    let rawText = '';
    let ocrPageCount = 0;
    let ocrFailedPageCount = 0;
    // Real per-page character ranges in the final `text`, so a chunk's page
    // number can be looked up directly instead of estimated from
    // (charOffset / totalLength) * totalPages — which drifts on any density
    // variation (title pages, figures, tables, OCR'd pages all have very
    // different text-per-page). Built from each page's OWN cleaned text so
    // offsets stay exact — cleaning the final concatenated string afterward
    // (collapsing whitespace, trimming) would shift them.
    const pageMap = [];

    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      let pageText = content.items.map((item) => item.str).join(' ');

      const wordCount = pageText.trim().split(/\s+/).filter(Boolean).length;
      if (wordCount < MIN_WORDS_PER_PAGE) {
        // Likely a scanned or handwritten page with no usable text layer —
        // render it to an image and transcribe it with a vision model.
        const { text: ocrText, ok } = await ocrPage(page);
        if (ok) {
          pageText = ocrText;
          ocrPageCount++;
        } else {
          // The OCR call itself failed (not "page has no text") — this page
          // is about to be indexed as empty, which silently loses its
          // content. Count it so the caller can surface that.
          ocrFailedPageCount++;
        }
      }

      const cleanedPageText = cleanText(pageText);
      const charStart = rawText.length;
      rawText += cleanedPageText + '\n';
      pageMap.push({ page: i, charStart, charEnd: rawText.length });
    }

    if (ocrPageCount > 0) {
      console.log(`[Parser] OCR transcribed ${ocrPageCount}/${doc.numPages} page(s) with no text layer.`);
    }
    if (ocrFailedPageCount > 0) {
      console.warn(`[Parser] OCR FAILED on ${ocrFailedPageCount}/${doc.numPages} page(s) — those pages will index as empty text.`);
    }

    return {
      // rawText is already built from per-page cleanText() calls (each
      // page's own text is already trimmed/normalized) — NOT re-trimmed or
      // re-cleaned as a whole string here, because that would shift
      // character offsets out from under pageMap above.
      text: rawText,
      totalPages: doc.numPages,
      pageMap,
      ocrPageCount,
      ocrFailedPageCount
    };
  } catch (err) {
    console.error('PDF parsing error:', err);
    throw new Error(`Failed to parse PDF document: ${err.message}`);
  }
}

/**
 * Renders a PDF page to a PNG image and transcribes it via the OCR service.
 */
async function ocrPage(page) {
  try {
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = createCanvas(viewport.width, viewport.height);
    const context = canvas.getContext('2d');
    await page.render({ canvasContext: context, viewport }).promise;
    const imageBuffer = canvas.toBuffer('image/png');
    return await ocrService.transcribeImage(imageBuffer, 'image/png');
  } catch (err) {
    console.warn('[Parser] OCR page render failed:', err.message);
    return { text: '', ok: false };
  }
}

/**
 * Extracts raw text from a DOCX buffer using mammoth.
 */
export async function extractTextFromDocx(buffer) {
  try {
    const result = await mammoth.extractRawText({ buffer });
    const cleaned = cleanText(result.value);

    // Approximate page count for DOCX (approx 400 words per page)
    const wordCount = cleaned.split(/\s+/).filter(Boolean).length;
    const estimatedPages = Math.max(1, Math.ceil(wordCount / 400));

    return {
      text: cleaned,
      totalPages: estimatedPages,
      messages: result.messages || []
    };
  } catch (err) {
    console.error('DOCX parsing error:', err);
    throw new Error(`Failed to parse DOCX document: ${err.message}`);
  }
}

/**
 * Extracts raw text from a PPTX buffer. A .pptx is a zip of per-slide XML
 * files (ppt/slides/slide1.xml, slide2.xml, ...) — each slide's visible
 * text lives in <a:t> runs inside it, regardless of shape type (text box,
 * table, title placeholder, etc.), so no separate layout handling is
 * needed the way PDF/DOCX require.
 *
 * Unlike PDF page numbers (which needed real per-page tracking to avoid
 * estimation drift) and DOCX page numbers (which can't be known at all),
 * a slide's number IS its real, exact page number — no estimation needed.
 *
 * Known limitation: this only reads text runs, not text baked into images
 * pasted onto a slide (e.g. a screenshot) — that would need the same OCR
 * path used for scanned PDF pages, which isn't wired up for PPTX.
 */
export async function extractTextFromPptx(buffer) {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const slideFiles = Object.keys(zip.files)
      .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
      .sort((a, b) => {
        const numA = parseInt(a.match(/slide(\d+)\.xml/)[1], 10);
        const numB = parseInt(b.match(/slide(\d+)\.xml/)[1], 10);
        return numA - numB;
      });

    if (slideFiles.length === 0) {
      throw new Error('No slides found in this .pptx file.');
    }

    let rawText = '';
    const pageMap = [];

    for (let i = 0; i < slideFiles.length; i++) {
      const xml = await zip.files[slideFiles[i]].async('string');
      const cleanedSlideText = cleanText(extractSlideTextRuns(xml));
      const charStart = rawText.length;
      rawText += cleanedSlideText + '\n';
      pageMap.push({ page: i + 1, charStart, charEnd: rawText.length });
    }

    return {
      text: rawText,
      totalPages: slideFiles.length,
      pageMap
    };
  } catch (err) {
    console.error('PPTX parsing error:', err);
    throw new Error(`Failed to parse PPTX document: ${err.message}`);
  }
}

/**
 * Pulls every DrawingML text run (<a:t>...</a:t>) out of a slide's XML, in
 * document order, and joins them with spaces.
 */
function extractSlideTextRuns(xml) {
  const matches = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)];
  return matches.map((m) => decodeXmlEntities(m[1])).join(' ');
}

function decodeXmlEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/**
 * Unified document parser dispatcher.
 */
export async function parseDocument(buffer, fileType) {
  const type = fileType.toLowerCase().replace('.', '');
  if (type === 'pdf') {
    return await extractTextFromPdf(buffer);
  } else if (type === 'docx') {
    return await extractTextFromDocx(buffer);
  } else if (type === 'pptx') {
    return await extractTextFromPptx(buffer);
  } else {
    throw new Error(`Unsupported file type: ${fileType}. Only PDF, DOCX, and PPTX are allowed.`);
  }
}

