import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Anchor, User, LogOut, History } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";

const Header = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header className="relative z-20">
      <div className="container mx-auto px-6 py-6">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-3">
            <div className="p-3 rounded-lg bg-slate-800/50 backdrop-blur-sm shadow-lg">
              <Anchor className="w-8 h-8 text-cyan-400" />
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight hidden sm:block">
              ForgeHarbor
            </h1>
          </Link>
          <nav className="flex items-center space-x-2 sm:space-x-4">
            {user ? (
              <>
                <Link to="/history" className="px-3 py-2 rounded-lg font-medium bg-slate-700/50 text-slate-300 hover:bg-slate-600/50 hover:text-white transition-colors flex items-center space-x-2">
                    <History className="w-4 h-4" />
                    <span className="hidden sm:inline">History</span>
                </Link>
                <Link to="/profile" className="px-3 py-2 rounded-lg font-medium bg-slate-700/50 text-slate-300 hover:bg-slate-600/50 hover:text-white transition-colors flex items-center space-x-2">
                  <User className="w-4 h-4" />
                  <span className="hidden sm:inline">{user.email}</span>
                </Link>
                <button onClick={handleLogout} className="px-3 py-2 rounded-lg font-medium bg-red-600/80 text-white hover:bg-red-600 transition-colors flex items-center space-x-2">
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="px-4 py-2 rounded-lg font-medium bg-slate-700/50 text-slate-300 hover:bg-slate-600/50 hover:text-white transition-colors">Login</Link>
                <Link to="/signup" className="px-4 py-2 rounded-lg font-medium bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:opacity-90 transition-opacity">Sign Up</Link>
              </>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header;