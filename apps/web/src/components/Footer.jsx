// components/Footer.jsx
import React from 'react';
import { Shield, Heart, Fish, Waves } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="py-8">
      <div className="container mx-auto px-6">
        <div className="text-center">
          <div className="flex items-center justify-center mb-4">
            <Shield className="w-5 h-5 mr-2 text-cyan-400" />
            <p className="text-sm text-slate-300">
              Navigate digital seas safely with advanced threat detection
            </p>
          </div>
          
          <div className="flex items-center justify-center space-x-4 mb-4">
            <a 
              href="#" 
              className="text-sm hover:underline transition-colors text-slate-400 hover:text-cyan-300"
            >
              Privacy Policy
            </a>
            <span className="text-sm text-slate-600">•</span>
            <a 
              href="#" 
              className="text-sm hover:underline transition-colors text-slate-400 hover:text-cyan-300"
            >
              Terms of Service
            </a>
            <span className="text-sm text-slate-600">•</span>
            <a 
              href="#" 
              className="text-sm hover:underline transition-colors text-slate-400 hover:text-cyan-300"
            >
              Contact Support
            </a>
          </div>
          
          <div className="flex items-center justify-center space-x-2">
            <Fish className="w-4 h-4 text-cyan-400 animate-float" />
            <p className="text-xs text-slate-500 flex items-center">
              Made with <Heart className="w-3 h-3 mx-1 text-red-500 animate-pulse-slow" /> by ForgeHarbor Team
            </p>
            <Waves className="w-4 h-4 text-cyan-400 animate-wave" />
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;