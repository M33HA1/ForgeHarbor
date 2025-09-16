import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Shield, 
  Anchor, 
  Fish, 
  Waves, 
  ChevronRight, 
  CheckCircle,
  Globe,
  FileText,
  Users,
  TrendingUp,
  Lock,
  Zap
} from 'lucide-react';

const LandingPage = () => {
  const features = [
    {
      icon: <Globe className="w-8 h-8 text-cyan-400" />,
      title: "URL Analysis",
      description: "Detect phishing attempts and malicious websites before you visit them"
    },
    {
      icon: <FileText className="w-8 h-8 text-blue-400" />,
      title: "File Scanning",
      description: "Upload and scan files for malware, viruses, and other threats"
    },
    {
      icon: <Shield className="w-8 h-8 text-green-400" />,
      title: "Real-time Protection",
      description: "Get instant results with our advanced threat detection algorithms"
    },
    {
      icon: <TrendingUp className="w-8 h-8 text-purple-400" />,
      title: "Scan History",
      description: "Track your security scans and maintain a comprehensive audit trail"
    }
  ];

  const stats = [
    { number: "1M+", label: "URLs Scanned" },
    { number: "500K+", label: "Files Analyzed" },
    { number: "99.9%", label: "Accuracy Rate" },
    { number: "24/7", label: "Protection" }
  ];

  const benefits = [
    "Advanced AI-powered threat detection",
    "Lightning-fast scan results",
    "Comprehensive security reports",
    "User-friendly dashboard",
    "Regular security updates",
    "Enterprise-grade security"
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative py-20 overflow-hidden">
        <div className="container mx-auto px-6 text-center">
          <div className="max-w-4xl mx-auto">
            <div className="flex justify-center mb-8">
              <div className="p-6 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 backdrop-blur-sm">
                <Anchor className="w-16 h-16 text-cyan-400" />
              </div>
            </div>
            
            <h1 className="text-6xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent leading-tight">
              Navigate Digital Seas Safely
            </h1>
            
            <p className="text-xl md:text-2xl text-slate-300 mb-8 max-w-3xl mx-auto leading-relaxed">
              ForgeHarbor provides advanced threat detection for URLs and files, 
              keeping you safe from phishing attacks, malware, and other digital dangers.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
              <Link
                to="/signup"
                className="group px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full text-white font-semibold text-lg hover:from-cyan-400 hover:to-blue-400 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center"
              >
                Get Started Free
                <ChevronRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              
              <Link
                to="/login"
                className="px-8 py-4 border-2 border-slate-600 rounded-full text-slate-300 font-semibold text-lg hover:border-cyan-400 hover:text-cyan-400 transition-all duration-300 flex items-center"
              >
                <Lock className="mr-2 w-5 h-5" />
                Sign In
              </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-16">
              {stats.map((stat, index) => (
                <div key={index} className="text-center">
                  <div className="text-3xl md:text-4xl font-bold text-white mb-2">
                    {stat.number}
                  </div>
                  <div className="text-slate-400 text-sm uppercase tracking-wide">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Comprehensive Security Features
            </h2>
            <p className="text-xl text-slate-300 max-w-3xl mx-auto">
              Our advanced security platform provides multi-layered protection 
              against the latest digital threats.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group p-8 rounded-2xl bg-slate-800/40 backdrop-blur-lg border border-slate-700/50 hover:border-cyan-400/50 transition-all duration-300 hover:transform hover:scale-105"
              >
                <div className="flex items-start space-x-4">
                  <div className="p-3 rounded-lg bg-slate-700/50 group-hover:bg-slate-600/50 transition-colors">
                    {feature.icon}
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-white mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-slate-300">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                Why Choose ForgeHarbor?
              </h2>
              <p className="text-xl text-slate-300">
                Built by security experts, trusted by professionals worldwide.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {benefits.map((benefit, index) => (
                <div
                  key={index}
                  className="flex items-center space-x-3 p-4 rounded-lg bg-slate-800/20 backdrop-blur-sm"
                >
                  <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0" />
                  <span className="text-slate-300">{benefit}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center">
            <div className="p-12 rounded-3xl bg-gradient-to-r from-cyan-500/10 to-blue-500/10 backdrop-blur-lg border border-cyan-400/20">
              <div className="flex justify-center mb-6">
                <div className="p-4 rounded-full bg-gradient-to-r from-cyan-500/20 to-blue-500/20">
                  <Zap className="w-12 h-12 text-cyan-400" />
                </div>
              </div>
              
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                Ready to Secure Your Digital Journey?
              </h2>
              
              <p className="text-xl text-slate-300 mb-8">
                Join thousands of users who trust ForgeHarbor to protect them 
                from digital threats. Start your free security scan today.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  to="/signup"
                  className="group px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full text-white font-semibold text-lg hover:from-cyan-400 hover:to-blue-400 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center justify-center"
                >
                  Start Free Analysis
                  <Fish className="ml-2 w-5 h-5 group-hover:animate-float" />
                </Link>
                
                <Link
                  to="/dashboard"
                  className="px-8 py-4 border-2 border-cyan-400 rounded-full text-cyan-400 font-semibold text-lg hover:bg-cyan-400 hover:text-white transition-all duration-300 flex items-center justify-center"
                >
                  <Waves className="mr-2 w-5 h-5" />
                  Try Demo
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;