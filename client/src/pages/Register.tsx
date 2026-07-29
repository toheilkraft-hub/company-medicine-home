import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Cpu, Eye, EyeOff, AlertCircle, CheckCircle2 } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

export default function Register() {
  const [, navigate] = useLocation();
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("Passwords do not match"); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setLoading(true);
    try {
      await register(name, email, password);
      navigate("/chat");
    } catch (err: any) {
      setError(err.message ?? "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center">
              <Cpu size={20} className="text-white" />
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">iHeal AI</span>
          </div>
          <p className="text-gray-500 text-sm">Create your account</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-950 border border-red-800 rounded-lg text-red-400 text-sm mb-4">
              <AlertCircle size={15} className="shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Full name</label>
              <input type="text" required className="input" placeholder="Jane Smith"
                value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" required autoComplete="email" className="input"
                placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  required className="input pr-10"
                  placeholder="8+ characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button type="button" onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <div>
              <label className="label">Confirm password</label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  required className="input pr-10"
                  placeholder="Repeat password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
                {confirm.length > 0 && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {password === confirm
                      ? <CheckCircle2 size={15} className="text-green-500" />
                      : <AlertCircle size={15} className="text-red-500" />}
                  </div>
                )}
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5 mt-2">
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>

          <p className="text-center text-sm text-gray-600 mt-5">
            Already have an account?{" "}
            <Link href="/login" className="text-brand-400 hover:text-brand-300 font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
