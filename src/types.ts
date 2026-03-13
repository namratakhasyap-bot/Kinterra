export interface User {
  uid: string;
  username: string;
  searchUsername?: string;
  photoURL?: string;
  bio?: string;
  interests?: string[];
  isBot: boolean;
  createdAt: any; // Timestamp
  theme?: 'light' | 'dark';
  preferences?: {
    notifications: boolean;
    privacyMode: boolean;
  };
}

export interface Post {
  id: string;
  authorUid: string;
  content: string;
  type: 'thought' | 'highlight';
  imageUrl?: string;
  isModerated: boolean;
  createdAt: any; // Timestamp
}

export interface Chat {
  id: string;
  participants: string[];
  lastMessage?: string;
  lastTimestamp?: any; // Timestamp
}

export interface Message {
  id: string;
  chatId: string;
  senderUid: string;
  text: string;
  createdAt: any; // Timestamp
}

export interface OnboardingData {
  username: string;
  bio: string;
  interests: string[];
  photoURL?: string;
}

export interface FriendRequest {
  id: string;
  fromUid: string;
  toUid: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: any; // Timestamp
}
