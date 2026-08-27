import { useState } from "react";
import { LogIn } from "lucide-react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { AuthShell } from "../components/auth/AuthShell";
import { useAuth } from "../context/AuthContext";

export function Login() {
  const { isConfigured, session, signIn } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (session) {
    return <Navigate replace to="/" />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await signIn({ email, password });
      navigate(location.state?.from?.pathname || "/", { replace: true });
    } catch (authError) {
      setError(authError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      alternateLabel="Buat akun"
      alternateText="Belum memiliki akun?"
      alternateTo="/register"
      description="Masuk menggunakan akun newsroom yang telah terdaftar."
      title="Login"
    >
      <form className="grid gap-4" onSubmit={handleSubmit}>
        <AuthInput
          autoComplete="email"
          label="Email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="operator@blackflash.id"
          type="email"
          value={email}
        />
        <AuthInput
          autoComplete="current-password"
          label="Password"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Minimum 6 karakter"
          type="password"
          value={password}
        />

        {!isConfigured && (
          <AuthMessage>
            Isi `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` pada file
            `.env`.
          </AuthMessage>
        )}

        {error && <AuthMessage>{error}</AuthMessage>}

        <button
          className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-300/15 px-4 py-3 text-sm font-black text-cyan-100 transition hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!isConfigured || isSubmitting}
          type="submit"
        >
          <LogIn size={17} />
          {isSubmitting ? "Memproses..." : "Masuk ke Dashboard"}
        </button>
      </form>
    </AuthShell>
  );
}

function AuthInput({ label, ...props }) {
  return (
    <label className="grid gap-2 text-xs font-bold tracking-[0.12em] text-slate-400">
      {label.toUpperCase()}
      <input
        className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-medium tracking-normal text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/40"
        required
        {...props}
      />
    </label>
  );
}

function AuthMessage({ children }) {
  return (
    <p className="rounded-xl border border-rose-300/20 bg-rose-300/5 px-4 py-3 text-xs leading-5 text-rose-200">
      {children}
    </p>
  );
}
