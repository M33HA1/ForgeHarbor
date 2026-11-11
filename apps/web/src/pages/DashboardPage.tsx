import React, { useEffect, useRef, useState } from "react";
import UploadSection from "../components/Scan/UploadSection";
import URLSection from "../components/Scan/URLSection";
import PhishingDetector from "../components/Scan/PhishingDetector";
import Result from "../components/Scan/Result";
import api from "../services/api";
import { ArrowRight, FileSearch, History, Info, Link as LinkIcon, Loader2, ShieldCheck } from "lucide-react";

import { Link } from "react-router-dom";

import type { AnalysisResult, ScanKind } from '../types';
import { errorMessage } from '../types';

const DashboardPage = () => {
  const [activeTab, setActiveTab] = useState<ScanKind>("url");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const resultRef = useRef<HTMLElement>(null);
  useEffect(() => { if (result) resultRef.current?.focus(); }, [result]);

  const handleFileAnalysis = async () => {
    if (!file) return;
    setIsAnalyzing(true);
    setResult(null);
    try {
      const response = await api.scanFile(file);
      const analysis = response.result;
      if (typeof analysis?.malicious !== 'boolean' ||
          typeof analysis.vendor_positives !== 'number' || typeof analysis.total_vendors !== 'number' ||
          !Number.isInteger(analysis.vendor_positives) || !Number.isInteger(analysis.total_vendors) ||
          analysis.vendor_positives < 0 || analysis.total_vendors <= 0 || analysis.vendor_positives > analysis.total_vendors) {
        throw new Error('The file analysis response is incomplete. Please try again.');
      }
      setResult({
        type: "file",
        data: {
          is_malicious: analysis.malicious,
          is_phishing: false,
          confidence_score: null,
          vendor_positives: analysis.vendor_positives,
          total_vendors: analysis.total_vendors,
          details: `${analysis.vendor_positives} of ${analysis.total_vendors} vendors flagged this file.`,
          report_url: analysis.report_url,
          filename: file.name,
        },
      });
    } catch (error) {
      setResult({ type: "error", message: errorMessage(error, "Failed to analyze file") });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleUrlAnalysis = async () => {
    if (!url.trim()) return;
    setIsAnalyzing(true);
    setResult(null);
    try {
      let target: URL;
      try { target = new URL(url); } catch { throw new Error('Enter a complete http:// or https:// URL.'); }
      if (!['http:', 'https:'].includes(target.protocol)) throw new Error('Use an http:// or https:// URL.');
      const response = await api.scanUrl(url);
      if (typeof response.result?.phishing !== 'boolean' ||
          typeof response.result.confidence !== 'number' ||
          !Number.isFinite(response.result.confidence) || response.result.confidence < 0 || response.result.confidence > 1 ||
          typeof response.result.reason !== 'string') {
        throw new Error('The URL analysis response is incomplete. Please try again.');
      }
      const data = {
        is_malicious: false,
        is_phishing: response.result.phishing,
        confidence_score: Math.round(response.result.confidence * 100),
        details: response.result.reason,
      };
      setResult({ type: "url", data: { ...data, targetUrl: url } });
    } catch (error) {
      setResult({ type: "error", message: errorMessage(error, "Failed to analyze URL") });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="analysis-page">
      <div className="workspace-topbar"><span>Workspace <span aria-hidden="true">/</span> New analysis</span><span className="workspace-badge"><ShieldCheck size={14} /> Threat assessment</span></div>
      <div className="page-heading"><div><h1>New analysis</h1><p>Check a URL for phishing or submit a file for malware analysis.</p></div><Link to="/app/history" className="secondary-button"><History size={16} /> View history <ArrowRight size={14} /></Link></div>
      <div className="analysis-grid">
        <div className="analysis-primary">
          <section className="analysis-card" aria-label="New security analysis" aria-busy={isAnalyzing}>
            <div className="card-heading"><span className="card-icon"><FileSearch size={20} /></span><div><h2>Analysis input</h2><p>Select a type and provide a URL or file.</p></div></div>
            <PhishingDetector activeTab={activeTab} setActiveTab={setActiveTab} disabled={isAnalyzing} />
            <div className="analysis-input">{activeTab === 'url' ? <URLSection url={url} setUrl={setUrl} isAnalyzing={isAnalyzing} onAnalyze={handleUrlAnalysis} /> : <UploadSection file={file} setFile={setFile} isAnalyzing={isAnalyzing} onAnalyze={handleFileAnalysis} />}</div>
            <div className="provider-note"><Info size={15} /><p>{activeTab === 'url' ? 'URLs are sent to Gemini for phishing analysis.' : 'Files are submitted to VirusTotal for malware analysis.'} Avoid submitting confidential content.</p></div>
          </section>
          {isAnalyzing && <div role="status" aria-live="polite" className="analysis-progress"><Loader2 className="animate-spin" size={19} /><div><strong>Examining {activeTab === 'url' ? 'the link' : 'your file'}…</strong><p>Waiting for the analysis provider. Keep this page open.</p></div></div>}
          {result && <section ref={resultRef} tabIndex={-1} className="result-focus" aria-label="Analysis result"><Result result={result} /><Link to="/app/history" className="result-history-link">Open scan history to review saved evidence <ArrowRight size={15} /></Link></section>}
          {!result && !isAnalyzing && <div className="analysis-empty"><span className="empty-icon"><ShieldCheck size={20} /></span><div><h3>No analysis yet</h3><p>Analysis findings will appear here once your scan completes.</p></div></div>}
        </div>
        <aside className="analysis-guide" aria-label="Analysis guidance">
          <h2>Before submitting</h2>
          <div className="guide-item"><LinkIcon size={18} /><div><h3>Suspicious links</h3><p>Look for misleading domains, unexpected sign-in pages, and unusual requests.</p></div></div>
          <div className="guide-item"><FileSearch size={18} /><div><h3>Unexpected files</h3><p>Check an attachment before opening it, especially when you weren’t expecting it.</p></div></div>
          <div className="guide-divider" />
          <h3>Reviewing a result</h3>
          <ol className="analysis-steps"><li><span>1</span>Submit a link or file</li><li><span>2</span>Review the findings</li><li><span>3</span>Revisit evidence in History</li></ol>
          <p className="guide-disclaimer">A clean result is a signal, not a guarantee. Always consider who sent it and why.</p>
        </aside>
      </div>
    </div>
  );
};

export default DashboardPage;
