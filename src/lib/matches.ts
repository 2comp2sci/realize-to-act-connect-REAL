// Accepting a request or offer turns it into a "match": the request is marked
// approved, the two organizations are connected, and a chat is opened between
// them with a starter message so they can begin coordinating. Used by the
// Dashboard, Requests, and Search pages.

import { ConnectionRequest, User } from '../types';
import { respondToRequest } from './requests';
import { ensureChat, getChatId, sendMessage } from './chats';
import { connectOnApprovedRequest } from './connections';

/** What the request/offer is for, e.g. "120 Backpacks" or "50 Notebooks, 20 Hygiene Kits". */
export function describeMatchItems(request: ConnectionRequest): string {
  if (request.offeredItems && request.offeredItems.length > 0) {
    return request.offeredItems.map((line) => `${line.quantity} ${line.item}`).join(', ');
  }
  return `${request.quantity} ${request.item}`;
}

/** Message posted automatically, from the accepting side, when a match is made. */
function starterMessage(accepter: User, request: ConnectionRequest): string {
  const items = describeMatchItems(request);
  if (request.kind === 'offer') {
    return `Hi ${request.fromName}! ${accepter.name} has accepted your offer of ${items}. Thank you! Let's use this chat to coordinate pickup or drop-off details.`;
  }
  return `Hi ${request.fromName}! ${accepter.name} has accepted your request for ${items}. We're glad to help. Let's use this chat to coordinate drop-off details.`;
}

/** Placeholder reply pre-filled in the composer for the accepting side. */
export function accepterDraft(request: ConnectionRequest): string {
  return request.kind === 'offer'
    ? `Hi ${request.fromName}! What days and times work best for you to drop off, or for us to pick up?`
    : `Hi ${request.fromName}! What days and times work best for us to drop off these items, and where should we go when we arrive?`;
}

/** Placeholder reply pre-filled in the composer for the side whose request was accepted. */
export function requesterDraft(partnerName: string): string {
  return `Hi ${partnerName}, thank you so much! Here are some days and times that work for us: `;
}

/**
 * Accepts a received request or offer on behalf of `user`, connects the two
 * organizations, and opens a chat with a starter message. Returns the chat id
 * so the caller can send the user straight to the conversation.
 */
export async function acceptMatch(user: User, request: ConnectionRequest): Promise<string> {
  await respondToRequest(request.id, 'approved', { uid: user.id, name: user.name, avatar: user.avatar || '' });

  const chatId = await ensureChat(
    user.id,
    { name: user.name, title: user.contactName || '', avatar: user.avatar },
    request.fromId,
    { name: request.fromName, title: '', avatar: request.fromAvatar }
  );
  // A failed starter message or auto-connect shouldn't block the match itself.
  await sendMessage(chatId, { senderId: user.id, text: starterMessage(user, request) })
    .catch((err) => console.error('Could not send match starter message', err));
  await connectOnApprovedRequest(
    { uid: user.id, name: user.name, avatar: user.avatar, type: user.type },
    { uid: request.fromId, name: request.fromName, avatar: request.fromAvatar },
    request.id
  ).catch((err) => console.error('Auto-connect failed', err));

  return chatId;
}

/** Chat id for the conversation with the other party on a request. */
export function matchChatId(user: User, request: ConnectionRequest): string {
  return getChatId(user.id, request.fromId);
}
