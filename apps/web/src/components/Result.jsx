import React from 'react';
import { CheckCircle, AlertTriangle, XCircle, Shield, Link, FileText, AlertCircle, Fish, Waves, Anchor } from 'lucide-react';

const Result = ({ result }) => {
  if (!result) return null;

  const getResultIcon = (classification) => {
    switch (classification) {
      case 'secure':
        return <CheckCircle className="w-6 h-6 text-green-500" />;
      case 'flagged':
        return <AlertTriangle className="w-6 h-6 text-yellow-500" />;
      case 'high-risk':
        return <XCircle className="w-6 h-6 text-red-500" />;
      default:
        return <Shield className="w-6 h-6 text-blue-500" />;
    }
  };

  const getResultColor = (classification) => {
    switch (classification) {
      case 'secure':
        return 'bg-green-500/10 border-green-500/30';
      case 'flagged':
        return 'bg-yellow-500/10 border-yellow-500/30';
      case 'high-risk':
        return 'bg-red-500/10 border-red-500/30';
      default:
        return 'bg-blue-500/10 border-blue-500/30';
    }
  };

  const getResultTitle = (classification) => {
    switch (classification) {
      case 'secure':
        return 'Clean Waters';
      case 'flagged':
        return 'Murky Waters';
      case 'high-risk':
        return 'Dangerous Currents';
      default:
        return 'Unknown';
    }
  };

  const getResultDescription = (classification) => {
    switch (classification) {
      case 'secure':
        return 'No threats detected. This appears to be safe to navigate.';
      case 'flagged':
        return 'Some suspicious elements detected. Proceed with caution.';
      case 'high-risk':
        return 'Multiple threats detected. Avoid these dangerous waters!';
      default:
        return 'Analysis completed with mixed results.';
    }
  };

  // Calculate pie chart data
  const phishingScore = result.details?.phishingScore || 0;
  const malwareScore = result.details?.malwareScore || 0;
  const reputationScore = result.details?.reputationScore || 0;
  const totalScore = phishingScore + malwareScore + reputationScore;
  
  const phishingAngle = (phishingScore / totalScore) * 360;
  const malwareAngle = (malwareScore / totalScore) * 360;
  const reputationAngle = (reputationScore / totalScore) * 360;

  return (
    <div className={`mt-8 p-6 rounded-xl border backdrop-blur-sm ${getResultColor(result.classification)} animate-fade-in`}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column - Main Result */}
        <div className="space-y-6">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              {getResultIcon(result.classification)}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xl font-semibold text-white">
                  {getResultTitle(result.classification)}
                </h3>
                <div className="text-right">
                  <div className="text-3xl font-bold text-white">
                    {result.confidence}%
                  </div>
                  <div className="text-sm text-slate-400">
                    Confidence
                  </div>
                </div>
              </div>
              
              <p className="text-sm mb-4 text-slate-300">
                {getResultDescription(result.classification)}
              </p>

              {/* Analysis Details */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-slate-700/50">
                  <h4 className="font-medium text-sm mb-1 flex items-center text-slate-300">
                    <Fish className="w-4 h-4 mr-2" />
                    Analysis Type
                  </h4>
                  <p className="text-sm font-medium text-white">
                    {result.type === 'url' ? 'URL Analysis' : 'File Analysis'}
                  </p>
                </div>
                
                <div className="p-3 rounded-lg bg-slate-700/50">
                  <h4 className="font-medium text-sm mb-1 flex items-center text-slate-300">
                    {result.type === 'url' ? (
                      <Link className="w-4 h-4 mr-2" />
                    ) : (
                      <FileText className="w-4 h-4 mr-2" />
                    )}
                    {result.type === 'url' ? 'URL Tested' : 'File Analyzed'}
                  </h4>
                  <p className="text-sm text-slate-300 truncate">
                    {result.type === 'url' ? result.url : result.filename}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Threat Scores */}
          <div className="space-y-3">
            <h4 className="font-semibold text-white">
              Threat Analysis
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-300">Phishing Score</span>
                <div className="flex items-center space-x-2">
                  <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-red-500 rounded-full transition-all duration-500"
                      style={{ width: `${phishingScore}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium text-white">
                    {phishingScore}%
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-300">Malware Score</span>
                <div className="flex items-center space-x-2">
                  <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-orange-500 rounded-full transition-all duration-500"
                      style={{ width: `${malwareScore}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium text-white">
                    {malwareScore}%
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-300">Reputation Score</span>
                <div className="flex items-center space-x-2">
                  <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-green-500 rounded-full transition-all duration-500"
                      style={{ width: `${reputationScore}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium text-white">
                    {reputationScore}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Pie Chart and Details */}
        <div className="space-y-6">
          {/* Pie Chart */}
          <div className="flex justify-center">
            <div className="relative w-48 h-48">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                {/* Phishing Score */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="8"
                  strokeDasharray={`${(phishingAngle / 360) * 251.2} 251.2`}
                  strokeDashoffset="0"
                  className="transition-all duration-1000"
                />
                {/* Malware Score */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="#f97316"
                  strokeWidth="8"
                  strokeDasharray={`${(malwareAngle / 360) * 251.2} 251.2`}
                  strokeDashoffset={`-${(phishingAngle / 360) * 251.2}`}
                  className="transition-all duration-1000"
                />
                {/* Reputation Score */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="8"
                  strokeDasharray={`${(reputationAngle / 360) * 251.2} 251.2`}
                  strokeDashoffset={`-${((phishingAngle + malwareAngle) / 360) * 251.2}`}
                  className="transition-all duration-1000"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">
                    {result.confidence}%
                  </div>
                  <div className="text-xs text-slate-400">
                    Confidence
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Chart Legend */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span className="text-sm text-slate-300">
                Phishing Threat ({phishingScore}%)
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
              <span className="text-sm text-slate-300">
                Malware Risk ({malwareScore}%)
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-sm text-slate-300">
                Reputation ({reputationScore}%)
              </span>
            </div>
          </div>

          {/* Additional Details */}
          <div className="p-4 rounded-lg bg-slate-700/50">
            <h4 className="font-semibold mb-3 text-white">
              Analysis Details
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-300">Suspicious Elements</span>
                <span className="font-medium text-white">
                  {result.details?.suspiciousElements || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Last Scanned</span>
                <span className="font-medium text-white">
                  {result.details?.lastScanned || 'N/A'}
                </span>
              </div>
              {result.details?.fileSize && (
                <div className="flex justify-between">
                  <span className="text-slate-300">File Size</span>
                  <span className="font-medium text-white">
                    {result.details.fileSize}
                  </span>
                </div>
              )}
              {result.details?.domainAge && (
                <div className="flex justify-between">
                  <span className="text-slate-300">Domain Age</span>
                  <span className="font-medium text-white">
                    {result.details.domainAge}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Warning for High Risk */}
      {result.classification === 'high-risk' && (
        <div className="mt-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
            <div>
              <h4 className="font-semibold text-sm mb-1 text-red-300">
                ⚠️ Storm Warning!
              </h4>
              <p className="text-sm text-red-200">
                These waters contain multiple security threats. We strongly recommend avoiding this content and navigating to safer waters.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Result;