import React from 'react';
import { Link as LinkIcon, Search, Loader2 } from 'lucide-react';

const URLSection = ({ 
  url, 
  setUrl, 
  isAnalyzing, 
  onAnalyze 
}) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold mb-2 flex items-center text-white">
          <LinkIcon className="w-5 h-5 text-teal-300 mr-3" />
          <span>Scan a website</span>
        </h3>
        <p className="text-sm text-slate-400">
          Enter a URL to check for potential security threats
        </p>
      </div>

      <div className="space-y-4">
        <label htmlFor="scan-url" className="block text-sm font-medium text-slate-300">
          <LinkIcon className="inline-block mr-1 w-4 h-4" />
          <span>Enter URL to check:</span>
        </label>
        <div className="relative">
          <input
            id="scan-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="w-full px-4 py-4 rounded-xl border-2 focus:outline-none focus:ring-2 transition-all duration-300 bg-slate-700/50 text-white border-slate-600 placeholder-slate-400 focus:border-cyan-400 focus:ring-cyan-400/20"
          />
          <LinkIcon className="absolute right-4 top-1/2 transform -translate-y-1/2 text-blue-400 w-5 h-5" />
        </div>
      </div>

      <button
        onClick={onAnalyze}
        disabled={!url.trim() || isAnalyzing}
        className={`w-full py-4 px-6 rounded-xl font-medium transition-all duration-300 flex items-center justify-center space-x-2 ${
          !url.trim() || isAnalyzing
            ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
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
    </div>
  );
};

export default URLSection;
