import React from 'react';
import { Upload, Link } from 'lucide-react';

const PhishingDetector = ({ activeTab, setActiveTab }) => {
  return (
    <div className="mb-4 px-7">
      <div className="inline-flex rounded-xl p-1 border border-slate-700/70 bg-slate-950/70">
        <button
          onClick={() => setActiveTab('url')}
          className={`px-6 py-3 rounded-lg font-medium transition-all duration-300 flex items-center space-x-2 ${
            activeTab === 'url'
              ? 'bg-slate-700/80 text-white shadow-sm ring-1 ring-white/10'
              : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/70'
          }`}
        >
          <Link className="w-4 h-4" />
          <span>URL Analysis</span>
        </button>
        <button
          onClick={() => setActiveTab('file')}
          className={`px-6 py-3 rounded-lg font-medium transition-all duration-300 flex items-center space-x-2 ${
            activeTab === 'file'
              ? 'bg-slate-700/80 text-white shadow-sm ring-1 ring-white/10'
              : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/70'
          }`}
        >
          <Upload className="w-4 h-4" />
          <span>File Analysis</span>
        </button>
      </div>
    </div>
  );
};

export default PhishingDetector;
