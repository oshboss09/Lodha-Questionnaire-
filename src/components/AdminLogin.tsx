import React, { useState } from "react";
import { Lock, User, AlertCircle } from "lucide-react";

interface Props {
  onLogin: (success: boolean) => void;
}

export default function AdminLogin({ onLogin }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === "admin" && password === "jaya@bachan_2026") {
      onLogin(true);
      setError("");
    } else {
      setError("Invalid administrative credentials.");
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-6 bg-[#0a0a0a]">
      <div className="w-full max-w-md bg-surface border border-border-dark p-10 rounded-lg shadow-2xl">
        <div className="text-center mb-10">
          <div className="font-serif text-3xl tracking-[3px] text-gold uppercase mb-2">Lodha</div>
          <div className="text-[10px] text-[#888888] uppercase tracking-[2px]">Administrative Gateway</div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gold uppercase tracking-[1px] block">ID</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555555]" />
              <input 
                type="text" 
                autoComplete="username"
                className="w-full bg-black/40 border border-border-dark rounded p-4 pl-12 text-white outline-none focus:border-gold transition-colors"
                placeholder="Enter username"
                value={username}
                onChange={e => setUsername(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gold uppercase tracking-[1px] block">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555555]" />
              <input 
                type="password" 
                autoComplete="current-password"
                className="w-full bg-black/40 border border-border-dark rounded p-4 pl-12 text-white outline-none focus:border-gold transition-colors"
                placeholder="Enter password"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-900 bg-red-950/10 border border-red-900/20 p-4 rounded text-xs uppercase tracking-[1px]">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <button 
            type="submit"
            className="w-full lodha-btn lodha-btn-primary py-4 mt-4"
          >
            Login
          </button>
        </form>

        <div className="mt-8 text-center">
          <a href="/" className="text-[10px] text-[#555555] uppercase tracking-[1px] hover:text-gold transition-colors">
            Return to Public Access
          </a>
        </div>
      </div>
    </div>
  );
}
