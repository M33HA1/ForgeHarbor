import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, FileSearch, History, Link2, ShieldCheck, ScanLine, LockKeyhole } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Result from '../components/Scan/Result';

export default function LandingPage() {
  const { user } = useAuth();
  const [example, setExample] = useState<'flagged' | 'clear'>('flagged');
  const capabilities = [
    { icon: Link2, title: 'URL analysis', text: 'Check a URL for phishing signals and review the explanation.', provider: 'Gemini' },
    { icon: FileSearch, title: 'File analysis', text: 'Submit a file for malware analysis and review vendor findings.', provider: 'VirusTotal' },
    { icon: History, title: 'History and reports', text: 'Keep scan evidence organized and generate downloadable reports.', provider: 'Your workspace' },
  ];
  return <div className="landing-page">
    <section className="landing-hero">
      <div className="landing-copy">
        <div className="product-category"><ScanLine size={17} /> URL and file threat analysis</div><h1>Investigate a link.<br />Understand the risk.</h1>
        <p>Check suspicious URLs and files. Read the evidence, keep your findings, and make a more informed next move.</p>
        <div className="landing-actions"><Link to={user ? '/app/dashboard' : '/signup'} className="primary-button">{user ? 'Open your workspace' : 'Create your workspace'}<ArrowRight size={17} /></Link>{!user && <Link to="/login" className="secondary-button">Login</Link>}</div>
        
        <div className="landing-trust"><span><ShieldCheck size={15} /> Authenticator sign-in</span><span><LockKeyhole size={15} /> Your own scan history</span></div>
      </div>
    </section>
    <section className="landing-example" aria-label="Example assessment">
        <div className="example-toolbar"><strong><ScanLine size={16} /> Inside your workspace</strong><span>Illustrative data</span></div><div className="preview-layout"><aside className="preview-rail"><span className="preview-selected"><Link2 size={16} /> Link analysis</span><span><FileSearch size={16} /> File analysis</span><span><History size={16} /> Scan history</span><div><strong>Evidence comes first.</strong><p>See the reported signal, the explanation, and what to do next.</p><small>Try the example outcomes</small></div></aside><div className="preview-content">
        <div className="example-switch" role="group" aria-label="Example outcome"><button aria-pressed={example === 'flagged'} onClick={()=>setExample('flagged')}>Flagged URL</button><button aria-pressed={example === 'clear'} onClick={()=>setExample('clear')}>No reported threat</button></div>
        <Result result={{type:'url',data:{is_malicious:false,is_phishing:example==='flagged',confidence_score:null,targetUrl:'https://account-check.example.invalid',details:example==='flagged' ? 'The page requests account credentials through an unrelated domain. Verify the sender before proceeding.' : 'No phishing signal was reported in this illustrative assessment. The result does not verify the sender or guarantee safety.'}}} />
      </div></div>
    </section>
    <section id="capabilities" className="landing-capabilities" aria-labelledby="capabilities-heading"><div className="section-intro"><h2 id="capabilities-heading">One investigation.<br />A clear record.</h2><p>Choose the check that matches the content you need to investigate.</p></div><div>{capabilities.map(({icon:Icon,title,text,provider})=><article key={title}><Icon size={20} aria-hidden="true" /><h3>{title}</h3><p>{text}</p><span>{provider}</span></article>)}</div></section>
    <section className="landing-disclosure-panel"><LockKeyhole size={20} /><div><h2>Know where your submission goes.</h2><p>URLs are sent to Gemini. Files are submitted to VirusTotal. Avoid confidential content. A scan provides signals, not a guarantee of safety.</p></div></section>

  </div>;
}
