import React from 'react';
import { BookMarked } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t border-ink-line bg-ink-deep py-10 px-4 sm:px-6 lg:px-8 mt-auto">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-sm border border-brass/40 flex items-center justify-center">
            <BookMarked className="w-4 h-4 text-brass" />
          </div>
          <div>
            <p className="font-display italic text-sm font-semibold text-parchment">SmartDocs AI</p>
            <p className="text-xs text-parchment-dim">
              Intelligent Document Question Answering and Analysis System
            </p>
          </div>
        </div>

        <p className="font-mono text-[10px] text-parchment-dim/70">
          &copy; {new Date().getFullYear()} SmartDocs AI
        </p>
      </div>
    </footer>
  );
}
