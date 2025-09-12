import React, { useState, useRef } from 'react';
import { Upload, FileText, X, Search, Loader2, Fish, Waves } from 'lucide-react';

const UploadSection = ({
  file,
  setFile,
  isAnalyzing,
  onAnalyze
}) => {
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold mb-2 flex items-center text-white">
          <Fish className="w-6 h-6 text-cyan-400 mr-3" />
          <span>Drop Your Catch for Analysis</span>
        </h3>
        <p className="text-sm text-slate-400">
          Upload a file to analyze for potential security threats
        </p>
      </div>

      <div
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 cursor-pointer ${
          dragActive
            ? 'border-cyan-400 bg-cyan-400/10 scale-105'
            : 'border-slate-600 hover:border-cyan-400 hover:bg-slate-700/50'
        }`}
        onClick={() => fileInputRef.current?.click()}
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
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,.doc,.docx"
          onChange={handleFileChange}
          className="hidden"
        />
        <div className="space-y-4">
          <div className="flex justify-center">
            <div className="p-4 rounded-full bg-slate-700/50 backdrop-blur-sm">
              <Upload className="w-8 h-8 text-cyan-400 animate-bounce" />
            </div>
          </div>
          <div>
            <p className="text-lg font-medium mb-2 text-white">
              {file ? (
                <span className="flex items-center justify-center">
                  <Fish className="w-5 h-5 mr-2 text-green-500" />
                  Hooked: {file.name}
                </span>
              ) : (
                <span className="flex items-center justify-center">
                  <FileText className="w-5 h-5 mr-2" />
                  Drop your file here or click to browse
                </span>
              )}
            </p>
            <p className="text-sm text-slate-400">
              Supports PDF, TXT, DOC, and DOCX files (max 10MB)
            </p>
          </div>
        </div>
      </div>

      {file && (
        <div className="rounded-lg p-4 border backdrop-blur-sm bg-slate-700/30 border-slate-600">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-slate-600/50">
                <FileText className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="font-medium text-white">
                  {file.name}
                </p>
                <p className="text-sm text-slate-400">
                  {(file.size / 1024).toFixed(2)} KB
                </p>
              </div>
            </div>
            <button
              onClick={() => setFile(null)}
              className="p-2 rounded-lg transition-colors hover:bg-slate-600 text-slate-400 hover:text-red-400"
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
            ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
            : 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white shadow-lg hover:shadow-xl transform hover:scale-105'
        }`}
      >
        {isAnalyzing ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Analyzing the catch...</span>
          </>
        ) : (
          <>
            <Search className="w-5 h-5" />
            <span>Examine This Catch</span>
          </>
        )}
      </button>
    </div>
  );
};

export default UploadSection;