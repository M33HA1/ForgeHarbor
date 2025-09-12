import React from 'react';
import { Upload, Link, Waves } from 'lucide-react';

const PhishingDetector = ({ activeTab, setActiveTab, currentPage }) => {
  // If we're on a specific analysis page, don't show the tab switcher
  if (currentPage === "url-analysis") {
    return null;
  }
  
  if (currentPage === "file-analysis") {
    return null;
  }

  return (
    <div className="mb-8">
      <div className="inline-flex rounded-xl p-1 backdrop-blur-sm border bg-slate-700/30 border-slate-600/50">
        <button
          onClick={() => setActiveTab('file')}
          className={`px-6 py-3 rounded-lg font-medium transition-all duration-300 flex items-center space-x-2 ${
            activeTab === 'file'
              ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg transform scale-105'
              : 'text-slate-300 hover:text-white hover:bg-slate-600/50'
          }`}
        >
          <Upload className="w-4 h-4" />
          <span>File Analysis</span>
        </button>
        <button
          onClick={() => setActiveTab('url')}
          className={`px-6 py-3 rounded-lg font-medium transition-all duration-300 flex items-center space-x-2 ${
            activeTab === 'url'
              ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg transform scale-105'
              : 'text-slate-300 hover:text-white hover:bg-slate-600/50'
          }`}
        >
          <Link className="w-4 h-4" />
          <span>URL Analysis</span>
        </button>
      </div>
    </div>
  );
};

export default PhishingDetector;