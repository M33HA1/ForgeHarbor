import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { CheckCircle, XCircle, FileText, Link as LinkIcon } from 'lucide-react';

const ScanHistory = () => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHistory = async () => {
            setLoading(true);
            try {
                const historyData = await api.getScanHistory();
                setHistory(historyData);
            } catch (error) {
                console.error("Failed to fetch scan history:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();
    }, []);

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
                {history.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg">
                        <div className="flex items-center space-x-4 overflow-hidden">
                            {item.scan_type === 'url' ? <LinkIcon className="w-6 h-6 text-blue-400 flex-shrink-0" /> : <FileText className="w-6 h-6 text-green-400 flex-shrink-0" />}
                            <span className="truncate text-slate-300" title={item.target}>{item.target}</span>
                        </div>
                        <div className="flex items-center space-x-3 flex-shrink-0">
                            {item.is_malicious || item.is_phishing ? (
                                <XCircle className="w-6 h-6 text-yellow-400" />
                            ) : (
                                <CheckCircle className="w-6 h-6 text-green-400" />
                            )}
                            <span className="text-sm text-slate-400 hidden sm:block">{new Date(item.created_at).toLocaleDateString()}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ScanHistory;