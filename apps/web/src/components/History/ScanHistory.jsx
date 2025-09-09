import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/api';
import { History, FileText, Link, Download, Eye, Loader2 } from 'lucide-react';

const ScanHistory = () => {
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      fetchHistory();
    }
  }, [isAuthenticated]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const data = await apiService.getScanHistory({ limit: 50 });
      setScans(data.items || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async (scanId) => {
    try {
      const scanDetails = await apiService.getScanDetails(scanId);
      const report = await apiService.generateReport(scanId, JSON.stringify(scanDetails));
      const blob = await apiService.downloadReport(report.id);
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `scan-report-${scanId}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Report generation failed:', err);
    }
  };

  const getRiskColor = (result) => {
    if (result.malicious || result.phishing) return 'text-red-500';
    if (result.confidence < 70) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getRiskLabel = (result) => {
    if (result.malicious || result.phishing) return 'High Risk';
    if (result.confidence < 70) return 'Medium Risk';
    return 'Clean';
  };

  const filteredScans = scans.filter(scan => {
    if (filter === 'all') return true;
    if (filter === 'file') return scan.scan_type === 'file';
    if (filter === 'url') return scan.scan_type === 'url';
    return true;
  });

  if (!isAuthenticated) {
    return (
      <div className="text-center py-12">
        <History className="w-16 h-16 text-slate-400 mx-auto mb-4" />
        <p className="text-slate-400">Please login to view your scan history</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mr-3" />
        <span className="text-slate-300">Loading scan history...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400">Error loading history: {error}</p>
        <button 
          onClick={fetchHistory}
          className="mt-4 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-white rounded-lg transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white flex items-center">
          <History className="w-6 h-6 mr-3" />
          Scan History
        </h2>
        
        <div className="flex space-x-2">
          {['all', 'file', 'url'].map(filterType => (
            <button
              key={filterType}
              onClick={() => setFilter(filterType)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors capitalize ${
                filter === filterType
                  ? 'bg-cyan-500 text-white'
                  : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600/50'
              }`}
            >
              {filterType} {filterType !== 'all' && 'Scans'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4">
        {filteredScans.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <History className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>No scan history found</p>
          </div>
        ) : (
          filteredScans.map(scan => (
            <div key={scan._id} className="p-6 rounded-xl bg-slate-800/40 border border-slate-700/50">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    {scan.scan_type === 'file' ? (
                      <FileText className="w-5 h-5 text-blue-400" />
                    ) : (
                      <Link className="w-5 h-5 text-green-400" />
                    )}
                    <h3 className="font-medium text-white">
                      {scan.scan_type === 'file' ? 'File Scan' : 'URL Scan'}
                    </h3>
                    <span className={`text-sm font-medium ${getRiskColor(scan.result)}`}>
                      {getRiskLabel(scan.result)}
                    </span>
                  </div>
                  
                  <p className="text-slate-300 mb-2 truncate">{scan.input}</p>
                  
                  <div className="text-sm text-slate-400">
                    Scanned: {new Date(scan.created_at).toLocaleString()}
                  </div>
                  
                  {scan.result.vendor_positives && (
                    <div className="text-sm text-slate-400">
                      Detections: {scan.result.vendor_positives}/{scan.result.total_vendors} vendors
                    </div>
                  )}
                </div>
                
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleGenerateReport(scan._id)}
                    className="p-2 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 hover:text-white transition-colors"
                    title="Generate Report"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ScanHistory;