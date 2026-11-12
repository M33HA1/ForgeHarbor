import { AlertTriangle, ArrowUpRight, CheckCircle2, FileSearch, Info, Link2, XCircle } from 'lucide-react';
import type { AnalysisResult } from '../../types';
import CopyButton from '../CopyButton';

const safeReportURL = (value?: string) => {
  if (!value) return undefined;
  try { const url = new URL(value); return url.protocol === 'https:' ? url.href : undefined; } catch { return undefined; }
};

export default function Result({ result }: { result: AnalysisResult | null }) {
  if (!result) return null;
  if (result.type === 'error') return <div role="alert" className="analysis-result result-error">
    <div className="result-verdict"><XCircle size={25} /><div><h2>Analysis Failed</h2><p>{result.message}</p></div></div>
    <p className="result-next-step">Check the input above and try again. No safety verdict was produced.</p>
  </div>;
  const { data } = result;
  const threat = data.is_malicious || data.is_phishing;
  const report = safeReportURL(data.report_url);
  const title = threat ? 'Threat detected' : 'No threats detected';
  return <div className={`analysis-result ${threat ? 'result-threat' : 'result-clear'}`}>
    <div className="result-verdict">{threat ? <AlertTriangle size={26} /> : <CheckCircle2 size={26} />}<div><h2>{title}</h2><p>{threat ? 'Treat this content as suspicious. Review the evidence below.' : 'This analysis did not report a threat. Consider the context before proceeding.'}</p></div><span className="result-state">Analysis complete</span></div>
    <div className="result-target">{result.type === 'url' ? <Link2 size={17} /> : <FileSearch size={17} />}<div><span>{result.type === 'url' ? 'URL Analyzed' : 'File Analyzed'}</span><p>{result.type === 'url' ? data.targetUrl : data.filename}</p></div>
      {(data.targetUrl || data.filename) && <CopyButton key={data.targetUrl || data.filename} value={(result.type === 'url' ? data.targetUrl : data.filename) || ''} label={result.type === 'url' ? 'Copy URL' : 'Copy filename'} />}
    </div>
    <dl className="result-evidence">
      <div><dt>Phishing signal</dt><dd>{result.type === 'url' ? data.is_phishing ? 'Detected' : 'Not detected' : 'Not assessed'}</dd></div>
      <div><dt>Malware signal</dt><dd>{result.type === 'file' ? data.is_malicious ? 'Detected' : 'Not detected' : 'Not assessed'}</dd></div>
      <div><dt>{result.type === 'file' ? 'Vendors flagged' : 'Provider confidence'}</dt><dd>{result.type === 'file' ? `${data.vendor_positives}/${data.total_vendors}` : `${data.confidence_score ?? 'N/A'}${data.confidence_score == null ? '' : '%'}`}</dd></div>
    </dl>
    {data.details && <div className="result-reason"><h3>What the analysis found</h3><p>{data.details}</p></div>}
    <div className="result-next-step"><Info size={17} /><p>{threat ? `Avoid opening this ${result.type === 'url' ? 'link' : 'file'} or entering personal information. Verify the sender through a separate, trusted channel.` : 'No scan guarantees safety. Verify the source and avoid sharing sensitive information if anything feels unexpected.'}</p></div>
    {report && <a href={report} target="_blank" rel="noopener noreferrer" className="result-history-link">View VirusTotal report <ArrowUpRight size={15} /></a>}
  </div>;
}
