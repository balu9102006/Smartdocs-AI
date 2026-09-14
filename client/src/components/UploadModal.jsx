import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export default function UploadModal({ isOpen, onClose, onUploadSuccess }) {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progressStage, setProgressStage] = useState('');
  const inputRef = useRef(null);

  if (!isOpen) return null;

  const validateFile = (selectedFile) => {
    setError('');
    if (!selectedFile) return false;

    const validExtensions = ['pdf', 'docx'];
    const ext = selectedFile.name.split('.').pop().toLowerCase();

    if (!validExtensions.includes(ext)) {
      setError('Invalid file format. Only PDF and DOCX files are supported.');
      return false;
    }

    // Max 20 MB per document
    const maxSize = 20 * 1024 * 1024;
    if (selectedFile.size > maxSize) {
      setError('File size exceeds the 20 MB limit.');
      return false;
    }

    return true;
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (validateFile(droppedFile)) {
        setFile(droppedFile);
      }
    }
  };

  const handleChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (validateFile(selectedFile)) {
        setFile(selectedFile);
      }
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);

    try {
      setProgressStage('Uploading file to storage...');
      await new Promise(r => setTimeout(r, 600));

      setProgressStage('Extracting document text & sections...');
      await new Promise(r => setTimeout(r, 700));

      setProgressStage('Dividing into semantic chunks...');
      await new Promise(r => setTimeout(r, 600));

      setProgressStage('Generating vector embeddings...');
      await new Promise(r => setTimeout(r, 700));

      setProgressStage('Finalizing document index...');
      await new Promise(r => setTimeout(r, 400));

      await onUploadSuccess(file);
      setUploading(false);
      onClose();
    } catch (err) {
      setError(err.message || 'Upload failed. Please try again.');
      setUploading(false);
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm">
      <div className="sheet max-w-lg w-full p-6 relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-ink/15">
          <div>
            <h3 className="font-display text-lg font-semibold text-ink-text">Add to the stacks</h3>
            <p className="text-xs text-ink-text/60">PDF and DOCX formats supported</p>
          </div>
          {!uploading && (
            <button
              onClick={onClose}
              className="p-1 rounded-sm text-ink-text/50 hover:text-paper hover:bg-ink-text transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Dropzone */}
        <div className="mt-5">
          {!uploading ? (
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                dragActive
                  ? 'border-brass bg-brass/10'
                  : 'border-ink/25 hover:border-brass/50 bg-ink/5 hover:bg-ink/[0.07]'
              }`}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleChange}
                className="hidden"
              />

              <div className="w-14 h-14 mx-auto rounded-sm border border-brass/50 flex items-center justify-center text-brass-dim mb-3">
                <UploadCloud className="w-7 h-7" />
              </div>

              <p className="text-sm font-medium text-ink-text">
                Click to browse or drag and drop your file here
              </p>
              <p className="text-xs text-ink-text/60 mt-1">
                Supported formats: <span className="text-brass-dim font-semibold">PDF, DOCX</span> (Max 20MB)
              </p>
            </div>
          ) : (
            <div className="p-8 text-center sheet-well">
              <Loader2 className="w-10 h-10 text-brass animate-spin mx-auto mb-3" />
              <p className="text-sm font-medium text-ink-text">{progressStage}</p>
              <div className="w-full bg-ink/15 rounded-sm h-1.5 mt-4 overflow-hidden">
                <div className="bg-brass h-1.5 animate-pulse w-3/4"></div>
              </div>
              <p className="text-xs text-ink-text/60 mt-2 font-mono">Processing vector embeddings...</p>
            </div>
          )}

          {/* Selected File Details */}
          {file && !uploading && (
            <div className="mt-4 p-3 sheet-well flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-sm bg-sage text-paper flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs font-semibold text-ink-text truncate max-w-[260px]">{file.name}</p>
                  <p className="text-[11px] text-ink-text/60 font-mono">{formatBytes(file.size)}</p>
                </div>
              </div>
              <button
                onClick={() => setFile(null)}
                className="text-ink-text/60 hover:text-ink-text text-xs font-medium px-2 py-1 rounded-sm underline"
              >
                Change
              </button>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mt-3 p-2.5 bg-ink-text text-paper rounded-sm flex items-center gap-2 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Actions */}
          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              disabled={uploading}
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-ink-text/70 hover:text-ink-text hover:bg-ink/5 rounded-sm transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!file || uploading}
              onClick={handleUpload}
              className="btn-brass px-5 py-2 text-xs flex items-center gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Binding…</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4" />
                  <span>Catalogue Document</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

