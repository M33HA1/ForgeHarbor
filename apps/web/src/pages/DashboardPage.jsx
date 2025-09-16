import React, { useState } from "react";
import UploadSection from "../components/Scan/UploadSection";
import URLSection from "../components/Scan/URLSection";
import PhishingDetector from "../components/Scan/PhishingDetector";
import Result from "../components/Scan/Result";
import api from "../services/api";
import { Shield, Anchor } from "lucide-react";

const DashboardPage = () => {
  const [activeTab, setActiveTab] = useState('url');
  const [file, setFile] = useState(null);
  const [url, setUrl] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState(null);

  const handleFileAnalysis = async () => {
    if (!file) return;
    setIsAnalyzing(true);
    setResult(null);
    try {
      const data = await api.scanFile(file);
      setResult({ type: "file", data: { ...data, filename: file.name } });
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
      const data = await api.scanUrl(url);
      setResult({ type: "url", data: { ...data, targetUrl: url } });
    } catch (error) {
      setResult({ type: "error", message: error.message || "Failed to analyze URL" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="flex justify-center mb-6">
          <div className="p-4 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 backdrop-blur-sm">
            <Shield className="w-12 h-12 text-cyan-400" />
          </div>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-400">
          Security Analysis Dashboard
        </h1>
        <p className="text-lg max-w-2xl mx-auto text-slate-300">
          Analyze URLs and files for potential security threats with our advanced detection system.
        </p>
      </div>

      {/* Tab Selector */}
      <div className="flex justify-center mb-8">
        <PhishingDetector activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>

      {/* Analysis Section */}
      <div className="rounded-3xl p-8 shadow-2xl backdrop-blur-lg border bg-slate-800/40 border-slate-700/50 mb-8">
        {activeTab === 'url' ? (
          <URLSection
            url={url}
            setUrl={setUrl}
            isAnalyzing={isAnalyzing}
            onAnalyze={handleUrlAnalysis}
          />
        ) : (
          <UploadSection
            file={file}
            setFile={setFile}
            isAnalyzing={isAnalyzing}
            onAnalyze={handleFileAnalysis}
          />
        )}
      </div>

      {/* Results */}
      {result && <Result result={result} />}

      {/* Help Text */}
      {!result && !isAnalyzing && (
        <div className="text-center mt-12 p-6 rounded-2xl bg-slate-800/20 backdrop-blur-sm border border-slate-700/30">
          <Anchor className="w-8 h-8 text-cyan-400 mx-auto mb-3" />
          <p className="text-slate-300 mb-2">
            <strong>New to ForgeHarbor?</strong>
          </p>
          <p className="text-sm text-slate-400">
            Simply {activeTab === 'url' ? 'enter a URL' : 'upload a file'} above to start your security analysis. 
            Our advanced algorithms will check for malware, phishing attempts, and other threats.
          </p>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;