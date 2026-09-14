import mammoth from 'mammoth';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

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
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      rawText += content.items.map((item) => item.str).join(' ') + '\n';
    }

    return {
      text: cleanText(rawText),
      totalPages: doc.numPages
    };
  } catch (err) {
    console.error('PDF parsing error:', err);
    throw new Error(`Failed to parse PDF document: ${err.message}`);
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

