import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "../lib/queryClient";
import { useAuth } from "../contexts/AuthContext";
import { User, Shield, LogOut, CheckCircle2, AlertCircle } from "lucide-react";
import { initials } from "../lib/utils";
import { useLocation } from "wouter";

export default function Profile() {
  const { user, logout, refreshUser } = useAuth();
  const [, navigate] = useLocation();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState(user?.name ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwSaved, setPwSaved] = useState(false);
  const [pwError, setPwError] = useState("");

  const updateProfile = useMutation({
    mutationFn: (data: { name: string; bio: string }) =>
      apiFetch("/api/auth/profile", "PATCH", data),
    onSuccess: async () => {
      await refreshUser();
      setSaved(true);
      setError("");
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (err: Error) => setError(err.message),
  });

  const changePw = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      apiFetch("/api/auth/change-password", "POST", data),
    onSuccess: () => {
      setPwSaved(true);
      setPwError("");
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
      setTimeout(() => setPwSaved(false), 3000);
    },
    onError: (err: Error) => setPwError(err.message),
  });

  return (
    <div className="h-full overflow-y-auto bg-white">
      <div className="max-w-xl mx-auto px-6 py-6 space-y-5">
        <h2 className="text-xl font-bold text-gray-900">Profile</h2>

        {/* Avatar card */}
        <div className="card flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-brand-50 border border-brand-200 flex items-center justify-center text-xl font-bold text-brand-600 shrink-0">
            {initials(user?.name ?? "?")}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900">{user?.name}</p>
            <p className="text-sm text-gray-500">{user?.email}</p>
            <span className="badge bg-gray-100 text-gray-600 border border-gray-200 mt-1">
              <Shield size={10} /> {user?.role}
            </span>
          </div>
          <button
            onClick={async () => { await logout(); navigate("/login"); }}
            className="btn-ghost text-red-500 hover:text-red-400 hover:bg-red-950 text-sm"
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>

        {/* Edit profile */}
        <div className="card space-y-4">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2 text-sm">
            <User size={15} className="text-brand-400" /> Personal Information
          </h3>

          {saved && (
            <div className="flex items-center gap-2 p-3 bg-green-950 border border-green-800 rounded-lg text-green-400 text-sm">
              <CheckCircle2 size={14} /> Profile updated.
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-950 border border-red-800 rounded-lg text-red-400 text-sm">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          <div>
            <label className="label">Full name</label>
            <input type="text" className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" className="input opacity-50 cursor-not-allowed" value={user?.email ?? ""} disabled />
          </div>
          <div>
            <label className="label">Bio</label>
            <textarea className="input resize-none" rows={2} placeholder="About you…"
              value={bio} onChange={(e) => setBio(e.target.value)} />
          </div>
          <div className="flex justify-end">
            <button onClick={() => updateProfile.mutate({ name, bio })}
              disabled={updateProfile.isPending} className="btn-primary text-sm">
              {updateProfile.isPending ? "Saving…" : "Save profile"}
            </button>
          </div>
        </div>

        {/* Change password */}
        <div className="card space-y-4">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2 text-sm">
            <Shield size={15} className="text-brand-400" /> Change Password
          </h3>

          {pwSaved && (
            <div className="flex items-center gap-2 p-3 bg-green-950 border border-green-800 rounded-lg text-green-400 text-sm">
              <CheckCircle2 size={14} /> Password changed.
            </div>
          )}
          {pwError && (
            <div className="flex items-center gap-2 p-3 bg-red-950 border border-red-800 rounded-lg text-red-400 text-sm">
              <AlertCircle size={14} /> {pwError}
            </div>
          )}

          <div>
            <label className="label">Current password</label>
            <input type="password" className="input" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} />
          </div>
          <div>
            <label className="label">New password</label>
            <input type="password" className="input" placeholder="8+ characters" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
          </div>
          <div>
            <label className="label">Confirm new password</label>
            <input type="password" className="input" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
          </div>
          <div className="flex justify-end">
            <button
              onClick={() => {
                if (newPw !== confirmPw) { setPwError("Passwords do not match"); return; }
                changePw.mutate({ currentPassword: currentPw, newPassword: newPw });
              }}
              disabled={changePw.isPending || !currentPw || !newPw}
              className="btn-primary text-sm"
            >
              {changePw.isPending ? "Changing…" : "Change password"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
