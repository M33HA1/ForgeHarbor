import React from 'react';
import { CheckCircle, AlertTriangle, XCircle, Shield, Link, FileText, AlertCircle } from 'lucide-react';

const Result = ({ result }) => {
  if (!result) return null;

  // Handle error results
  if (result.type === 'error') {
    return (
      <div className="mt-8 p-6 rounded-xl border backdrop-blur-sm bg-red-500/10 border-red-500/30 animate-fade-in">
        <div className="flex items-center space-x-4">
          <XCircle className="w-6 h-6 text-red-500" />
          <div>
            <h3 className="text-xl font-semibold text-white">Analysis Failed</h3>
            <p className="text-red-300 mt-2">{result.message}</p>
          </div>
        </div>
      </div>
    );
  }

  const data = result.data;
  const isSecure = !data.is_malicious && !data.is_phishing;
  const hasThreats = data.is_malicious || data.is_phishing;
  
  const getResultIcon = () => {
    if (isSecure) return <CheckCircle className="w-6 h-6 text-green-500" />;
    if (hasThreats) return <XCircle className="w-6 h-6 text-red-500" />;
    return <AlertTriangle className="w-6 h-6 text-yellow-500" />;
  };

  const getResultColor = () => {
    if (isSecure) return 'bg-green-500/10 border-green-500/30';
    if (hasThreats) return 'bg-red-500/10 border-red-500/30';
    return 'bg-yellow-500/10 border-yellow-500/30';
  };

  const getResultTitle = () => {
    if (isSecure) return 'Clean Waters - Safe to Navigate';
    if (hasThreats) return 'Dangerous Currents Detected';
    return 'Proceed with Caution';
  };

  const getResultDescription = () => {
    if (isSecure) return 'No threats detected. This appears to be safe.';
    if (data.is_malicious && data.is_phishing) return 'Both malware and phishing threats detected. Avoid this content!';
    if (data.is_malicious) return 'Malware detected. This content is dangerous.';
    if (data.is_phishing) return 'Phishing attempt detected. This may steal your information.';
    return 'Analysis completed with mixed results.';
  };

  return (
    <div className={`mt-8 p-6 rounded-xl border backdrop-blur-sm ${getResultColor()} animate-fade-in`}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Result */}
        <div className="lg:col-span-2">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              {getResultIcon()}
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-white mb-2">
                {getResultTitle()}
              </h3>
              <p className="text-slate-300 mb-4">
                {getResultDescription()}
              </p>

              {/* Target Information */}
              <div className="p-4 rounded-lg bg-slate-700/50 mb-4">
                <div className="flex items-center space-x-2 mb-2">
                  {result.type === 'url' ? (
                    <Link className="w-4 h-4 text-blue-400" />
                  ) : (
                    <FileText className="w-4 h-4 text-green-400" />
                  )}
                  <span className="text-sm font-medium text-slate-300">
                    {result.type === 'url' ? 'URL Analyzed' : 'File Analyzed'}
                  </span>
                </div>
                <p className="text-white font-medium break-all">
                  {result.type === 'url' ? data.targetUrl : data.filename}
                </p>
              </div>

              {/* Threat Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="text-center p-3 rounded-lg bg-slate-700/30">
                  <div className="text-lg font-bold text-white">
                    {data.is_malicious ? 'YES' : 'NO'}
                  </div>
                  <div className="text-xs text-slate-400">Malware</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-slate-700/30">
                  <div className="text-lg font-bold text-white">
                    {data.is_phishing ? 'YES' : 'NO'}
                  </div>
                  <div className="text-xs text-slate-400">Phishing</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-slate-700/30">
                  <div className="text-lg font-bold text-white">
                    {data.confidence_score || 85}%
                  </div>
                  <div className="text-xs text-slate-400">Confidence</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-slate-700/50">
            <h4 className="font-semibold text-white mb-3">Scan Details</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-300">Scan Type</span>
                <span className="text-white capitalize">{result.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Status</span>
                <span className={`font-medium ${
                  isSecure ? 'text-green-400' : 
                  hasThreats ? 'text-red-400' : 'text-yellow-400'
                }`}>
                  {isSecure ? 'Safe' : hasThreats ? 'Threat' : 'Warning'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Scanned</span>
                <span className="text-white">Just now</span>
              </div>
            </div>
          </div>

          {data.details && (
            <div className="p-4 rounded-lg bg-slate-700/50">
              <h4 className="font-semibold text-white mb-3">Additional Info</h4>
              <div className="space-y-2 text-sm">
                {data.details.domain_age && (
                  <div className="flex justify-between">
                    <span className="text-slate-300">Domain Age</span>
                    <span className="text-white">{data.details.domain_age}</span>
                  </div>
                )}
                {data.details.file_size && (
                  <div className="flex justify-between">
                    <span className="text-slate-300">File Size</span>
                    <span className="text-white">{data.details.file_size}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* High Risk Warning */}
      {hasThreats && (
        <div className="mt-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
            <div>
              <h4 className="font-semibold text-sm mb-1 text-red-300">
                 Security Warning!
              </h4>
              <p className="text-sm text-red-200">
                This content contains security threats. We strongly recommend avoiding 
                this {result.type === 'url' ? 'website' : 'file'} and not downloading or accessing it.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Result;