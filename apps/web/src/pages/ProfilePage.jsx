import React from "react";
import { useAuth } from "../contexts/AuthContext";
import UserProfile from "../components/Profile/UserProfile";
import ServiceHealth from "../components/Profile/ServiceHealth";
import { Navigate } from "react-router-dom";

const ProfilePage = () => {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" />;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-12">
      <UserProfile user={user} />
      <ServiceHealth />
    </div>
  );
};

export default ProfilePage;