import React from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  BrainCircuit,
  Layers,
  ArrowRight,
  Database,
  FileCheck,
  Zap,
  HelpCircle,
  GraduationCap,
  Microscope,
  Briefcase
} from 'lucide-react';

const features = [
  {
    Icon: BrainCircuit,
    title: 'Retrieval-Augmented Generation',
    desc: 'Answers are assembled from passages actually found in your document, each one returned with the leaf it came from.'
  },
  {
    Icon: Database,
    title: 'Vector Embeddings',
    desc: 'Every chunk is stored as a dense vector, so retrieval is a similarity search rather than a keyword match.'
  },
  {
    Icon: Zap,
    title: 'Grounded Generation',
    desc: 'The answer is written with instructions that refuse to go beyond what the excerpts actually support.'
  },
  {
    Icon: Layers,
    title: 'PDF and DOCX Parsing',
    desc: 'Text, structure and page numbers are extracted from both formats, then split on natural paragraph boundaries.'
  },
  {
    Icon: FileCheck,
    title: 'Summaries and Key Points',
    desc: 'A 100-leaf report condenses to an executive overview, its governing themes, and the conclusions it actually reaches.'
  },
  {
    Icon: HelpCircle,
    title: 'Revision Quizzes',
    desc: 'Chapters become multiple-choice questions with explanations traced back to the source text.'
  }
];

const readers = [
  {
    role: 'Students',
    Icon: GraduationCap,
    text: 'Work through textbooks, pull the key points from a chapter, and sit a practice quiz before the exam.'
  },
  {
    role: 'Researchers',
    Icon: Microscope,
    text: 'Interrogate papers, compare methodologies across a literature review, and query dense tables directly.'
  },
  {
    role: 'Professionals',
    Icon: Briefcase,
    text: 'Read contracts, technical manuals and policy documents without skimming for the one clause that matters.'
  }
];

const pipeline = [
  { step: '01', title: 'Ingestion & Parsing', desc: 'The file is stored securely, then parsed to clean text with page indices preserved.' },
  { step: '02', title: 'Chunking & Vectors', desc: 'Text is split into overlapping chunks and embedded as dense vectors.' },
  { step: '03', title: 'Similarity Retrieval', desc: 'Your question becomes a vector; the closest chunks in the document are returned.' },
  { step: '04', title: 'Grounded Generation', desc: 'The answer is written from those excerpts and cites the leaf each claim came from.' }
];

export default function LandingPage() {
  return (
    <div className="relative">
      {/* Hero */}
      <section className="pt-20 pb-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
        <p className="index-label text-brass mb-5">Document intelligence, cited</p>

        <h1 className="font-display text-4xl sm:text-6xl font-semibold tracking-tight text-parchment leading-[1.05] text-balance">
          Ask a question. Get the answer{' '}
          <em className="text-brass font-medium">and the page it came from.</em>
        </h1>

        <p className="mt-6 text-lg text-parchment-dim max-w-2xl leading-relaxed">
          SmartDocs AI reads your PDFs and DOCX files, indexes them into vector memory, and answers
          in plain language — with an exact leaf citation behind every claim, so nothing it tells you
          is unverifiable.
        </p>

        <div className="mt-9 flex flex-col sm:flex-row items-start gap-3">
          <Link
            to="/dashboard"
            className="btn-brass w-full sm:w-auto px-6 py-3 text-sm flex items-center justify-center gap-2 group"
          >
            <span>Open the stacks</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <Link
            to="/register"
            className="btn-ink w-full sm:w-auto px-6 py-3 text-sm text-center"
          >
            Register for a card
          </Link>
        </div>

        {/* A sheet on the desk — the product, at rest */}
        <div className="mt-16 sheet p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3 pb-4 border-b border-ink/15">
            <div className="flex items-center gap-2.5 min-w-0">
              <FileText className="w-4 h-4 text-sage shrink-0" />
              <span className="font-mono text-xs text-ink-text/70 truncate">
                Deep_Learning_Fundamentals.pdf
              </span>
            </div>
            <span className="tab-sage shrink-0">48 leaves</span>
          </div>

          <div className="py-6 space-y-4">
            <div className="flex justify-end">
              <div className="bg-ink-text text-parchment text-sm px-4 py-2.5 rounded-sm max-w-lg">
                What are the main advantages of using Transformers over RNNs?
              </div>
            </div>

            <div className="sheet-well p-4 max-w-xl">
              <p className="index-label text-brass-dim mb-2.5">SmartDocs AI</p>
              <p className="text-sm text-ink-text leading-relaxed">
                Drawing on Chapter 4, Sequence Modeling:
              </p>
              <ul className="list-disc pl-5 mt-2 space-y-1.5 text-sm text-ink-text/85 marker:text-brass">
                <li>
                  <strong className="font-semibold text-ink-text">Parallel processing.</strong>{' '}
                  Self-attention removes the sequential bottleneck recurrence imposes.
                </li>
                <li>
                  <strong className="font-semibold text-ink-text">Constant path length.</strong>{' '}
                  Distant tokens attend to one another directly, without memory decay.
                </li>
              </ul>

              <div className="mt-4 pt-3 border-t border-ink/10 flex items-center gap-2 flex-wrap">
                <span className="index-label text-ink-text/50">Grounded in</span>
                <span className="tab-brass">Leaf 28 · chunk_104</span>
                <span className="tab-brass">Leaf 31</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Readers */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto border-t border-ink-line">
        <p className="index-label text-brass mb-3">Who reads here</p>
        <h2 className="font-display text-2xl sm:text-3xl font-semibold text-parchment mb-10">
          Built for people with more to read than time
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-ink-line border border-ink-line rounded-md overflow-hidden">
          {readers.map(({ role, Icon, text }) => (
            <div key={role} className="bg-ink p-6">
              <Icon className="w-5 h-5 text-sage-light mb-4" />
              <h3 className="font-display text-lg font-semibold text-parchment">{role}</h3>
              <p className="mt-2 text-sm text-parchment-dim leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto border-t border-ink-line">
        <p className="index-label text-brass mb-3">What it does</p>
        <h2 className="font-display text-2xl sm:text-3xl font-semibold text-parchment mb-10">
          Six things worth knowing
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-8">
          {features.map(({ Icon, title, desc }) => (
            <div key={title} className="flex gap-4">
              <Icon className="w-5 h-5 text-brass shrink-0 mt-1" />
              <div>
                <h3 className="font-display text-base font-semibold text-parchment">{title}</h3>
                <p className="mt-1.5 text-sm text-parchment-dim leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pipeline — numbered because it genuinely is a sequence */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto border-t border-ink-line mb-12">
        <p className="index-label text-brass mb-3">How a question is answered</p>
        <h2 className="font-display text-2xl sm:text-3xl font-semibold text-parchment mb-10">
          Four steps, in order
        </h2>

        <ol className="border-l border-ink-line">
          {pipeline.map(({ step, title, desc }) => (
            <li key={step} className="relative pl-6 sm:pl-8 pb-8 last:pb-0">
              <span className="absolute -left-px top-1.5 w-3 h-px bg-brass" />
              <span className="font-mono text-[11px] text-brass tracking-widest">{step}</span>
              <h3 className="font-display text-lg font-semibold text-parchment mt-0.5">{title}</h3>
              <p className="mt-1.5 text-sm text-parchment-dim leading-relaxed max-w-2xl">{desc}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
