import Groq from 'groq-sdk';
import { config } from '../config/index.js';

const isGroqConfigured = Boolean(
  config.groq.apiKey &&
  config.groq.apiKey !== 'your_groq_api_key'
);

const groq = isGroqConfigured
  ? new Groq({ apiKey: config.groq.apiKey })
  : null;

// Groq's Whisper endpoint identifies files by name/extension, not by the
// browser-supplied MIME type — MediaRecorder's default output in Chrome/
// Edge is audio/webm, so that's the name extension used unless the client
// sent something we recognize.
const EXTENSION_BY_MIME = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/flac': 'flac'
};

/**
 * Transcribes recorded audio into text via Groq's Whisper model, for the
 * chat input's microphone button. Returns null (not an error) when Groq
 * isn't configured at all, so the caller can tell "voice isn't available"
 * apart from "the API call itself failed".
 */
export async function transcribeAudio(buffer, mimeType) {
  if (!isGroqConfigured || !groq) {
    console.warn('[VoiceService] Groq not configured — voice transcription unavailable.');
    return null;
  }

  try {
    const ext = EXTENSION_BY_MIME[mimeType] || 'webm';
    const file = new File([buffer], `voice-question.${ext}`, { type: mimeType || 'audio/webm' });

    const transcription = await groq.audio.transcriptions.create({
      file,
      model: 'whisper-large-v3-turbo',
      response_format: 'json'
    });

    return transcription.text?.trim() || '';
  } catch (err) {
    console.warn('[VoiceService] Transcription failed:', err.message);
    throw err;
  }
}
