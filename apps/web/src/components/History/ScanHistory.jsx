import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { CheckCircle, XCircle, FileText, Link as LinkIcon, Download as DownloadIcon } from 'lucide-react';

const ScanHistory = () => {
    const [history, setHistory] = useState([]);
    const [nextCursor, setNextCursor] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionLoadingId, setActionLoadingId] = useState(null);

    useEffect(() => {
        const fetchHistory = async (cursor) => {
            setLoading(true);
            try {
                const data = await api.getScanHistory(cursor ? { cursor } : {});
                const items = Array.isArray(data) ? data : (data?.items || []);
                setHistory(items);
                setNextCursor(data?.next_cursor || null);
            } catch (error) {
                console.error("Failed to fetch scan history:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();
    }, []);

    const loadMore = async () => {
        if (!nextCursor) return;
        try {
            const data = await api.getScanHistory({ cursor: nextCursor });
            const items = Array.isArray(data) ? data : (data?.items || []);
            setHistory(prev => [...prev, ...items]);
            setNextCursor(data?.next_cursor || null);
        } catch (error) {
            console.error('Failed to load more history:', error);
        }
    };

    const handleGenerateReport = async (item) => {
        try {
            setActionLoadingId(item._id || item.id);
            const scanId = (item._id?.$oid) || item._id || item.id;
            const content = JSON.stringify(item);
            await api.generateReport(String(scanId), content);
            // Optionally give user feedback; for brevity we console.log
            console.log('Report generated for scan', scanId);
        } catch (error) {
            console.error('Failed to generate report:', error);
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleDownloadReport = async (reportId) => {
        try {
            setActionLoadingId(reportId);
            const blob = await api.downloadReport(reportId);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `report-${reportId}.json`;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Failed to download report:', error);
        } finally {
            setActionLoadingId(null);
        }
    };

    if (loading) {
        return <p className="text-center">Loading scan history...</p>;
    }

    if (!history || history.length === 0) {
        return (
            <div className="text-center rounded-3xl p-8 shadow-2xl backdrop-blur-lg border bg-slate-800/40 border-slate-700/50">
                <p className="text-slate-300">No scan history found.</p>
            </div>
        );
    }

    return (
        <div className="rounded-3xl p-8 shadow-2xl backdrop-blur-lg border bg-slate-800/40 border-slate-700/50">
            <div className="space-y-4">
                {history.map((item) => {
                    const id = item._id?.$oid || item._id || item.id;
                    const type = item.type || item.scan_type;
                    const rawTarget = item.target || item.url || item.filename || item.name || item.input || 'Unknown';
                    const target = typeof rawTarget === 'string' ? rawTarget.trim() : String(rawTarget);
                    const createdAt = item.created_at || item.createdAt || item.timestamp || item.time || item.date;
                    const isMalicious = Boolean(
                        item.is_malicious || item.is_phishing || item?.result?.risk_level === 'high' || item?.result?.phishing === true
                    );
                    const isUrl = type === 'url' || (/^https?:\/\//i.test(String(target)) || String(target).startsWith('www.'));
                    return (
                        <div key={String(id)} className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg">
                            <div className="flex items-center space-x-4 overflow-hidden">
                                {isUrl ? (
                                    <LinkIcon className="w-6 h-6 text-blue-400 flex-shrink-0" />
                                ) : (
                                    <FileText className="w-6 h-6 text-green-400 flex-shrink-0" />
                                )}
                                <span className="truncate text-slate-300" title={String(target) || 'Unknown'}>{String(target) || 'Unknown'}</span>
                            </div>
                            <div className="flex items-center space-x-3 flex-shrink-0">
                                {isMalicious ? (
                                    <XCircle className="w-6 h-6 text-yellow-400" />
                                ) : (
                                    <CheckCircle className="w-6 h-6 text-green-400" />
                                )}
                                {createdAt && (
                                    <span className="text-sm text-slate-400 hidden sm:block">{new Date(createdAt).toLocaleDateString()}</span>
                                )}
                                <button
                                    className="px-2 py-1 text-xs rounded bg-slate-600 hover:bg-slate-500 text-white"
                                    onClick={() => handleGenerateReport(item)}
                                    disabled={actionLoadingId === id}
                                >
                                    {actionLoadingId === id ? 'Generating…' : 'Generate Report'}
                                </button>
                                {item.reportId && (
                                    <button
                                        className="p-2 rounded bg-slate-600 hover:bg-slate-500 text-white"
                                        title="Download Report"
                                        onClick={() => handleDownloadReport(item.reportId)}
                                        disabled={actionLoadingId === item.reportId}
                                    >
                                        <DownloadIcon className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
            {nextCursor && (
                <div className="mt-6 text-center">
                    <button
                        className="px-4 py-2 rounded bg-slate-600 hover:bg-slate-500 text-white"
                        onClick={loadMore}
                    >
                        Load More
                    </button>
                </div>
            )}
        </div>
    );
};

export default ScanHistory;