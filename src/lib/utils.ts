import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Initial-letter avatar as an inline SVG data URI, for organizations that haven't uploaded one. */
export function defaultAvatar(name: string): string {
  const initial = (name.trim()[0] || '?').toUpperCase().replace(/[<&>"']/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" fill="#F3E8FF"/><text x="50%" y="50%" dy=".35em" text-anchor="middle" font-family="sans-serif" font-size="56" font-weight="700" fill="#8B4496">${initial}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** An empty weekly drop-off schedule; the Profile and setup grids render one column per day. */
export const EMPTY_AVAILABILITY = ['MON', 'TUES', 'WED', 'THURS', 'FRI'].map((day) => ({ day, slots: [] as string[] }));
