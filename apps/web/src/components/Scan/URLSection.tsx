import React from 'react';
import { Link as LinkIcon, Search, Loader2 } from 'lucide-react';

const URLSection = ({ 
  url, 
  setUrl, 
  isAnalyzing, 
  onAnalyze 
}: { url: string; setUrl: (url: string) => void; isAnalyzing: boolean; onAnalyze: () => void }) => {
  return (
    <form className="url-form space-y-5" onSubmit={event => { event.preventDefault(); if (!isAnalyzing) onAnalyze(); }}>
      <div>
        <h3 className="text-base font-semibold mb-2 flex items-center text-slate-900">
          <LinkIcon className="w-5 h-5 text-teal-700 mr-3" />
          <span>Scan a website</span>
        </h3>
        <p className="text-sm text-slate-500">
          Paste the full address. You don’t need to open the page.
        </p>
      </div>

      <div className="space-y-4">
        <label htmlFor="scan-url" className="block text-sm font-medium text-slate-700">
          <LinkIcon className="inline-block mr-1 w-4 h-4" />
          <span>Enter URL to check:</span>
        </label>
        <div className="relative">
          <input
            id="scan-url"
            type="url"
            required
            disabled={isAnalyzing}
            aria-describedby="url-hint"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="w-full px-4 py-4 rounded-xl border-2 focus:outline-hidden focus:ring-2 transition-all duration-300 bg-white text-slate-900 border-slate-300 placeholder-slate-500 focus:border-cyan-400 focus:ring-cyan-400/20"
          />
          <LinkIcon className="absolute right-4 top-1/2 transform -translate-y-1/2 text-blue-700 w-5 h-5" />
        </div>
        <p id="url-hint" className="input-hint">Include https:// or http:// at the beginning.</p>
      </div>

      <button
        type="submit"
        disabled={!url.trim() || isAnalyzing}
        className={`w-full py-4 px-6 rounded-xl font-medium transition-all duration-300 flex items-center justify-center space-x-2 ${
          !url.trim() || isAnalyzing
            ? 'bg-white text-slate-500 cursor-not-allowed'
            : 'bg-teal-200 hover:bg-teal-100 text-slate-950 shadow-[0_8px_24px_rgba(94,234,212,.12)] hover:-translate-y-0.5'
        }`}
      >
        {isAnalyzing ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Checking URL…</span>
          </>
        ) : (
          <>
            <Search className="w-5 h-5" />
            <span>Analyze website</span>
          </>
        )}
      </button>
    </form>
  );
};

export default URLSection;
