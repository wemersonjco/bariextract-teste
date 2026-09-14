import React from 'react';
import { Database, Loader2 } from 'lucide-react';

const Loading = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAF9]">
      <div className="text-center">
        <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-2xl brand-gradient brand-shadow mb-5">
          <Database className="w-7 h-7 text-white" />
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white flex items-center justify-center shadow-sm">
            <Loader2 className="w-3.5 h-3.5 text-brand-600 animate-spin" />
          </div>
        </div>
        <h2 className="text-lg font-bold text-slate-900 tracking-tight mb-1">BariExtract</h2>
        <p className="text-sm text-slate-500">Carregando sistema...</p>
      </div>
    </div>
  );
};

export default Loading;
