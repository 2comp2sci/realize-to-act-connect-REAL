import React, { useEffect, useState } from 'react';
import { Search as SearchIcon, MapPin, X, Eye, Check, MessageSquare, School } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './lib/firebase';
import { cn, defaultAvatar } from './lib/utils';
import { ConnectionRequest, User } from './types';
import { acceptMatch, accepterDraft, describeMatchItems, matchChatId } from './lib/matches';
import RequestDetailModal from './components/RequestDetailModal';
import Tag from './components/Tag';

interface SchoolSearchProps {
  connections: ConnectionRequest[];
  user: User;
  onOpenChat: (chatId: string, draftText?: string) => void;
}

interface SchoolListing {
  id: string;
  name: string;
  avatar: string;
  about: string;
  location: string;
  contactName: string;
}

// The Search page as seen by a community partner: every school registered on
// the platform ("users" with userType 'school'), each with the supply
// requests it has open. Requests come from the live subscription in App.tsx,
// so this only lists requests the partner is allowed to see — broadcasts to
// all partners and ones addressed to them.
export default function SchoolSearch({ connections, user, onOpenChat }: SchoolSearchProps) {
  const [schools, setSchools] = useState<SchoolListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyWithRequests, setOnlyWithRequests] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ConnectionRequest | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  useEffect(() => {
    const loadSchools = async () => {
      try {
        const snapshot = await getDocs(query(collection(db, 'users'), where('userType', '==', 'school')));
        setSchools(snapshot.docs.map(docSnap => {
          const data = docSnap.data();
          const name = data.orgName ?? data.contactName ?? 'Unnamed School';
          return {
            id: docSnap.id,
            name,
            avatar: data.avatar ?? defaultAvatar(name),
            about: data.about ?? '',
            location: data.location ?? '',
            contactName: data.contactName ?? '',
          };
        }));
      } catch (error) {
        console.error('Error loading schools:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadSchools();
  }, []);

  // Requests the partner can act on or has already accepted, by school.
  const requestsBySchool = new Map<string, ConnectionRequest[]>();
  for (const request of connections) {
    if (request.type !== 'received' || request.kind === 'offer' || request.status === 'denied') continue;
    const list = requestsBySchool.get(request.fromId) ?? [];
    list.push(request);
    requestsBySchool.set(request.fromId, list);
  }
  const openCount = (schoolId: string) =>
    (requestsBySchool.get(schoolId) ?? []).filter(r => r.status === 'pending').length;

  const q = searchQuery.toLowerCase().trim();
  const filteredSchools = schools
    .filter(school => {
      if (onlyWithRequests && openCount(school.id) === 0) return false;
      if (!q) return true;
      return school.name.toLowerCase().includes(q) ||
        school.location.toLowerCase().includes(q) ||
        school.about.toLowerCase().includes(q) ||
        (requestsBySchool.get(school.id) ?? []).some(r => describeMatchItems(r).toLowerCase().includes(q));
    })
    .sort((a, b) => openCount(b.id) - openCount(a.id) || a.name.localeCompare(b.name));

  const handleAccept = async (request: ConnectionRequest) => {
    if (acceptingId) return;
    setAcceptingId(request.id);
    try {
      const chatId = await acceptMatch(user, request);
      onOpenChat(chatId, accepterDraft(request));
    } catch (err) {
      console.error('Could not accept request', err);
      setAcceptingId(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-16">
      <header className="border-b border-slate-100 pb-6">
        <span className="text-xs font-bold uppercase tracking-wider text-brand-primary">School Discovery</span>
        <h1 className="text-3xl sm:text-4xl font-serif font-bold text-brand-dark mt-1">Search Schools</h1>
        <p className="text-slate-500 text-sm mt-1">
          Browse schools on Realize to Act and the supply requests they need fulfilled.
        </p>
      </header>

      <div className="bg-white rounded-[6px] p-6 sm:p-8 border border-slate-200/80 shadow-xs min-h-[400px] flex flex-col space-y-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search by school name, location, or requested item..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-10 py-3 rounded-[5px] border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all text-sm font-medium text-slate-800 placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                title="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <div className="flex p-1 bg-slate-100 rounded-[5px] shrink-0">
            {[
              { value: false, label: 'All Schools' },
              { value: true, label: 'With Open Requests' },
            ].map(option => (
              <button
                key={option.label}
                type="button"
                onClick={() => setOnlyWithRequests(option.value)}
                className={cn(
                  "px-3 py-2 rounded-[4px] text-xs font-bold transition-all cursor-pointer",
                  onlyWithRequests === option.value ? "bg-white text-brand-primary shadow-xs" : "text-slate-600 hover:text-slate-900"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <h2 className="text-base font-bold text-brand-dark">Schools</h2>
          <span className="text-xs text-slate-400">({filteredSchools.length})</span>
        </div>

        {!isLoading && filteredSchools.length === 0 && (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400 border border-dashed border-slate-200 rounded-[6px] text-center p-6">
            <School size={40} className="mb-3 opacity-30" />
            <p className="font-semibold text-slate-600 text-sm">Nothing to see here</p>
            <p className="text-xs text-slate-400 mt-1">
              {schools.length === 0 ? 'Schools will appear here as they join Realize to Act.' : 'No schools match your search.'}
            </p>
          </div>
        )}

        <div className="space-y-4">
          {filteredSchools.map(school => {
            const requests = requestsBySchool.get(school.id) ?? [];
            const open = requests.filter(r => r.status === 'pending');
            return (
              <div key={school.id} className="p-5 rounded-[6px] border border-slate-200 bg-white shadow-xs">
                <div className="flex gap-4">
                  <img src={school.avatar} alt={school.name} className="w-14 h-14 rounded-[5px] object-cover border border-slate-200 shrink-0" referrerPolicy="no-referrer" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-bold text-slate-900 text-base">{school.name}</h3>
                      <Tag
                        label={open.length > 0 ? `${open.length} open ${open.length === 1 ? 'request' : 'requests'}` : 'No open requests'}
                        variant={open.length > 0 ? 'status-pending' : 'neutral'}
                      />
                    </div>
                    {school.location && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium mb-1">
                        <MapPin size={13} className="text-brand-primary" />
                        <span>{school.location}</span>
                      </div>
                    )}
                    {school.about && <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{school.about}</p>}
                  </div>
                </div>

                {requests.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {requests.map(request => (
                      <div key={request.id} className="p-3 rounded-[5px] border border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Tag label={describeMatchItems(request)} variant="category" />
                            {request.status === 'approved' && <Tag label="Matched" variant="status-approved" />}
                            <span className="text-xs text-slate-400">{request.timeAgo}</span>
                          </div>
                          {request.description && (
                            <p className="text-xs text-slate-600 mt-1.5 line-clamp-2">{request.description}</p>
                          )}
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => setSelectedRequest(request)}
                            className="py-2 px-3 rounded-[5px] font-semibold text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <Eye size={13} className="text-slate-500" />
                            <span>Details</span>
                          </button>
                          {request.status === 'approved' ? (
                            <button
                              type="button"
                              onClick={() => onOpenChat(matchChatId(user, request))}
                              className="py-2 px-3 rounded-[5px] font-bold text-xs bg-brand-primary hover:bg-brand-dark text-white transition-all flex items-center gap-1.5 cursor-pointer"
                            >
                              <MessageSquare size={13} />
                              <span>Message</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleAccept(request)}
                              disabled={!!acceptingId}
                              className="py-2 px-3 rounded-[5px] font-bold text-xs bg-brand-primary hover:bg-brand-dark text-white transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              <Check size={13} />
                              <span>{acceptingId === request.id ? 'Accepting...' : 'Fulfill Request'}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {selectedRequest && (
          <RequestDetailModal
            request={selectedRequest}
            onClose={() => setSelectedRequest(null)}
            onApprove={() => handleAccept(selectedRequest)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
