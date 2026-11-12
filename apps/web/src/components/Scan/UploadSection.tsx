import { useRef, useState, type DragEvent } from 'react';
import { Check, FileText, Loader2, Search, Upload, X } from 'lucide-react';
const formatSize = (bytes: number) => bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KiB` : `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
export default function UploadSection({ file, setFile, isAnalyzing, onAnalyze }: {
  file: File | null; setFile: (file: File | null) => void; isAnalyzing: boolean; onAnalyze: () => void;
}) {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const choose = (files: FileList | null) => {
    if (isAnalyzing || !files?.length) return;
    if (files.length !== 1) { setError('Choose one file at a time. No new file was selected.'); return; }
    if (files[0].size > 32 * 1024 * 1024) { setError('Choose a file smaller than or equal to 32 MiB.'); setFile(null); return; }
    setError(''); setFile(files[0]);
  };
  const drop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault(); setDragActive(false); choose(event.dataTransfer.files);
  };
  const remove = () => { setFile(null); setError(''); if (input.current) input.current.value = ''; };
  return <div className="upload-section">
    <div><h3>Scan a file</h3><p className="upload-intro">Select the attachment you want to investigate.</p></div>
    <input ref={input} type="file" aria-label="Upload file" disabled={isAnalyzing} className="hidden" onClick={event => { event.currentTarget.value = ''; }} onChange={event => choose(event.target.files)} />
    <button type="button" aria-label={file ? 'Change file' : 'Choose a file'} disabled={isAnalyzing} className={`upload-dropzone ${file ? 'has-file' : ''} ${dragActive ? 'is-dragging' : ''}`} onClick={() => input.current?.click()}
      onDragEnter={event => { event.preventDefault(); if (!isAnalyzing) setDragActive(true); }} onDragLeave={event => { event.preventDefault(); setDragActive(false); }} onDragOver={event => event.preventDefault()} onDrop={drop}>
      {file ? <><Upload size={16} aria-hidden="true" /><strong>Change file</strong></> : <>
        <span className="upload-symbol"><Upload size={24} aria-hidden="true" /></span>
        <strong>Choose a file</strong><span>or drop a file here</span><small>One file, up to 32 MiB</small>
      </>}
    </button>
    {error && <p role="alert" className="upload-error">{error}</p>}
    <span className="sr-only" role="status">{file ? `${file.name} selected. Ready to submit; not analyzed yet.` : ''}</span>
    {file && <div className="selected-file" role="group" aria-label="Selected file">
      <span className="selected-file-icon"><FileText size={22} aria-hidden="true" /></span>
      <div className="selected-file-copy"><strong>{file.name}</strong><span>{formatSize(file.size)}<span className="file-ready"><Check size={12} aria-hidden="true" /> Ready to submit</span></span></div>
      <button type="button" aria-label="Remove file" className="icon-button" disabled={isAnalyzing} onClick={remove}><X size={17} aria-hidden="true" /></button>
    </div>}
    <button type="button" onClick={onAnalyze} disabled={!file || isAnalyzing} className="upload-submit">
      {isAnalyzing ? <><Loader2 size={18} className="animate-spin" aria-hidden="true" /> Analyzing file…</> : <><Search size={18} aria-hidden="true" /> Analyze file</>}
    </button>
  </div>;
}
