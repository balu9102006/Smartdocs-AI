import React, { useState, useEffect } from 'react';
import {
  UploadCloud,
  FileText,
  Search,
  Layers,
  Database,
  CheckCircle2,
  Sparkles,
  HelpCircle,
  Clock,
  Plus
} from 'lucide-react';
import DocumentCard from '../components/DocumentCard';
import UploadModal from '../components/UploadModal';
import { api, getStoredDocuments } from '../services/api';

export default function DashboardPage() {
  const [documents, setDocuments] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDocs();
  }, []);

  const loadDocs = async () => {
    setLoading(true);
    const docs = await api.getDocuments();
    setDocuments(docs);
    setLoading(false);
  };

  const handleUploadSuccess = async (file) => {
    await api.uploadDocument(file);
    await loadDocs();
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this document?')) {
      await api.deleteDocument(id);
      await loadDocs();
    }
  };

  // Filtered documents
  const filteredDocs = documents.filter((doc) => {
    const matchesSearch = doc.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.description && doc.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'all' ? true : doc.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calculate high-level stats
  const totalDocs = documents.length;
  const readyDocs = documents.filter(d => d.status === 'ready').length;
  const totalPages = documents.reduce((acc, curr) => acc + (curr.totalPages || 0), 0);
  const totalChunksEst = totalPages * 3; // Approx 3 chunks per page

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Masthead */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 pb-6 border-b border-brass/25">
        <div>
          <p className="index-label text-brass mb-2">Catalogue</p>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-parchment tracking-tight">
            The Stacks
          </h1>
          <p className="text-sm text-parchment-dim mt-1.5 max-w-xl">
            Every PDF and DOCX you have shelved, parsed into leaves and indexed for reference.
          </p>
        </div>

        <button
          onClick={() => setIsUploadOpen(true)}
          className="btn-brass px-4 py-2.5 text-sm flex items-center justify-center gap-2 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add to the stacks</span>
        </button>
      </div>

      {/* Ledger summary line */}
      <dl className="my-8 grid grid-cols-2 md:grid-cols-4 gap-px bg-ink-line border border-ink-line rounded-md overflow-hidden">
        {[
          { label: 'Volumes', value: totalDocs, note: 'PDF & DOCX', Icon: FileText },
          { label: 'Catalogued', value: readyDocs, note: 'ready to consult', Icon: CheckCircle2 },
          { label: 'Leaves parsed', value: totalPages, note: 'pages cleaned', Icon: Layers },
          { label: 'Indexed chunks', value: totalChunksEst, note: 'as dense vectors', Icon: Database }
        ].map(({ label, value, note, Icon }) => (
          <div
            key={label}
            className="bg-ink px-4 py-4"
          >
            <dt className="index-label text-parchment-dim flex items-center justify-between gap-2">
              <span>{label}</span>
              <Icon className="w-3.5 h-3.5 text-brass" />
            </dt>
            <dd className="font-display text-2xl font-semibold text-parchment mt-1.5 tabular-nums">
              {value}
            </dd>
            <p className="text-[11px] text-parchment-dim/70 mt-0.5">{note}</p>
          </div>
        ))}
      </dl>

      {/* Search + shelving filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-parchment-dim/60 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search the catalogue…"
            className="w-full bg-ink-soft border border-ink-line focus:border-brass focus:ring-1 focus:ring-brass rounded-sm pl-9 pr-4 py-2 text-sm text-parchment placeholder-parchment-dim/50 outline-none transition-colors"
          />
        </div>

        <div className="flex items-center self-start sm:self-auto border border-ink-line rounded-sm overflow-hidden">
          {[
            { key: 'all', label: 'All', count: documents.length },
            { key: 'ready', label: 'Catalogued', count: readyDocs },
            { key: 'processing', label: 'Binding', count: documents.length - readyDocs }
          ].map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`px-3 py-1.5 font-mono text-[11px] tracking-wide border-r last:border-r-0 border-ink-line transition-colors ${
                statusFilter === key
                  ? 'bg-brass text-ink font-semibold'
                  : 'text-parchment-dim hover:text-parchment hover:bg-ink-soft'
              }`}
            >
              {label} ({count})
            </button>
          ))}
        </div>
      </div>

      {/* Shelves */}
      {filteredDocs.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredDocs.map((doc) => (
            <DocumentCard key={doc.id} doc={doc} onDelete={handleDelete} />
          ))}
        </div>
      ) : (
        <div className="p-12 text-center border border-dashed border-ink-line rounded-md bg-ink-soft/40">
          <FileText className="w-10 h-10 text-brass/50 mx-auto mb-3" />
          <h3 className="font-display text-base font-semibold text-parchment">Nothing on the shelf yet</h3>
          <p className="text-sm text-parchment-dim mt-1.5 max-w-sm mx-auto">
            {searchQuery
              ? 'No volumes match that search. Try clearing the filters.'
              : 'Add a PDF or DOCX and it will be parsed, indexed and ready to consult.'}
          </p>
          <button
            onClick={() => setIsUploadOpen(true)}
            className="btn-brass mt-5 px-4 py-2 text-xs inline-flex items-center gap-2"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Add to the stacks</span>
          </button>
        </div>
      )}

      {/* Upload Modal */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadSuccess={handleUploadSuccess}
      />
    </div>
  );
}

