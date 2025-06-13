import React from 'react';
import '../../styles/components/ProfilePopup.css';
import type { User } from 'firebase/auth';

interface ProfilePopupProps {
  user: User| null;
  onClose: () => void;
}

const ProfilePopup: React.FC<ProfilePopupProps> = ({ user ,onClose }) => {
  return (
    <div className="profile-popup">
      <p><strong>Email:</strong> {user?.email}</p>
      <p><strong>User name:</strong> {user?.displayName}</p>
      <button onClick={onClose}>Đóng</button>
    </div>
  );
};

export default ProfilePopup;
