/**
 * Handles meta-questions about who built SMARTDOCS AI.
 * These are answered directly (no RAG retrieval, no LLM call) so the
 * response is instant and identical regardless of which document is open.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const CREATOR_IMAGE_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../client/public/creator'
);

/**
 * Resolves whatever image file was dropped into client/public/creator,
 * so the photo works regardless of its filename or extension.
 */
function resolveCreatorImageUrl() {
  try {
    const match = fs
      .readdirSync(CREATOR_IMAGE_DIR)
      .find((file) => /\.(jpe?g|png|webp|avif)$/i.test(file));
    return match ? `/creator/${encodeURIComponent(match)}` : null;
  } catch {
    return null;
  }
}

export const CREATOR_PROFILE = {
  name: 'S. Vengal Reddy',
  title: 'Creator & Full-Stack Developer',
  dateOfBirth: '9 October 2006',
  education: 'B.Tech — Computer Science & Engineering',
  institution: 'PBR VITS College',
  initials: 'VR'
};

const CREATOR_ANSWER = `SMARTDOCS AI was designed, developed and engineered by ${CREATOR_PROFILE.name}.

He is a Computer Science & Engineering student at ${CREATOR_PROFILE.institution}, and built this platform end to end — the React interface, the Node.js backend, the Supabase pgvector retrieval layer, and the Qwen-powered RAG pipeline that grounds every answer in your documents.`;

/**
 * True only when the question asks who created *this* application.
 * Both a creation term and a self-reference are required, so a genuine
 * document question like "who built the Eiffel Tower" is not hijacked.
 */
export function isCreatorQuestion(question) {
  if (!question) return false;
  const q = question.toLowerCase();

  const asksAboutPerson = /\bwho\b/.test(q) ||
    /\b(tell me about|info(rmation)? about|details about)\b/.test(q);
  if (!asksAboutPerson) return false;

  const creationTerm = /\b(built|build|created|create|made|make|developed|develop|designed|design|coded|programmed|invented|founded|creator|developer|founder|author|maker|builder|designer|owner|behind)\b/.test(q);
  if (!creationTerm) return false;

  const selfReference = /\b(you|your)\b/.test(q) ||
    /\bsmart\s?docs\b/.test(q) ||
    /\bthis\s+(ai\s+)?(chat\s?bot|bot|app|application|web\s?site|site|web\s?app|project|platform|system|tool|assistant|ai|software|product|page)\b/.test(q);

  return selfReference;
}

export function buildCreatorResponse() {
  return {
    answer: CREATOR_ANSWER,
    profile: {
      ...CREATOR_PROFILE,
      imageUrl: resolveCreatorImageUrl()
    },
    sources: []
  };
}
