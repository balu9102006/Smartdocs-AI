import Groq from 'groq-sdk';
import { config } from '../config/index.js';

const isGroqConfigured = Boolean(
  config.groq.apiKey &&
  config.groq.apiKey !== 'your_groq_api_key'
);

const groq = isGroqConfigured
  ? new Groq({ apiKey: config.groq.apiKey })
  : null;

// Only models confirmed to accept an image_url content part. If the
// configured model isn't one of these, every OCR call will throw and the
// page silently indexes as empty text with nothing telling anyone why —
// warn loudly at call time instead of failing silently.
const KNOWN_VISION_MODELS = new Set(['qwen/qwen3.8-27b', 'qwen/qwen3.6-27b']);

const TRANSCRIBE_PROMPT = `Transcribe every word of text visible in this image, including handwritten notes, exactly as written.
Rules:
- Output ONLY the transcribed text, nothing else (no preamble, no commentary).
- Write it as continuous plain text. Do not wrap or break lines to match the image's layout — use a single line break only where the source has an actual paragraph break.
- Transcribe the content exactly ONCE. Never restate, repeat, or re-wrap any part of it, even partially.
- If a word is illegible, write [illegible] in its place instead of guessing.
- If the image contains no readable text at all, output nothing.`;

export const ocrService = {
  /**
   * Uses a Groq vision-capable model to transcribe text (including
   * handwriting) from a rendered page image.
   *
   * Returns { text, ok }. `ok: false` means the transcription attempt
   * itself failed (misconfigured/non-vision model, API error, etc.) — the
   * caller must treat that differently from "ok: true, text: ''" (a page
   * that genuinely has no readable text), since silently treating a failed
   * OCR call as an empty page loses the page's content with no signal.
   */
  async transcribeImage(imageBuffer, mimeType = 'image/png') {
    if (!isGroqConfigured || !groq) {
      console.warn('[OCRService] Groq not configured — skipping OCR for scanned/handwritten page.');
      return { text: '', ok: false };
    }

    const model = config.groq.defaultModel || 'qwen/qwen3.8-27b';
    if (!KNOWN_VISION_MODELS.has(model)) {
      console.warn(`[OCRService] GROQ_MODEL="${model}" is not a confirmed vision-capable model — OCR calls will likely fail. Known-good: ${[...KNOWN_VISION_MODELS].join(', ')}`);
    }

    try {
      const base64Image = imageBuffer.toString('base64');
      const completion = await groq.chat.completions.create({
        model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: TRANSCRIBE_PROMPT },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } }
            ]
          }
        ],
        temperature: 0.1,
        max_completion_tokens: 1500
      });

      const raw = completion.choices[0]?.message?.content?.trim() || '';
      const exactDeduped = dedupeRepeatedTranscription(raw);
      if (!exactDeduped) return { text: exactDeduped, ok: true };

      // The vision pass sometimes repeats itself with a different (even
      // mid-word) line wrap that exact-match dedup can't catch. A second,
      // text-only cleanup pass catches that semantically — still the same
      // free-tier model, so this costs no money, only a little latency.
      return { text: await cleanupRepetition(exactDeduped), ok: true };
    } catch (err) {
      console.warn('[OCRService] Vision transcription failed:', err.message);
      return { text: '', ok: false };
    }
  }
};

/**
 * Text-only follow-up call that removes duplicated/re-wrapped repeats from
 * an OCR transcription, using the same free-tier model.
 */
async function cleanupRepetition(text) {
  try {
    const completion = await groq.chat.completions.create({
      model: config.groq.defaultModel || 'qwen/qwen3.8-27b',
      messages: [
        {
          role: 'user',
          content: `The following OCR transcription may contain the same content repeated twice (sometimes re-wrapped onto different lines, or even split mid-word). Return the content exactly once, as clean continuous text, with the duplication removed. Do not summarize or alter wording — just deduplicate. Output only the cleaned text, nothing else.\n\nTRANSCRIPTION:\n${text}`
        }
      ],
      temperature: 0,
      max_completion_tokens: 1500
    });
    return completion.choices[0]?.message?.content?.trim() || text;
  } catch (err) {
    console.warn('[OCRService] Repetition cleanup pass failed, using raw transcription:', err.message);
    return text;
  }
}

/**
 * qwen/qwen3.8-27b's vision output occasionally repeats the whole
 * transcription a second time (observed even at temperature 0.1), sometimes
 * re-wrapped onto entirely different line breaks (even splitting mid-word).
 * Compare with ALL whitespace stripped so re-wrapping can't hide the repeat,
 * then cut the original text at the matching halfway point.
 */
function dedupeRepeatedTranscription(text) {
  const squished = text.replace(/\s+/g, '');
  if (squished.length > 0 && squished.length % 2 === 0) {
    const half = squished.length / 2;
    if (squished.slice(0, half) === squished.slice(half)) {
      return cutAtNormalizedLength(text, half).trim();
    }
  }
  return text;
}

function cutAtNormalizedLength(text, targetNonWhitespaceChars) {
  let count = 0;
  for (let i = 0; i < text.length; i++) {
    if (!/\s/.test(text[i])) count++;
    if (count === targetNonWhitespaceChars) {
      return text.slice(0, i + 1);
    }
  }
  return text;
}
