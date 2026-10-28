import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import Auth from './Auth';
import Layout from './Layout';
import Dashboard from './Dashboard';
import Requests from './Requests';
import Documents from './Documents';
import Messages from './Messages';
import Profile from './Profile';
import Search from './Search';
import SchoolSearch from './SchoolSearch';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import ProfileSetup from './components/ProfileSetup';
import { User, UserType, ConnectionRequest, Chat, Document } from './types';
import { auth } from './lib/firebase';
import { getUserProfile } from './lib/users';
import { subscribeToRequests } from './lib/requests';
import { subscribeToChats } from './lib/chats';
import { subscribeToDocuments } from './lib/documents';
import { saveOrganizationProfile, skipProfileSetup } from './lib/profiles';
import { defaultAvatar, EMPTY_AVAILABILITY } from './lib/utils';

// Builds the in-app User object for a signed-in Firebase uid, layering the
// Firestore "users/{uid}" profile (org name, availability, etc.) on top of
// empty defaults so the UI can render a brand-new, mostly-empty profile
// without showing placeholder data.
async function loadUser(uid: string, fallbackType: UserType): Promise<User> {
  const profile = await getUserProfile(uid);
  const localCompleted = typeof window !== 'undefined' ? localStorage.getItem(`setupCompleted_${uid}`) : null;
  const localSkipped = typeof window !== 'undefined' ? localStorage.getItem(`setupSkipped_${uid}`) : null;
  const localAnswers = typeof window !== 'undefined' ? localStorage.getItem(`profileAnswers_${uid}`) : null;
  const localLocation = typeof window !== 'undefined' ? localStorage.getItem(`location_${uid}`) : null;

  let parsedAnswers = profile.profileAnswers;
  if (!parsedAnswers && localAnswers) {
    try {
      parsedAnswers = JSON.parse(localAnswers);
    } catch (e) {}
  }

  const effectiveType = profile.type ?? fallbackType;
  const name = profile.name || (effectiveType === 'community-partner' ? 'Community Partner Organization' : 'School Organization');

  return {
    ...profile,
    id: uid,
    name,
    type: effectiveType,
    email: profile.email || auth.currentUser?.email || '',
    avatar: profile.avatar || defaultAvatar(name),
    availability: profile.availability && profile.availability.length > 0 ? profile.availability : EMPTY_AVAILABILITY,
    setupCompletedAt: profile.setupCompletedAt || localCompleted || undefined,
    setupSkippedAt: profile.setupSkippedAt || localSkipped || undefined,
    profileAnswers: parsedAnswers,
    location: profile.location || localLocation || '',
  };
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLoading, setIsLoading] = useState(true);
  const [actionsNeededRead, setActionsNeededRead] = useState(false);
  const [connections, setConnections] = useState<ConnectionRequest[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [draftMessage, setDraftMessage] = useState<{ text: string; isSuggestedTime?: boolean; suggestedTimes?: string[]; meetingNote?: string } | null>(null);
  const [lastActionTime, setLastActionTime] = useState<string>('');

  const updateLastAction = () => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const ampm = hours >= 12 ? 'pm' : 'am';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes < 10 ? `0${minutes}` : minutes;
    setLastActionTime(`Today at ${displayHours}:${displayMinutes} ${ampm}`);
  };

  // Restore the session on refresh: Firebase Auth persists the sign-in
  // client-side, so if there's still a valid uid we just re-load its profile
  // instead of bouncing back to the login screen.
  // True while Auth.tsx is signing someone in and checking their account type;
  // Auth hands the user over via handleLogin (or signs them back out), so the
  // listener below mustn't load them first.
  const loginInProgressRef = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && loginInProgressRef.current) {
        setIsLoading(false);
        return;
      }
      if (firebaseUser) {
        const loadedUser = await loadUser(firebaseUser.uid, 'community-partner');
        setUser(loadedUser);
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });
    return unsubscribe;
  }, []);

  // Once we know who's signed in, subscribe to their requests, chats, and
  // documents so they're read live from Firestore instead of mock arrays.
  useEffect(() => {
    if (!user) {
      setConnections([]);
      setChats([]);
      setDocuments([]);
      return;
    }
    const unsubscribeRequests = subscribeToRequests(user.id, user.type, setConnections);
    const unsubscribeChats = subscribeToChats(user.id, setChats);
    const unsubscribeDocuments = subscribeToDocuments(user.id, setDocuments);
    return () => {
      unsubscribeRequests();
      unsubscribeChats();
      unsubscribeDocuments();
    };
  }, [user?.id, user?.type]);

  // A dismissed "Actions Needed" card comes back when a new request arrives.
  // Same filter as the Dashboard's card: pending requests addressed to the user.
  const actionCount = connections.filter(c => c.status === 'pending' && c.type === 'received' && !c.isBroadcast).length;
  const prevActionCountRef = useRef(0);
  useEffect(() => {
    if (actionCount > prevActionCountRef.current) setActionsNeededRead(false);
    prevActionCountRef.current = actionCount;
  }, [actionCount]);

  const handleLogin = async (type: UserType, uid: string) => {
    const loadedUser = await loadUser(uid, type);
    loginInProgressRef.current = false;
    setUser(loadedUser);
  };

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
    setActiveTab('dashboard');
    setSelectedChatId(null);
  };

  const handleProfileSetupComplete = async (updatedUserData: Partial<User>) => {
    if (!user) return;
    const updatedUser: User = { ...user, ...updatedUserData, setupCompletedAt: new Date().toISOString() };
    setUser(updatedUser);
    setActiveTab('dashboard');
    await saveOrganizationProfile(updatedUser, { markSetupComplete: true });
  };

  const handleProfileSetupSkip = async () => {
    if (!user) return;
    setUser({ ...user, setupSkippedAt: new Date().toISOString() });
    setActiveTab('dashboard');
    await skipProfileSetup(user.id);
  };

  // Opens a conversation, optionally pre-filling the composer (e.g. with a
  // placeholder reply after a match is made).
  const openChat = (chatId: string, draftText?: string) => {
    setSelectedChatId(chatId);
    if (draftText) setDraftMessage({ text: draftText });
    setActiveTab('messages');
  };

  const handleUpdateUser = (updatedUser: User) => {
    setUser(updatedUser);
    saveOrganizationProfile(updatedUser);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex gap-2">
          {[...Array(5)].map((_, i) => (
            <motion.div
              key={i}
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.3, 1, 0.3],
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
                delay: i * 0.1,
              }}
              className="w-4 h-4 rounded-full bg-brand-primary"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Auth
        onLogin={handleLogin}
        onLoginStart={() => { loginInProgressRef.current = true; }}
        onLoginAbort={() => { loginInProgressRef.current = false; }}
      />
    );
  }

  // Show the onboarding flow once, right after signup (or on the first login
  // after this step was added). Completing or skipping it is remembered.
  if (!user.setupCompletedAt && !user.setupSkippedAt) {
    return (
      <ProfileSetup 
        user={user} 
        onComplete={handleProfileSetupComplete} 
        onSkip={handleProfileSetupSkip} 
      />
    );
  }

  return (
    <Layout 
      user={user} 
      activeTab={activeTab} 
      setActiveTab={setActiveTab} 
      onLogout={handleLogout}
      connections={connections}
      onOpenChat={openChat}
    >
      {activeTab === 'dashboard' && (
        <Dashboard 
          user={user} 
          onNavigate={setActiveTab} 
          onOpenChat={openChat}
          actionsNeededRead={actionsNeededRead}
          setActionsNeededRead={setActionsNeededRead}
          connections={connections}
          setConnections={setConnections}
          documents={documents}
          setDocuments={setDocuments}
          lastActionTime={lastActionTime}
          updateLastAction={updateLastAction}
          setChats={setChats}
        />
      )}
      {activeTab === 'requests' && (
        <Requests 
          connections={connections} 
          setConnections={setConnections} 
          user={user}
          onOpenChat={openChat}
        />
      )}
      {activeTab === 'messages' && (
        <Messages 
          selectedChatId={selectedChatId} 
          setSelectedChatId={setSelectedChatId} 
          draftMessage={draftMessage}
          setDraftMessage={setDraftMessage}
          connections={connections}
          setConnections={setConnections}
          user={user}
          setDocuments={setDocuments}
          chats={chats}
          setChats={setChats}
        />
      )}
      {activeTab === 'documents' && (
        <Documents 
          documents={documents}
          setDocuments={setDocuments}
          updateLastAction={updateLastAction}
        />
      )}
      {activeTab === 'search' && (
        user.type === 'community-partner' ? (
          <SchoolSearch
            connections={connections}
            user={user}
            onOpenChat={openChat}
          />
        ) : (
          <Search 
            connections={connections}
            setConnections={setConnections}
            user={user}
          />
        )
      )}
      {activeTab === 'profile' && (
        <Profile 
          user={user} 
          onLogout={handleLogout} 
          connections={connections}
          chatCount={chats.length}
          onUpdateUser={handleUpdateUser}
        />
      )}
    </Layout>
  );
}
