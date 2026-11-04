import React, { useState } from "react";
import UploadSection from "../components/Scan/UploadSection";
import URLSection from "../components/Scan/URLSection";
import PhishingDetector from "../components/Scan/PhishingDetector";
import Result from "../components/Scan/Result";
import api from "../services/api";
import { Activity, ArrowDownRight, Shield, ShieldCheck, Sparkles } from "lucide-react";

const DashboardPage = () => {
  const [activeTab, setActiveTab] = useState("url");
  const [file, setFile] = useState(null);
  const [url, setUrl] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState(null);

  const handleFileAnalysis = async () => {
    if (!file) return;
    setIsAnalyzing(true);
    setResult(null);
    try {
      const response = await api.scanFile(file);
      const analysis = response.result;
      if (typeof analysis?.malicious !== 'boolean' ||
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
      setResult({ type: "error", message: error.message || "Failed to analyze file" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleUrlAnalysis = async () => {
    if (!url.trim()) return;
    setIsAnalyzing(true);
    setResult(null);
    try {
      const response = await api.scanUrl(url);
      if (typeof response.result?.phishing !== 'boolean' ||
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
      setResult({ type: "error", message: error.message || "Failed to analyze URL" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="scanner-page mx-auto w-full max-w-6xl">
      <div className="scanner-topline">
        <span className="scanner-mark"><Shield className="h-4 w-4" /> ForgeHarbor Security</span>
        <span className="scanner-status"><span className="scanner-status-dot" /> Analysis workspace</span>
      </div>

      <section className="scanner-intro">
        <div className="scanner-intro-copy">
          <div className="scanner-eyebrow"><Sparkles className="h-3.5 w-3.5" /> Threat analysis, made clear</div>
          <h1>Know what you&apos;re<br className="hidden sm:block" /> dealing with.</h1>
          <p>Check a link or file for threats before you interact with it. Results are organized here as soon as the scan completes.</p>
        </div>
        <div className="scanner-intro-badge" aria-hidden="true">
          <div className="scanner-orbit scanner-orbit-one" />
          <div className="scanner-orbit scanner-orbit-two" />
          <div className="scanner-shield"><ShieldCheck className="h-8 w-8" /></div>
          <span className="scanner-orbit-label">Protected analysis</span>
        </div>
      </section>

      <section className="scanner-workspace" aria-label="New security analysis">
        <div className="scanner-workspace-heading">
          <div>
            <div className="scanner-section-kicker">New analysis <span>01</span></div>
            <h2>What should we check?</h2>
          </div>
          <div className="scanner-private"><ShieldCheck className="h-4 w-4" /> Private by design</div>
        </div>

        <PhishingDetector activeTab={activeTab} setActiveTab={setActiveTab} />

        <div className="scanner-input-panel">
          {activeTab === "url" ? (
            <URLSection url={url} setUrl={setUrl} isAnalyzing={isAnalyzing} onAnalyze={handleUrlAnalysis} />
          ) : (
            <UploadSection file={file} setFile={setFile} isAnalyzing={isAnalyzing} onAnalyze={handleFileAnalysis} />
          )}
        </div>
      </section>

      {result && <Result result={result} />}

      {!result && !isAnalyzing && (
        <div className="scanner-footnote">
          <div className="scanner-footnote-icon"><Activity className="h-4 w-4" /></div>
          <p><strong>Start with one thing.</strong> Paste a URL or add a file to get a focused threat assessment.</p>
          <ArrowDownRight className="scanner-footnote-arrow h-4 w-4" />
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
