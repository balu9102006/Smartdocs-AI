import mammoth from 'mammoth';
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

    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      let pageText = content.items.map((item) => item.str).join(' ');

      const wordCount = pageText.trim().split(/\s+/).filter(Boolean).length;
      if (wordCount < MIN_WORDS_PER_PAGE) {
        // Likely a scanned or handwritten page with no usable text layer —
        // render it to an image and transcribe it with a vision model.
        const ocrText = await ocrPage(page);
        if (ocrText) {
          pageText = ocrText;
          ocrPageCount++;
        }
      }

      rawText += pageText + '\n';
    }

    if (ocrPageCount > 0) {
      console.log(`[Parser] OCR transcribed ${ocrPageCount}/${doc.numPages} page(s) with no text layer.`);
    }

    return {
      text: cleanText(rawText),
      totalPages: doc.numPages,
      ocrPageCount
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
    return '';
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
 * Unified document parser dispatcher.
 */
export async function parseDocument(buffer, fileType) {
  const type = fileType.toLowerCase().replace('.', '');
  if (type === 'pdf') {
    return await extractTextFromPdf(buffer);
  } else if (type === 'docx') {
    return await extractTextFromDocx(buffer);
  } else {
    throw new Error(`Unsupported file type: ${fileType}. Only PDF and DOCX are allowed.`);
  }
}

