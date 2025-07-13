/**
 * Custom module declarations for third-party libraries that do not include
 * TypeScript declaration files. This prevents the compiler from throwing
 * "Cannot find module" errors when we perform dynamic imports in server-side
 * code (e.g. our PDF processing pipeline).
 */
/* eslint-disable */

declare module "pdf-parse" {
  const value: any;
  export default value;
}

// The pdfjs-dist legacy build does not ship accurate TypeScript declarations.
// We declare it as "any" for now because we only use it internally.
declare module "pdfjs-dist/legacy/build/pdf.mjs" {
  const value: any;
  export = value;
}