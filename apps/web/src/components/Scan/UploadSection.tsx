import React, { useState, useRef } from 'react';
import { Upload, FileText, X, Search, Loader2 } from 'lucide-react';

const UploadSection = ({
  file,
  setFile,
  isAnalyzing,
  onAnalyze
}: { file: File | null; setFile: (file: File | null) => void; isAnalyzing: boolean; onAnalyze: () => void }) => {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const chooseFile = (selected: File) => {
    if (isAnalyzing) return;
    if (selected.size > 32 * 1024 * 1024) { setError('Choose a file smaller than or equal to 32 MiB.'); setFile(null); return; }
    setError(''); setFile(selected);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      chooseFile(selectedFile);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      chooseFile(droppedFile);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold mb-2 flex items-center text-slate-900">
          <Upload className="w-5 h-5 text-teal-700 mr-3" />
          <span>Scan a file</span>
        </h3>
        <p className="text-sm text-slate-500">
          Upload a file to analyze for potential security threats
        </p>
      </div>

      <div
        role="button"
        tabIndex={isAnalyzing ? -1 : 0}
        aria-disabled={isAnalyzing}
        aria-label="Choose a file"
        onKeyDown={(event) => {
          if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            if (!isAnalyzing) fileInputRef.current?.click();
          }
        }}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 cursor-pointer ${
          dragActive
            ? 'border-cyan-400 bg-cyan-400/10 scale-105'
            : 'border-slate-300 hover:border-teal-300/70 hover:bg-teal-300/[.03]'
        }`}
        onClick={() => { if (!isAnalyzing) fileInputRef.current?.click(); }}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragActive(false);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <input
          aria-label="Upload file"
          ref={fileInputRef}
          type="file"
          disabled={isAnalyzing}
          onChange={handleFileChange}
          className="hidden"
        />
        <div className="space-y-4">
          <div className="flex justify-center">
            <div className="p-4 rounded-full bg-white backdrop-blur-sm">
              <Upload className="w-8 h-8 text-teal-700" />
            </div>
          </div>
          <div>
            <p className="text-lg font-medium mb-2 text-slate-900">
              {file ? (
                <span className="flex items-center justify-center">
                  <FileText className="w-5 h-5 mr-2 text-teal-700" />
                  {file.name}
                </span>
              ) : (
                <span className="flex items-center justify-center">
                  <FileText className="w-5 h-5 mr-2" />
                  Drop your file here or click to browse
                </span>
              )}
            </p>
            <p className="text-sm text-slate-500">
              One file at a time · Up to 32 MiB
            </p>
          </div>
        </div>
      </div>

      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

      {file && (
        <div className="rounded-lg p-4 border backdrop-blur-sm bg-white border-slate-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-white">
                <FileText className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="font-medium text-slate-900">
                  {file.name}
                </p>
                <p className="text-sm text-slate-500">
                  {(file.size / 1024).toFixed(2)} KB
                </p>
              </div>
            </div>
            <button
              aria-label="Remove file"
              disabled={isAnalyzing}
              onClick={() => { setFile(null); setError(''); if (fileInputRef.current) fileInputRef.current.value = ''; }}
              className="p-2 rounded-lg transition-colors hover:bg-white text-slate-500 hover:text-red-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <button
        onClick={onAnalyze}
        disabled={!file || isAnalyzing}
        className={`w-full py-4 px-6 rounded-xl font-medium transition-all duration-300 flex items-center justify-center space-x-2 ${
          !file || isAnalyzing
            ? 'bg-white text-slate-500 cursor-not-allowed'
            : 'bg-teal-200 hover:bg-teal-100 text-slate-950 shadow-[0_8px_24px_rgba(94,234,212,.12)] hover:-translate-y-0.5'
        }`}
      >
        {isAnalyzing ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Analyzing file…</span>
          </>
        ) : (
          <>
            <Search className="w-5 h-5" />
            <span>Analyze file</span>
          </>
        )}
      </button>
    </div>
  );
};

export default UploadSection;
