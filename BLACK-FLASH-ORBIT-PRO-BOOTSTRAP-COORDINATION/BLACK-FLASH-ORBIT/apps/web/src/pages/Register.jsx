import { useState } from "react";
import { UserPlus } from "lucide-react";
import { Navigate } from "react-router-dom";
import { AuthShell } from "../components/auth/AuthShell";
import { useAuth } from "../context/AuthContext";

export function Register() {
  const { isConfigured, session, signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (session) {
    return <Navigate replace to="/" />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSubmitting(true);

    try {
      const data = await signUp({ email, password });

      setMessage(
        data.session
          ? "Akun berhasil dibuat. Anda sudah masuk ke dashboard."
          : data.profileError
            ? "Registrasi berhasil. Konfirmasi email, lalu login untuk menyinkronkan profile."
            : "Registrasi berhasil. Periksa email untuk konfirmasi akun.",
      );
    } catch (authError) {
      setError(authError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      alternateLabel="Masuk"
      alternateText="Sudah memiliki akun?"
      alternateTo="/login"
      description="Daftarkan akun operator newsroom untuk mengakses dashboard."
      title="Register"
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
          autoComplete="new-password"
          label="Password"
          minLength="6"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Minimum 6 karakter"
          type="password"
          value={password}
        />

        {!isConfigured && (
          <AuthMessage tone="error">
            Isi `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` pada file
            `.env`.
          </AuthMessage>
        )}

        {error && <AuthMessage tone="error">{error}</AuthMessage>}
        {message && <AuthMessage tone="success">{message}</AuthMessage>}

        <button
          className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-300/15 px-4 py-3 text-sm font-black text-cyan-100 transition hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!isConfigured || isSubmitting}
          type="submit"
        >
          <UserPlus size={17} />
          {isSubmitting ? "Memproses..." : "Buat Akun"}
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

function AuthMessage({ children, tone }) {
  const className =
    tone === "success"
      ? "border-cyan-300/20 bg-cyan-300/5 text-cyan-100"
      : "border-rose-300/20 bg-rose-300/5 text-rose-200";

  return (
    <p className={`rounded-xl border px-4 py-3 text-xs leading-5 ${className}`}>
      {children}
    </p>
  );
}
