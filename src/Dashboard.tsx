import React from 'react';
import { 
  Search, MessageSquare, Monitor, UserPlus, 
  Check, X, FileSignature, ArrowRight,
  BookOpen, Backpack, MapPin, Calendar, Pencil, Trash2,
  Utensils, Shirt, Book, Library, Laptop, Home, Palette, Package
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from './lib/utils';
import { User, ConnectionRequest, Document, Chat } from './types';
import Tag from './components/Tag';
import { respondToRequest } from './lib/requests';
import { acceptMatch, accepterDraft, describeMatchItems } from './lib/matches';
import { createDocument } from './lib/documents';

interface DashboardProps {
  user: User;
  onNavigate: (tab: string) => void;
  onOpenChat: (chatId: string, draftText?: string) => void;
  actionsNeededRead: boolean;
  setActionsNeededRead: (read: boolean) => void;
  connections: ConnectionRequest[];
  setConnections: React.Dispatch<React.SetStateAction<ConnectionRequest[]>>;
  documents: Document[];
  setDocuments: React.Dispatch<React.SetStateAction<Document[]>>;
  lastActionTime: string;
  updateLastAction: () => void;
  setChats: React.Dispatch<React.SetStateAction<Chat[]>>;
}

export default function Dashboard({ 
  user, onNavigate, onOpenChat,
  actionsNeededRead, setActionsNeededRead,
  connections, setConnections,
  documents, setDocuments,
  lastActionTime, updateLastAction,
  setChats
}: DashboardProps) {
  // Requests addressed directly to the user need a response; open broadcasts
  // from the other side of the network (offers for schools, requests for
  // community partners) are suggested instead.
  const pendingConnections = connections.filter(c => c.status === 'pending' && c.type === 'received' && !c.isBroadcast);
  const pendingDocs = documents.filter(d => d.status === 'pending');
  const suggestedMatches = connections
    .filter(c => c.type === 'received' && c.status === 'pending' && c.isBroadcast)
    .slice(0, 4);

  const handleApprove = async (id: string) => {
    const connection = connections.find(c => c.id === id);
    if (connection) {
      const chatId = await acceptMatch(user, connection);
      updateLastAction();

      // Add to pending signatures — the documents subscription in App.tsx
      // pushes the new letter back into `documents`.
      await createDocument({
        ownerUid: user.id,
        partnerUid: connection.fromId,
        requestId: id,
        title: `Letter of Acknowledgement - ${connection.fromName}`,
        fromName: connection.fromName,
        toName: user.name,
        dueDate: 'Due in 7 days',
        itemDescription: `approved ${describeMatchItems(connection)}`,
      }).catch(err => console.error('Could not create acknowledgement letter', err));

      // Send the user straight to the new conversation to start coordinating.
      onOpenChat(chatId, accepterDraft(connection));
    }
  };

  const handleReject = async (id: string) => {
    await respondToRequest(id, 'denied');
    updateLastAction();
  };

  const getSupplyIcon = (item: string) => {
    const lowerItem = item.toLowerCase();
    if (lowerItem.includes('food') || lowerItem.includes('meal')) return <Utensils size={14} className="text-brand-primary" />;
    if (lowerItem.includes('backpack')) return <Backpack size={14} className="text-brand-primary" />;
    if (lowerItem.includes('clothing') || lowerItem.includes('shirt')) return <Shirt size={14} className="text-brand-primary" />;
    if (lowerItem.includes('book') || lowerItem.includes('textbook')) return <Book size={14} className="text-brand-primary" />;
    if (lowerItem.includes('library') || lowerItem.includes('school')) return <Library size={14} className="text-brand-primary" />;
    if (lowerItem.includes('tech') || lowerItem.includes('laptop') || lowerItem.includes('computer')) return <Laptop size={14} className="text-brand-primary" />;
    if (lowerItem.includes('furniture') || lowerItem.includes('chair') || lowerItem.includes('desk')) return <Home size={14} className="text-brand-primary" />;
    if (lowerItem.includes('art') || lowerItem.includes('paint') || lowerItem.includes('supply')) return <Palette size={14} className="text-brand-primary" />;
    return <Package size={14} className="text-brand-primary" />;
  };

  const quickLinks = [
    { id: 'search', label: 'Search Connection', icon: Search, color: 'text-brand-primary' },
    { id: 'message', label: 'Message Community Partner', icon: MessageSquare, color: 'text-brand-primary' },
    { id: 'approve', label: 'Approve Transfer', icon: Monitor, color: 'text-brand-primary' },
    { id: 'invite', label: 'Invite Partner', icon: UserPlus, color: 'text-brand-primary' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-brand-dark mb-2">Welcome, {user.name}!</h1>
          <p className="text-slate-500">Here is an overview of your recent activity!</p>
        </div>
        <div className="text-sm text-slate-400">
          Last updated: {lastActionTime || '--'}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Actions Needed */}
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-white rounded-[5px] p-8 shadow-none border border-slate-100">
            <h2 className="text-xl font-bold text-brand-dark mb-2">Actions Needed</h2>
            <p className="text-sm text-slate-500 mb-6">View and take action on current tasks and requests.</p>
            
            {pendingConnections.length > 0 && !actionsNeededRead ? (
              <div className="p-6 rounded-[5px] border border-brand-primary/20 bg-brand-secondary/10">
                <div className="flex justify-between items-start mb-2 gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-brand-primary" />
                    <span className="font-bold text-brand-dark">
                      {`Respond to your ${pendingConnections.length} new ${pendingConnections.length === 1 ? 'request' : 'requests'}`}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 whitespace-nowrap">{pendingConnections[0].timeAgo}</span>
                </div>
                <p className="text-sm ml-4 text-slate-600">
                  {`${Array.from(new Set(pendingConnections.map(c => c.fromName))).join(', ')} ${pendingConnections.length === 1 ? 'is' : 'are'} waiting on your response`}
                </p>
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => setActionsNeededRead(true)}
                    className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-[5px] transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <X size={14} />
                    <span>Dismiss</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('requests')}
                    className="px-3 py-1.5 bg-brand-primary hover:bg-brand-dark text-white text-xs font-bold rounded-[5px] transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <span>View Requests</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="h-32 flex items-center justify-center border border-dashed border-slate-200 rounded-[5px] text-slate-400 text-sm">
                There are no current actions for you to take.
              </div>
            )}
          </section>

          {/* Suggested Matches */}
          <section className="bg-white rounded-[5px] p-8 shadow-none border border-slate-100">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-serif font-bold text-brand-dark mb-1">Suggested Matches</h2>
                <p className="text-sm text-slate-500">
                  {user.type === 'school'
                    ? 'Supplies community partners currently have available.'
                    : 'Open supply requests from schools you could help fulfill.'}
                </p>
              </div>
            </div>

            {suggestedMatches.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {suggestedMatches.map((match) => (
                  <div 
                    key={match.id} 
                    onClick={() => onNavigate(user.type === 'school' ? 'requests' : 'search')}
                    className="p-4 rounded-[5px] border border-slate-100 hover:border-brand-primary/20 transition-all flex gap-4 bg-slate-50/30 cursor-pointer group"
                  >
                    <img src={match.fromAvatar} alt={match.fromName} className="w-12 h-12 rounded-[5px] object-cover" />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-brand-dark group-hover:text-brand-dark truncate">{match.fromName}</h3>
                      <p className="text-[10px] text-slate-500 mb-2 truncate">{match.description}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Tag label={describeMatchItems(match)} variant="category" size="sm" />
                        {match.distance !== 'N/A' && (
                          <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                            <MapPin size={12} className="text-brand-primary" />
                            {match.distance}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-32 flex items-center justify-center border border-dashed border-slate-200 rounded-[5px] text-slate-400 text-sm text-center px-4">
                Nothing to see here yet. Suggested matches will appear as {user.type === 'school' ? 'community partners post available supplies' : 'schools post supply requests'}.
              </div>
            )}
          </section>

          {/* Recent Connections Requests */}
          <section className="bg-white rounded-[5px] p-8 shadow-none border border-slate-100">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold text-brand-dark mb-1">Recent Requests</h2>
                <p className="text-sm text-slate-500">
                  {user.type === 'school'
                    ? 'Respond to supply offers from community partners.'
                    : 'Respond to supply requests from schools.'}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {pendingConnections.length > 0 ? (
                pendingConnections.map((conn) => (
                  <div key={conn.id} className="p-4 rounded-[5px] border border-slate-100 hover:border-brand-primary/20 transition-all flex flex-col sm:flex-row gap-4">
                    <div className="w-16 h-16 rounded-[5px] overflow-hidden flex-shrink-0 border border-slate-200">
                      <img src={conn.fromAvatar} alt={conn.fromName} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2.5 mb-1 flex-wrap">
                        <h3 className="font-bold text-brand-dark text-base">{conn.fromName}</h3>
                        <Tag label={conn.status} variant="status-pending" size="sm" />
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-2 mb-3 leading-relaxed">{conn.description}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Tag label={describeMatchItems(conn)} variant="category" size="sm" />
                        {conn.distance !== 'N/A' && (
                          <span className="flex items-center gap-1 text-xs text-slate-500 font-medium">
                            <MapPin size={12} className="text-brand-primary" />
                            {conn.distance}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end justify-between sm:w-32">
                      <span className="text-xs text-slate-400 whitespace-nowrap">{conn.timeAgo}</span>
                      <div className="flex gap-2 mt-2">
                        <button 
                          onClick={() => handleApprove(conn.id)}
                          className="px-3 py-1.5 bg-brand-primary hover:bg-brand-dark text-white text-xs font-bold rounded-[5px] transition-all flex items-center gap-1 cursor-pointer shadow-none"
                          title={conn.kind === 'offer' ? 'Accept offer' : 'Accept request'}
                        >
                          <Check size={14} />
                          <span>Accept</span>
                        </button>
                        <button 
                          onClick={() => handleReject(conn.id)}
                          className="px-2.5 py-1.5 border border-slate-200 hover:border-red-200 text-slate-600 hover:text-red-600 hover:bg-red-50/60 text-xs font-semibold rounded-[5px] transition-all cursor-pointer shadow-none"
                          title="Decline"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="h-32 flex items-center justify-center border border-dashed border-slate-200 rounded-[5px] text-slate-400 text-sm">
                  Nothing to see here. New requests will appear here.
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Sidebar Widgets */}
        <div className="space-y-8">
          {/* Quick Links */}
          <section className="bg-white rounded-[5px] p-8 shadow-none border border-slate-100">
            <h2 className="text-xl font-bold text-brand-dark mb-6">Quick Links</h2>
            <div className="grid grid-cols-2 gap-4">
              {quickLinks.map((link) => (
                <button 
                  key={link.id}
                  onClick={() => {
                    if (link.id === 'search') onNavigate('search');
                    else if (link.id === 'message') onNavigate('messages');
                    else if (link.id === 'approve') onNavigate('documents');
                    else if (link.id === 'invite') {
                      window.location.href = `mailto:?subject=Check out this tech platform&body=Hi, I'm using this platform to manage our community partnerships. You should check it out here: ${window.location.origin}`;
                    }
                  }}
                  className="flex flex-col items-center justify-center p-4 rounded-[5px] bg-slate-50 hover:bg-brand-secondary/30 transition-all group"
                >
                  <link.icon className={cn("mb-3 transition-transform group-hover:scale-110", link.color)} size={24} />
                  <span className="text-xs font-bold text-brand-dark text-center">{link.label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Documents Awaiting Signature */}
          <section className="bg-white rounded-[5px] p-8 shadow-none border border-slate-100">
            <div className="flex justify-between items-center mb-1 gap-4">
              <h2 className="text-xl font-bold text-brand-dark flex-1">Documents Awaiting Signature</h2>
              {pendingDocs.length > 3 && (
                <button 
                  onClick={() => onNavigate('documents')}
                  className="text-brand-primary text-sm font-bold hover:underline whitespace-nowrap flex-shrink-0"
                >
                  View More
                </button>
              )}
            </div>
            <p className="text-sm text-slate-500 mb-8">Indicate when you have received items from a community partner.</p>

            {pendingDocs.length === 0 && (
              <div className="h-24 flex items-center justify-center border border-dashed border-slate-200 rounded-[5px] text-slate-400 text-sm">
                Nothing to see here.
              </div>
            )}
            <div className="divide-y divide-slate-100">
              {pendingDocs.slice(0, 3).map((doc) => (
                <div key={doc.id} className="py-6 first:pt-0 last:pb-0">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-sm font-bold text-brand-dark pr-4">{doc.title}</h3>
                    <span className="text-xs text-slate-400 whitespace-nowrap">{doc.timeAgo}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <div className={cn(
                      "flex items-center gap-2 text-xs font-bold",
                      (doc.dueDate ?? '').toLowerCase().includes('tomorrow') ? "text-red-500" : "text-brand-primary"
                    )}>
                      <Calendar size={14} className={cn(
                        (doc.dueDate ?? '').toLowerCase().includes('tomorrow') ? "text-red-500" : "text-brand-primary"
                      )} />
                      {doc.dueDate}
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => onNavigate('documents')}
                        className="bg-brand-primary hover:bg-brand-dark text-white text-xs font-bold px-4 py-2 rounded-[5px] transition-all hover:scale-[1.02] active:scale-[0.98]"
                      >
                        Sign
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
