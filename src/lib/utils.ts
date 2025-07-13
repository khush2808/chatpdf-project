import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function convertToAscii(inputString: string) {
  // Remove non-ASCII characters and replace with underscores
  const asciiString = inputString.replace(/[^\x00-\x7F]/g, "_");
  return asciiString;
}
