import React from 'react';
import { User, Mail } from 'lucide-react';

const UserProfile = ({ user }) => (
    <div className="rounded-3xl p-8 shadow-2xl backdrop-blur-lg border bg-slate-800/40 border-slate-700/50">
        <div className="flex items-center space-x-6">
            <div className="p-4 rounded-full bg-cyan-500/20">
                <User className="w-12 h-12 text-cyan-400" />
            </div>
            <div>
                <h2 className="text-3xl font-bold text-white">User Profile</h2>
                <div className="flex items-center space-x-2 mt-2 text-slate-300">
                    <Mail className="w-5 h-5" />
                    <span>{user.email}</span>
                </div>
            </div>
        </div>
    </div>
);

export default UserProfile;
