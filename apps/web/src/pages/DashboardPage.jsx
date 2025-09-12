import React, { useState } from "react";
import UploadSection from "../components/Scan/UploadSection";
import URLSection from "../components/Scan/URLSection";
import Result from "../components/Scan/Result";
import api from "../services/api"; // Import the api service

const DashboardPage = () => {
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
      setResult({ type: "error", message: error.toString() });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleUrlAnalysis = async () => {
    if (!url) return;
    setIsAnalyzing(true);
    setResult(null);
    try {
      const data = await api.scanUrl(url);
      setResult({ type: "url", data: { ...data, targetUrl: url } });
    } catch (error) {
      setResult({ type: "error", message: error.toString() });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="text-center mb-12">
        <h1 className="text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-400">
          Secure Threat Detection
        </h1>
        <p className="text-xl max-w-3xl mx-auto text-slate-300">
          Analyze files and URLs for potential threats with confidence.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="rounded-3xl p-8 shadow-2xl backdrop-blur-lg border bg-slate-800/40 border-slate-700/50">
          <URLSection
            url={url}
            setUrl={setUrl}
            isAnalyzing={isAnalyzing}
            onAnalyze={handleUrlAnalysis}
          />
        </div>
        <div className="rounded-3xl p-8 shadow-2xl backdrop-blur-lg border bg-slate-800/40 border-slate-700/50">
          <UploadSection
            file={file}
            setFile={setFile}
            isAnalyzing={isAnalyzing}
            onAnalyze={handleFileAnalysis}
          />
        </div>
      </div>
      <div className="mt-8">
        <Result result={result} />
      </div>
    </div>
  );
};

export default DashboardPage;