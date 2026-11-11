import React from "react";
import ScanHistory from "../components/History/ScanHistory";
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';

const HistoryPage = () => {
  return (
    <div className="history-page">
      <div className="workspace-topbar"><span>Workspace <span aria-hidden="true">/</span> Scan history</span></div>
      <div className="page-heading"><div><h1>Scan History</h1><p>Revisit findings, narrow your search, and download scan reports.</p></div><Link to="/app/dashboard" className="primary-button"><Plus size={16} /> New analysis</Link></div>
      <ScanHistory />
    </div>
  );
};

export default HistoryPage;
