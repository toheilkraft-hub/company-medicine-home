import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatDistanceToNow, format } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function timeAgo(date: string | Date) {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function formatDate(date: string | Date) {
  return format(new Date(date), "MMM d, yyyy");
}

export function formatDateTime(date: string | Date) {
  return format(new Date(date), "MMM d, yyyy · h:mm a");
}

export function truncate(str: string, length: number) {
  return str.length > length ? str.slice(0, length) + "…" : str;
}

export function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function copyToClipboard(text: string) {
  return navigator.clipboard.writeText(text);
}
