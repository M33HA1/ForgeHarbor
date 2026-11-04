import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Anchor, User, LogOut, History, BarChart3 } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";

const Header = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <header className="relative z-20 border-b border-slate-800/60 bg-slate-900/40 backdrop-blur">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-3">
            <div className="p-2 rounded-md bg-slate-800/60 backdrop-blur-sm shadow">
              <Anchor className="w-8 h-8 text-cyan-400" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight hidden sm:block">
              ForgeHarbor
            </h1>
          </Link>
          
          <nav className="flex items-center space-x-2 sm:space-x-4">
            {user ? (
              <>
                <Link
                  to="/app/dashboard"
                  aria-label="Dashboard"
                  className="px-3 py-2 rounded-md font-medium bg-slate-800/60 text-slate-300 hover:bg-slate-700/60 hover:text-white transition-colors flex items-center space-x-2"
                >
                  <BarChart3 className="w-4 h-4" />
                  <span className="hidden sm:inline">Dashboard</span>
                </Link>
                <Link
                  to="/app/history"
                  aria-label="History"
                  className="px-3 py-2 rounded-md font-medium bg-slate-800/60 text-slate-300 hover:bg-slate-700/60 hover:text-white transition-colors flex items-center space-x-2"
                >
                  <History className="w-4 h-4" />
                  <span className="hidden sm:inline">History</span>
                </Link>
                <Link
                  to="/app/profile"
                  aria-label="Profile"
                  className="px-3 py-2 rounded-md font-medium bg-slate-800/60 text-slate-300 hover:bg-slate-700/60 hover:text-white transition-colors flex items-center space-x-2"
                >
                  <User className="w-4 h-4" />
                  <span className="hidden sm:inline">{user.email?.split('@')[0] || 'Profile'}</span>
                </Link>
                <button 
                  aria-label="Logout"
                  onClick={handleLogout} 
                  className="px-3 py-2 rounded-md font-medium bg-red-600/90 text-white hover:bg-red-600 transition-colors flex items-center space-x-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </>
            ) : (
              <>
                <Link 
                  to="/login" 
                  className="px-4 py-2 rounded-md font-medium bg-slate-800/60 text-slate-300 hover:bg-slate-700/60 hover:text-white transition-colors"
                >
                  Login
                </Link>
                <Link 
                  to="/signup" 
                  className="px-4 py-2 rounded-md font-medium bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:opacity-90 transition-opacity"
                >
                  Sign Up
                </Link>
              </>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header;
