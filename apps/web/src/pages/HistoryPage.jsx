import React from "react";
import ScanHistory from "../components/History/ScanHistory";

const HistoryPage = () => {
  return (
    <div>
      <h2 className="text-4xl font-bold text-center text-white mb-8">
        Scan History
      </h2>
      <ScanHistory />
    </div>
  );
};

export default HistoryPage;