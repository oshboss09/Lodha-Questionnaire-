import React from "react";

interface UnifiedBackgroundProps {
  children: React.ReactNode;
}

export default function UnifiedBackground({ children }: UnifiedBackgroundProps) {
  return (
    <div className="relative min-h-screen w-full flex flex-col overflow-hidden bg-[#0a0a0a]">
      {/* Professional Gradient/Dim Layer (Inspired by Recipe 7) */}
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-black/80 via-black/40 to-black/90" />
      
      {/* Content */}
      <div className="relative z-10 flex-1 flex flex-col">
        {children}
      </div>
    </div>
  );
}
