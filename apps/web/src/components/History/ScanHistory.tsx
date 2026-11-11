import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { CheckCircle, XCircle, FileText, Link as LinkIcon, Download as DownloadIcon, HelpCircle, SearchX } from 'lucide-react';

import { Link } from 'react-router-dom';

import type { ScanRecord } from '../../types';
import { errorMessage, scanId as recordId, historyPage } from '../../types';

const ScanHistory = () => {
    const [history, setHistory] = useState<ScanRecord[]>([]);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState('');
    const [actionMessage, setActionMessage] = useState('');
    const [reportIds, setReportIds] = useState<Record<string, string>>({});
    const [typeFilter, setTypeFilter] = useState('');
    const [riskFilter, setRiskFilter] = useState('');
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

    const restoreReportIds = async (items: ScanRecord[]) => {
        const scanIds = [...new Set(items
            .map((item) => recordId(item))
            .filter(Boolean)
            .map(String))];
        if (scanIds.length === 0) return;
        try {
            const reports = await api.getReportsForScans(scanIds);
            const restored: Record<string, string> = {};
            reports.forEach((report) => {
                const scanId = report.scanId || report.scan_id;
                const reportId = report.id || report.reportId || report.report_id;
                if (scanId && reportId && !restored[String(scanId)]) {
                    restored[String(scanId)] = String(reportId);
                }
            });
            setReportIds((current) => ({ ...current, ...restored }));
        } catch {
            setActionMessage('Saved report links could not be loaded.');
        }
    };

    useEffect(() => {
        let isCurrentRequest = true;
        const fetchHistory = async () => {
            setLoading(true);
            setError('');
            try {
                const params = {
                    ...(typeFilter && { type: typeFilter }),
                    ...(riskFilter && { risk: riskFilter }),
                };
                const data = historyPage(await api.getScanHistory(params));
                if (!isCurrentRequest) return;
                const items = Array.isArray(data) ? data : (data?.items || []);
                setHistory(items);
                setNextCursor(data?.next_cursor || null);
                void restoreReportIds(items);
            } catch (error) {
                if (!isCurrentRequest) return;
                setHistory([]);
                setNextCursor(null);
                setError(errorMessage(error, 'Unable to load scan history.'));
                console.error("Failed to fetch scan history:", error);
            } finally {
                if (isCurrentRequest) setLoading(false);
            }
        };
        fetchHistory();
        return () => { isCurrentRequest = false; };
    }, [typeFilter, riskFilter]);

    const loadMore = async () => {
        if (!nextCursor || loadingMore) return;
        setLoadingMore(true);
        setError('');
        try {
            const data = historyPage(await api.getScanHistory({
                cursor: nextCursor,
                ...(typeFilter && { type: typeFilter }),
                ...(riskFilter && { risk: riskFilter }),
            }));
            const items = Array.isArray(data) ? data : (data?.items || []);
            setHistory(prev => [...prev, ...items]);
            setNextCursor(data?.next_cursor || null);
            void restoreReportIds(items);
        } catch (error) {
            setError(errorMessage(error, 'Unable to load more scan history.'));
            console.error('Failed to load more history:', error);
        } finally {
            setLoadingMore(false);
        }
    };

    const handleGenerateReport = async (item: ScanRecord) => {
        const scanId = recordId(item);
        setActionMessage('');
        try {
            setActionLoadingId(String(scanId));
            const report = await api.generateReport(String(scanId));
            const reportId = report?.id || report?.reportId;
            if (!reportId) throw new Error('The report was created but no download ID was returned.');
            setReportIds((current) => ({ ...current, [String(scanId)]: String(reportId) }));
            setActionMessage('Report created. Download is ready for this scan.');
        } catch (error) {
            setActionMessage(errorMessage(error, 'Failed to generate the report.'));
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleDownloadReport = async (reportId: string) => {
        setActionMessage('');
        try {
            setActionLoadingId(String(reportId));
            const blob = await api.downloadReport(reportId);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `report-${reportId}.json`;
            a.click();
            window.URL.revokeObjectURL(url);
            setActionMessage('Report download started.');
        } catch (error) {
            setActionMessage(errorMessage(error, 'Failed to download the report.'));
        } finally {
            setActionLoadingId(null);
        }
    };

    return (
        <div className="history-panel">
            <div className="mb-6 flex flex-col gap-4 border-b border-slate-300 pb-5 sm:flex-row sm:items-end">
                <label className="flex flex-1 flex-col gap-2 text-sm font-medium text-slate-500">
                    Scan type
                    <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm normal-case tracking-normal text-slate-700 focus:border-teal-300">
                        <option value="">All types</option>
                        <option value="url">URL scans</option>
                        <option value="file">File scans</option>
                    </select>
                </label>
                <label className="flex flex-1 flex-col gap-2 text-sm font-medium text-slate-500">
                    Risk level
                    <select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm normal-case tracking-normal text-slate-700 focus:border-teal-300">
                        <option value="">All risk levels</option>
                        <option value="high">High risk</option>
                        <option value="low">Low risk</option>
                    </select>
                </label>
            </div>

            {error && <p role="alert" className="mb-4 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-700">{error}</p>}
            {actionMessage && <p role="status" aria-live="polite" className="mb-4 rounded-xl border border-teal-300/20 bg-teal-300/10 p-3 text-sm text-teal-900">{actionMessage}</p>}
            {loading ? (
                <p className="py-8 text-center text-slate-500" role="status">Loading scan history...</p>
            ) : error && history.length === 0 ? null : history.length === 0 ? (
                <div className="history-empty"><SearchX size={30} /><h2>{typeFilter || riskFilter ? 'No scans match these filters.' : 'No scans yet'}</h2><p>{typeFilter || riskFilter ? 'Try broadening the filters to see more of your saved evidence.' : 'Links and files you analyze will appear here, with reports you can revisit.'}</p>{typeFilter || riskFilter ? <button className="secondary-button" onClick={() => { setTypeFilter(''); setRiskFilter(''); }}>Clear filters</button> : <Link to="/app/dashboard" className="primary-button">Start an analysis</Link>}</div>
            ) : (
            <div className="space-y-4">
                {history.map((item) => {
                    const id = recordId(item);
                    const reportId = reportIds[String(id)] || item.reportId || item.report_id;
                    const type = item.type || item.scan_type;
                    const rawTarget = item.target || item.url || item.filename || item.name || item.input || 'Unknown';
                    const target = typeof rawTarget === 'string' ? rawTarget.trim() : String(rawTarget);
                    const createdAt = item.created_at || item.createdAt || item.timestamp || item.time || item.date;
                    const isMalicious = Boolean(
                        item.is_malicious || item.is_phishing || item?.result?.risk_level === 'high' || item?.result?.malicious === true || item?.result?.phishing === true
                    );
                    const hasVerdict = isMalicious || item?.result?.risk_level === 'low' || typeof item.is_malicious === 'boolean' || typeof item.is_phishing === 'boolean' || typeof item?.result?.malicious === 'boolean' || typeof item?.result?.phishing === 'boolean';
                    const status = isMalicious ? 'Threat detected' : hasVerdict ? 'No threats detected' : 'Not assessed';
                    const isUrl = type === 'url' || (/^https?:\/\//i.test(String(target)) || String(target).startsWith('www.'));
                    return (
                        <div key={String(id)} className="history-row">
                            <div className="history-target">
                                {isUrl ? (
                                    <LinkIcon className="w-6 h-6 text-blue-700 shrink-0" />
                                ) : (
                                    <FileText className="w-6 h-6 text-green-700 shrink-0" />
                                )}
                                <span className="truncate text-slate-700" title={String(target) || 'Unknown'}>{String(target) || 'Unknown'}</span>
                            </div>
                            <div className="history-actions">
                                <span className={`history-verdict ${isMalicious ? 'is-threat' : hasVerdict ? 'is-clear' : 'is-unknown'}`}>
                                    {isMalicious ? <XCircle size={14} /> : hasVerdict ? <CheckCircle size={14} /> : <HelpCircle size={14} />}{status}
                                </span>
                                {createdAt && (
                                    <span className="text-sm text-slate-500 hidden sm:block">{new Date(createdAt).toLocaleDateString()}</span>
                                )}
            <button
                                    className="secondary-button history-action"
                                    onClick={() => handleGenerateReport(item)}
                                    disabled={actionLoadingId !== null}
                                >
                                    {actionLoadingId === String(id) ? 'Generating…' : 'Generate report'}
                                </button>
                                {reportId && (
                                    <button
                                        className="icon-button history-action"
                                        title="Download Report"
                                        onClick={() => handleDownloadReport(reportId)}
                                        disabled={actionLoadingId !== null}
                                    >
                                        <DownloadIcon className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
            )}
            {nextCursor && (
                <div className="mt-6 text-center">
                    <button
                        className="px-4 py-2 rounded bg-white hover:bg-slate-500 text-slate-900"
                        onClick={loadMore}
                        disabled={loadingMore}
                    >
                        {loadingMore ? 'Loading…' : 'Load More'}
                    </button>
                </div>
            )}
        </div>
    );
};

export default ScanHistory;
