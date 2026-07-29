import { useState, useEffect, type ReactNode } from "react";

const STORAGE_KEY = "iheal_access";
const ACCESS_PASSWORD = "Ihealai";

export default function PasswordGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const [input, setInput]       = useState("");
  const [error, setError]       = useState(false);
  const [shake, setShake]       = useState(false);

  // Check sessionStorage on mount
  useEffect(() => {
    if (sessionStorage.getItem(STORAGE_KEY) === "1") {
      setUnlocked(true);
    }
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (input === ACCESS_PASSWORD) {
      sessionStorage.setItem(STORAGE_KEY, "1");
      setUnlocked(true);
    } else {
      setError(true);
      setShake(true);
      setInput("");
      setTimeout(() => setShake(false), 600);
    }
  }

  if (unlocked) return <>{children}</>;

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-gray-950">
      {/* Logo / brand */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="w-14 h-14 rounded-2xl bg-brand-600 flex items-center justify-center shadow-lg">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
        </div>
        <div className="text-center">
          <h1 className="text-xl font-bold text-white tracking-tight">iHeal AI</h1>
          <p className="text-sm text-gray-500 mt-0.5">Intelligence Platform</p>
        </div>
      </div>

      {/* Password card */}
      <form
        onSubmit={handleSubmit}
        className={`w-full max-w-sm mx-4 ${shake ? "animate-[shake_0.5s_ease-in-out]" : ""}`}
      >
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl">
          <p className="text-sm font-semibold text-gray-200 mb-1">Enter access password</p>
          <p className="text-xs text-gray-500 mb-5">This platform is password protected.</p>

          <input
            type="password"
            value={input}
            onChange={(e) => { setInput(e.target.value); setError(false); }}
            placeholder="Password"
            autoFocus
            className={`w-full px-4 py-3 rounded-xl text-sm bg-gray-800 border text-white placeholder-gray-600 focus:outline-none focus:ring-2 transition-colors ${
              error
                ? "border-red-500 focus:ring-red-500/30"
                : "border-gray-700 focus:ring-brand-500/30 focus:border-brand-500"
            }`}
          />

          {error && (
            <p className="mt-2 text-xs text-red-400 font-medium">Incorrect password. Try again.</p>
          )}

          <button
            type="submit"
            disabled={!input}
            className="mt-4 w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
          >
            Unlock
          </button>
        </div>
      </form>

      <p className="mt-6 text-xs text-gray-700">iHeal AI · Enterprise Intelligence Platform</p>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%       { transform: translateX(-8px); }
          40%       { transform: translateX(8px); }
          60%       { transform: translateX(-6px); }
          80%       { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
}
