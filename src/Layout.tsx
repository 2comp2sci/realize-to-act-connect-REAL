import React, { useState } from 'react';
import { 
  LayoutDashboard, Users, MessageSquare, 
  FileText, Bell, Menu, X, LogOut, User as UserIcon, Search, Sparkles, Inbox
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { ConnectionRequest, User } from './types';
import { formatTimeAgo } from './lib/requests';
import { describeMatchItems, matchChatId, requesterDraft } from './lib/matches';

interface LayoutProps {
  user: User;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  connections: ConnectionRequest[];
  onOpenChat: (chatId: string, draftText?: string) => void;
  children: React.ReactNode;
}

interface Notification {
  id: string;
  kind: 'match' | 'request';
  request: ConnectionRequest;
  timestamp: number;
}

// When the notifications panel was last opened, per user, so the bell only
// shows a dot for notifications that arrived since.
const seenKey = (uid: string) => `notificationsSeenAt_${uid}`;

function readSeenAt(uid: string): number {
  try {
    return Number(localStorage.getItem(seenKey(uid))) || 0;
  } catch {
    return 0;
  }
}

export default function Layout({ 
  user, activeTab, setActiveTab, onLogout, 
  connections, onOpenChat,
  children 
}: LayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [seenAt, setSeenAt] = useState(() => readSeenAt(user.id));

  // Built only from the user's live requests: accepted requests/offers are
  // matches, and pending ones addressed to the user need a response.
  const notifications: Notification[] = connections
    .flatMap((request): Notification[] => {
      if (request.status === 'approved') {
        return [{ id: `match-${request.id}`, kind: 'match', request, timestamp: request.respondedAt ?? request.timestamp }];
      }
      if (request.status === 'pending' && request.type === 'received') {
        return [{ id: `request-${request.id}`, kind: 'request', request, timestamp: request.timestamp }];
      }
      return [];
    })
    .sort((a, b) => b.timestamp - a.timestamp);
  const hasUnseen = notifications.some(n => n.timestamp > seenAt);
  const partnerLabel = user.type === 'school' ? 'community partner' : 'school';

  const openNotifications = () => {
    setIsNotificationsOpen(true);
    const now = Date.now();
    setSeenAt(now);
    try {
      localStorage.setItem(seenKey(user.id), String(now));
    } catch {}
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'search', label: 'Search', icon: Search },
    { id: 'requests', label: 'Requests', icon: Users },
    { id: 'messages', label: 'Messages', icon: MessageSquare },
    { id: 'documents', label: 'Documents', icon: FileText },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto w-full h-full flex items-center justify-between px-4 lg:px-8">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-slate-100 rounded-[5px] transition-colors"
            >
              <Menu size={20} className="text-brand-dark" />
            </button>
            <span className="font-bold text-brand-dark uppercase tracking-wider text-sm">Menu</span>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={openNotifications}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors relative"
            >
              <Bell size={20} className="text-brand-primary" />
              {hasUnseen && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand-primary rounded-full border-2 border-white" />
              )}
            </button>
            <button 
              onClick={() => {
                if (activeTab === 'profile') {
                  setActiveTab('dashboard');
                } else {
                  setActiveTab('profile');
                }
              }}
              className="w-8 h-8 rounded-full overflow-hidden border border-slate-200 hover:ring-2 hover:ring-brand-primary/20 transition-all"
            >
              <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 relative">
        {/* Sidebar Overlay */}
        <AnimatePresence>
          {isSidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50"
            />
          )}
        </AnimatePresence>

        {/* Sidebar */}
        <motion.aside
          initial={false}
          animate={{ x: isSidebarOpen ? 0 : -300 }}
          transition={{ type: "spring", bounce: 0, duration: 0.4 }}
          className="fixed top-0 left-0 bottom-0 w-64 bg-white shadow-none border-r border-slate-100 z-50 flex flex-col"
        >
          <div className="p-6 border-b border-slate-100 flex justify-between items-center">
            <a 
              href="https://www.realizetoact.com/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="font-bold text-brand-primary tracking-tight text-sm hover:underline"
            >
              Realize To Act
            </a>
            <button onClick={() => setIsSidebarOpen(false)} className="text-slate-400 hover:text-slate-600">
              <X size={20} />
            </button>
          </div>

          <nav className="flex-1 p-4 space-y-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsSidebarOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-[5px] font-bold transition-all",
                  activeTab === item.id 
                    ? "bg-brand-secondary text-brand-primary" 
                    : "text-brand-dark hover:bg-slate-50"
                )}
              >
                <item.icon size={20} />
                {item.label}
              </button>
            ))}
          </nav>

          <div className="p-4 border-t border-slate-100">
            <button 
              onClick={onLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-[5px] font-bold text-brand-dark hover:bg-slate-50 transition-all"
            >
              <LogOut size={20} />
              Logout
            </button>
          </div>
        </motion.aside>

        {/* Notifications Sidebar */}
        <AnimatePresence>
          {isNotificationsOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                onClick={() => setIsNotificationsOpen(false)}
                className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50"
              />
              <motion.aside
                initial={{ x: 400 }}
                animate={{ x: 0 }}
                exit={{ x: 400 }}
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                className="fixed top-0 right-0 bottom-0 w-full max-w-sm bg-white shadow-none border-l border-slate-100 z-50 flex flex-col"
              >
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="text-xl font-bold text-brand-dark">Your Notifications</h3>
                  <button onClick={() => setIsNotificationsOpen(false)} className="text-slate-400 hover:text-slate-600">
                    <X size={20} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  <p className="text-sm text-slate-500 mb-6">Keep track of your latest activity</p>

                  {notifications.length === 0 && (
                    <div className="h-48 flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-[5px] text-center p-6">
                      <Inbox size={32} className="text-slate-300 mb-3" />
                      <p className="text-sm font-semibold text-slate-600">Nothing to see here</p>
                      <p className="text-xs text-slate-400 mt-1">Matches and new requests will show up here.</p>
                    </div>
                  )}

                  {notifications.map(({ id, kind, request, timestamp }) => {
                    const isNew = timestamp > seenAt;
                    return kind === 'match' ? (
                      <div
                        key={id}
                        className={cn(
                          "p-4 rounded-[5px] border",
                          isNew ? "border-brand-primary/20 bg-brand-secondary/30" : "border-slate-100 bg-white"
                        )}
                      >
                        <div className="flex justify-between mb-1 gap-2">
                          <span className="text-sm font-bold text-brand-dark flex items-center gap-2">
                            <Sparkles size={14} className="text-brand-primary" />
                            Match Found!
                          </span>
                          <span className="text-xs text-slate-400 whitespace-nowrap">{formatTimeAgo(timestamp)}</span>
                        </div>
                        <p className="text-sm text-slate-600 mb-3">
                          You've been matched with <strong>{request.fromName}</strong> for {describeMatchItems(request)}.
                          Begin communicating with the {partnerLabel} to coordinate the exchange.
                        </p>
                        <button 
                          onClick={() => {
                            setIsNotificationsOpen(false);
                            onOpenChat(
                              matchChatId(user, request),
                              request.type === 'sent' ? requesterDraft(request.fromName) : undefined
                            );
                          }}
                          className="text-xs font-bold text-brand-primary hover:underline flex items-center gap-1"
                        >
                          <MessageSquare size={14} />
                          Message {request.fromName}
                        </button>
                      </div>
                    ) : (
                      <div
                        key={id}
                        onClick={() => {
                          setIsNotificationsOpen(false);
                          setActiveTab('requests');
                        }}
                        className={cn(
                          "p-4 rounded-[5px] border cursor-pointer transition-all hover:border-brand-primary/30",
                          isNew ? "border-brand-primary/20 bg-brand-secondary/30" : "border-slate-100 bg-white"
                        )}
                      >
                        <div className="flex justify-between mb-1 gap-2">
                          <span className="text-sm font-bold text-brand-dark flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-brand-primary" />
                            {request.kind === 'offer' ? 'New Supply Offer' : 'New Supply Request'}
                          </span>
                          <span className="text-xs text-slate-400 whitespace-nowrap">{formatTimeAgo(timestamp)}</span>
                        </div>
                        <p className="text-sm text-slate-600">
                          {request.fromName} {request.kind === 'offer' ? 'has available' : 'is requesting'} {describeMatchItems(request)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <main className="flex-1 px-4 py-12 lg:px-8 lg:py-16 overflow-y-auto max-w-[1400px] mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
