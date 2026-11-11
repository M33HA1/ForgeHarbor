import React from 'react';
import { User, Mail } from 'lucide-react';

const UserProfile = ({ user }: { user: { email: string } }) => (
    <div className="profile-summary">
        <div className="profile-identity">
            <div className="profile-avatar">
                <User size={28} aria-hidden="true" />
            </div>
            <div className="profile-identity-copy">
                <h2 className="text-3xl font-bold text-slate-900">User Profile</h2>
                <div className="flex items-center space-x-2 mt-2 text-slate-700">
                    <Mail className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>{user.email}</span>
                </div>
            </div>
        </div>
    </div>
);

export default UserProfile;
