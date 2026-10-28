import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Plus, Trash2, Send } from 'lucide-react';
import { OfferedItem, User } from '../types';
import { RESOURCE_CATEGORIES } from '../data/categories';
import { createRequest } from '../lib/requests';

interface SupplyOfferFormProps {
  user: User;
  onClose: () => void;
}

interface OfferLine {
  categoryId: string;
  item: string;
  quantity: string;
}

const emptyLine = (): OfferLine => ({ categoryId: RESOURCE_CATEGORIES[0].id, item: '', quantity: '' });

// Lets a community partner post the supply items and quantities it has
// available. The offer is broadcast to every school (toUid == null, kind
// 'offer'); a school accepting it makes a match (src/lib/matches.ts).
export default function SupplyOfferForm({ user, onClose }: SupplyOfferFormProps) {
  const [lines, setLines] = useState<OfferLine[]>([emptyLine()]);
  const [notes, setNotes] = useState('');
  const [availableUntil, setAvailableUntil] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateLine = (index: number, changes: Partial<OfferLine>) => {
    setLines(prev => prev.map((line, i) => (i === index ? { ...line, ...changes } : line)));
    if (error) setError('');
  };

  const handleSubmit = async () => {
    const offeredItems: OfferedItem[] = [];
    for (const line of lines) {
      const quantity = parseInt(line.quantity);
      const category = RESOURCE_CATEGORIES.find(c => c.id === line.categoryId);
      const item = line.item.trim() || category?.label || '';
      if (!line.item.trim() && !line.quantity) continue; // untouched extra row
      if (!item || !quantity || quantity <= 0) {
        setError('Each item needs a name and a quantity greater than zero.');
        return;
      }
      offeredItems.push({ item, quantity });
    }
    if (offeredItems.length === 0) {
      setError('Add at least one supply item and its quantity.');
      return;
    }

    const total = offeredItems.reduce((sum, line) => sum + line.quantity, 0);
    const itemList = offeredItems.map(line => `${line.quantity} ${line.item}`).join(', ');
    const summary = offeredItems.length === 1
      ? offeredItems[0].item
      : `${offeredItems[0].item} + ${offeredItems.length - 1} more`;

    setIsSubmitting(true);
    try {
      await createRequest({
        fromUid: user.id,
        fromName: user.name,
        fromAvatar: user.avatar || '',
        toUid: null,
        item: summary,
        quantity: total,
        distance: user.location || 'N/A',
        description: notes.trim() || `${user.name} has ${itemList} available for schools.`,
        availability: user.allowAvailabilityView !== false ? user.availability : undefined,
        kind: 'offer',
        offeredItems,
        fromUserType: user.type,
        availableUntil: availableUntil || undefined,
      });
      onClose();
    } catch (err) {
      console.error('Could not post supply offer', err);
      setError('Could not post your supplies. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        className="relative bg-white rounded-[6px] shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200"
      >
        <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50/70">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-brand-primary block">Supply Offer</span>
            <h3 className="text-xl font-serif font-bold text-brand-dark mt-0.5">Post Available Supplies</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              List the items and quantities your organization has available. Schools will see this and can accept it.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {error && (
            <div className="p-3 rounded-[5px] bg-red-50 border border-red-200 text-red-600 text-xs font-semibold">{error}</div>
          )}

          <div className="space-y-3">
            <div className="hidden sm:grid grid-cols-[1fr_1.4fr_110px_32px] gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <span>Category</span>
              <span>Item</span>
              <span>Quantity</span>
              <span />
            </div>
            {lines.map((line, index) => {
              const category = RESOURCE_CATEGORIES.find(c => c.id === line.categoryId);
              const listId = `offer-items-${index}`;
              return (
                <div key={index} className="grid grid-cols-1 sm:grid-cols-[1fr_1.4fr_110px_32px] gap-2 p-3 sm:p-0 border sm:border-0 border-slate-200 rounded-[5px]">
                  <select
                    value={line.categoryId}
                    onChange={(e) => updateLine(index, { categoryId: e.target.value })}
                    className="px-3 py-2.5 rounded-[5px] border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                  >
                    {RESOURCE_CATEGORIES.map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    list={listId}
                    value={line.item}
                    onChange={(e) => updateLine(index, { item: e.target.value })}
                    placeholder={category ? `e.g. ${category.subcategories[0]?.label ?? category.label}` : 'Item name'}
                    className="px-3 py-2.5 rounded-[5px] border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                  />
                  <datalist id={listId}>
                    {category?.subcategories.map(sc => <option key={sc.id} value={sc.label} />)}
                  </datalist>
                  <input
                    type="number"
                    min={1}
                    value={line.quantity}
                    onChange={(e) => updateLine(index, { quantity: e.target.value })}
                    placeholder="Qty"
                    className="px-3 py-2.5 rounded-[5px] border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                  />
                  <button
                    type="button"
                    onClick={() => setLines(prev => (prev.length === 1 ? [emptyLine()] : prev.filter((_, i) => i !== index)))}
                    className="flex items-center justify-center text-slate-400 hover:text-red-600 cursor-pointer"
                    title="Remove item"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
            <button
              type="button"
              onClick={() => setLines(prev => [...prev, emptyLine()])}
              className="text-xs font-bold text-brand-primary hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Plus size={14} />
              Add another item
            </button>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">Available Until (optional)</label>
            <input
              type="date"
              value={availableUntil}
              onChange={(e) => setAvailableUntil(e.target.value)}
              className="w-full sm:w-1/2 px-3 py-2.5 rounded-[5px] border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">Notes (optional)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Condition of items, grade levels, pickup or delivery options..."
              className="w-full px-4 py-3 rounded-[5px] border border-slate-200 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
            />
          </div>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-[5px] font-semibold text-xs text-slate-700 border border-slate-200 bg-white hover:bg-slate-100 transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-6 py-2.5 bg-brand-primary hover:bg-brand-dark text-white rounded-[5px] font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
          >
            <Send size={14} />
            <span>{isSubmitting ? 'Posting...' : 'Post Supplies'}</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
