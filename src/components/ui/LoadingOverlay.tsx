import React from 'react';

export default function LoadingOverlay({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent shadow-lg mb-4"></div>
      <p className="text-white font-bold text-lg animate-pulse">{message}</p>
    </div>
  );
}