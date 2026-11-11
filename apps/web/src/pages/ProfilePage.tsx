import React from "react";
import { useAuth } from "../contexts/AuthContext";
import UserProfile from "../components/Profile/UserProfile";
import ServiceHealth from "../components/Profile/ServiceHealth";
import MFASettings from "../components/Profile/MFASettings";
import { Navigate } from "react-router-dom";

const ProfilePage = () => {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" />;
  }

  return (
    <div className="settings-page">
      <div className="workspace-topbar"><span>Workspace <span aria-hidden="true">/</span> Account &amp; security</span></div>
      <div className="page-heading"><div><h1>Account and security</h1><p>Manage your account, protect sign-in, and check service availability.</p></div></div>
      <div className="settings-stack">
      <UserProfile user={user} />
      <MFASettings />
      <ServiceHealth />
      </div>
    </div>
  );
};

export default ProfilePage;
