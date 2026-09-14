import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, MessageSquare, BookOpen, Trash2, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

export default function DocumentCard({ doc, onDelete }) {
  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const isReady = doc.status === 'ready';
  const isProcessing = doc.status === 'processing';
  const isError = doc.status === 'error';

  return (
    <div className="sheet p-5 flex flex-col justify-between group hover:border-brass/50 transition-colors">
      <div>
        {/* Catalog header: format stamp + shelving status */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <span className="index-label text-ink-text/70 border border-ink/25 px-1.5 py-0.5 rounded-sm">
            {doc.fileType?.toUpperCase()}
          </span>

          {isReady && (
            <span className="tab-sage inline-flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Catalogued
            </span>
          )}
          {isProcessing && (
            <span className="tab-brass inline-flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              Binding
            </span>
          )}
          {isError && (
            <span className="font-mono text-[10px] font-semibold px-2 py-0.5 rounded-sm bg-ink-text text-paper inline-flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Failed
            </span>
          )}
        </div>

        {/* Title block */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-sm bg-sage text-paper flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div className="overflow-hidden">
            <h4
              className="font-display text-[15px] font-semibold text-ink-text truncate group-hover:text-brass-dim transition-colors"
              title={doc.fileName}
            >
              {doc.fileName}
            </h4>
            <p className="text-xs text-ink-text/65 line-clamp-2 mt-1 leading-relaxed">
              {doc.description || 'Catalogued for context-grounded reference and semantic retrieval.'}
            </p>
          </div>
        </div>

        {/* Shelf marks */}
        <div className="flex items-center gap-5 mt-4 pt-3 border-t border-ink/15 font-mono text-[11px] text-ink-text/60">
          <div>
            <span className="uppercase tracking-wider">Leaves </span>
            <span className="font-semibold text-ink-text">{doc.totalPages || '--'}</span>
          </div>
          <div>
            <span className="uppercase tracking-wider">Size </span>
            <span className="font-semibold text-ink-text">{formatBytes(doc.fileSize)}</span>
          </div>
          <span className="ml-auto text-ink-text/45">{formatDate(doc.uploadedAt)}</span>
        </div>
      </div>

      {/* Reading actions */}
      <div className="mt-5 pt-3 border-t border-ink/15 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link
            to={`/document/${doc.id}`}
            className="btn-brass px-3 py-1.5 text-xs flex items-center gap-1.5"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Consult</span>
          </Link>
          <Link
            to={`/document/${doc.id}?tab=summary`}
            className="px-2.5 py-1.5 text-xs font-medium rounded-sm text-ink-text/70 hover:text-ink-text hover:bg-ink/5 flex items-center gap-1.5 transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Summary</span>
          </Link>
        </div>

        <button
          onClick={() => onDelete(doc.id)}
          title="Delete document"
          className="p-1.5 text-ink-text/50 hover:text-paper hover:bg-ink-text rounded-sm transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
