import React, { useState, useEffect } from "react";
import {
  Anchor,
  Fish,
  Waves,
  Search,
  FileText,
} from "lucide-react";

import PhishingDetector from "./components/PhishingDetector";
import UploadSection from "./components/UploadSection";
import URLSection from "./components/URLSection";
import Result from "./components/Result";
import Footer from "./components/Footer";
import FloatingElements from "./components/FloatingElements";

const App = () => {
  const [currentPage, setCurrentPage] = useState("landing");
  const [file, setFile] = useState(null);
  const [url, setUrl] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState(null);

  const API_BASE_URL = "http://127.0.0.1:8080";

  useEffect(() => {
    document.body.classList.add("dark");
  }, []);

  const handleNavigate = (page) => {
    setCurrentPage(page);
    setResult(null);
    setFile(null);
    setUrl("");
  };

  const handleFileAnalysis = async () => {
    if (!file) return;
    setIsAnalyzing(true);
    setResult(null);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const response = await fetch(`${API_BASE_URL}/api/file-analyze`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "File analysis failed");
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
      const response = await fetch(`${API_BASE_URL}/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.result?.reason || "URL analysis failed");
      setResult({ type: "url", data: { ...data, targetUrl: url } });
    } catch (error) {
      setResult({ type: "error", message: error.toString() });
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (currentPage === "landing") {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="flex-1 relative overflow-hidden flex flex-col">
          <FloatingElements />
          <header className="relative z-20">
            <div className="container mx-auto px-6 py-6">
              <div className="flex items-center justify-center">
                <div className="flex items-center space-x-3">
                  <div className="p-3 rounded-lg bg-slate-800/50 backdrop-blur-sm shadow-lg flex items-center justify-center">
                    <Anchor className="w-12 h-12 text-cyan-400" />
                  </div>
                  <div>
                    <h1 className="text-5xl md:text-7xl font-extrabold text-white tracking-tight drop-shadow-lg">
                      ForgeHarbor
                    </h1>
                    <p className="text-lg md:text-2xl text-slate-400 mt-2 px-16 py-2">
                      Navigate Digital Seas Safely
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </header>
          <main className="relative z-10 container mx-auto px-6 py-14 flex-grow">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-16 animate-fade-in">
                <div className="mb-8">
                  {/* <div className="inline-flex items-center justify-center w-24 h-24 rounded-full mb-8 bg-slate-800/50 backdrop-blur-sm shadow-lg"><Compass className="w-12 h-12 text-cyan-400" /></div> */}
                  <h2 className="text-5xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-400">
                    Secure Threat Detection
                  </h2>
                  <p className="text-xl max-w-4xl mx-auto text-slate-300 mb-8">
                    Welcome to ForgeHarbor, your secure port in the digital
                    storm. We provide advanced threat detection for files and
                    URLs, helping you navigate the treacherous waters of the
                    internet with confidence and safety.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
                <div
                  onClick={() => handleNavigate("url-analysis")}
                  className="group cursor-pointer p-8 rounded-2xl backdrop-blur-sm border bg-slate-800/30 border-slate-700/50 hover:bg-slate-700/50 hover:border-cyan-400/50 transition-all duration-300 transform hover:scale-105"
                >
                  <div className="text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-6 bg-blue-500/20 group-hover:bg-blue-500/30 transition-colors">
                      <Search className="w-8 h-8 text-blue-400" />
                    </div>
                    <h3 className="text-2xl font-bold mb-4 text-white">
                      URL Analysis
                    </h3>
                    <p className="text-slate-300 mb-6">
                      Test suspicious URLs and websites for phishing attempts,
                      malware distribution, and other security threats.
                    </p>
                    <div className="flex items-center justify-center space-x-2 text-blue-400">
                      <span className="font-medium">Dive Deep & Analyze</span>
                      <Waves className="w-4 h-4" />
                    </div>
                  </div>
                </div>
                <div
                  onClick={() => handleNavigate("file-analysis")}
                  className="group cursor-pointer p-8 rounded-2xl backdrop-blur-sm border bg-slate-800/30 border-slate-700/50 hover:bg-slate-700/50 hover:border-cyan-400/50 transition-all duration-300 transform hover:scale-105"
                >
                  <div className="text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-6 bg-green-500/20 group-hover:bg-green-500/30 transition-colors">
                      <FileText className="w-8 h-8 text-green-400" />
                    </div>
                    <h3 className="text-2xl font-bold mb-4 text-white">
                      File Analysis
                    </h3>
                    <p className="text-slate-300 mb-6">
                      Upload and analyze files for embedded malware, suspicious
                      code, and security vulnerabilities.
                    </p>
                    <div className="flex items-center justify-center space-x-2 text-green-400">
                      <span className="font-medium">Examine Your Catch</span>
                      <Fish className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </main>
          <div className="relative z-10">
            <Footer />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 relative overflow-hidden flex flex-col">
        <FloatingElements />
        <header className="relative z-20">
          <div className="container mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => handleNavigate("landing")}
                  // className="p-2 rounded-lg bg-slate-800/50 backdrop-blur-sm shadow-lg hover:bg-slate-700/50 transition-colors"
                >
                  {/* <ArrowLeft className="w-6 h-6 text-cyan-400" /> */}

                  <div className="flex items-center space-x-3">
                    <div className="p-3 rounded-lg bg-slate-800/50 backdrop-blur-sm shadow-lg flex items-center justify-center">
                      <Anchor className="w-12 h-12 text-cyan-400" />
                    </div>
                    <div>
                      <h1 className="text-3xl md:text-4xl font-extrabold text-white">
                        ForgeHarbor
                      </h1>
                    </div>
                  </div>
                </button>
              </div>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => handleNavigate("file-analysis")}
                  className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 flex items-center space-x-2 ${
                    currentPage === "file-analysis"
                      ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg"
                      : "bg-slate-700/50 text-slate-300 hover:bg-slate-600/50 hover:text-white"
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>File Analysis</span>
                </button>
                <button
                  onClick={() => handleNavigate("url-analysis")}
                  className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 flex items-center space-x-2 ${
                    currentPage === "url-analysis"
                      ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg"
                      : "bg-slate-700/50 text-slate-300 hover:bg-slate-600/50 hover:text-white"
                  }`}
                >
                  <Search className="w-4 h-4" />
                  <span>URL Analysis</span>
                </button>
              </div>
            </div>
          </div>
        </header>
        <main className="relative z-10 container mx-auto px-6 py-12 flex-grow flex flex-col items-center">
          {/* Page Heading */}
          <h2 className="text-4xl font-bold text-center text-white mb-8">
            {currentPage === "file-analysis" ? "File Analysis" : "URL Analysis"}
          </h2>

          {/* Analysis Box */}
          <div className="w-full max-w-3xl">
            <div className="rounded-3xl p-10 shadow-2xl backdrop-blur-lg border bg-slate-800/40 border-slate-700/50">
              {currentPage === "file-analysis" ? (
                <UploadSection
                  file={file}
                  setFile={setFile}
                  isAnalyzing={isAnalyzing}
                  onAnalyze={handleFileAnalysis}
                />
              ) : (
                <URLSection
                  url={url}
                  setUrl={setUrl}
                  isAnalyzing={isAnalyzing}
                  onAnalyze={handleUrlAnalysis}
                />
              )}
              <Result result={result} />
            </div>
          </div>
        </main>

        <div className="relative z-10">
          <Footer />
        </div>
      </div>
    </div>
  );
};

export default App;
