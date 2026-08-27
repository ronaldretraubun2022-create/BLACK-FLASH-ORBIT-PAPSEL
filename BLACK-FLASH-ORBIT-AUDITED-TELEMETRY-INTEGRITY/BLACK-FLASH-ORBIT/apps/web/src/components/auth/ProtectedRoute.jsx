import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export function AuthLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#060a12] text-cyan-300">
      <div className="flex items-center gap-3 text-xs font-black tracking-[0.2em]">
        <span className="size-2 animate-pulse rounded-full bg-cyan-300 shadow-[0_0_18px_#67e8f9]" />
        CHECKING SESSION
      </div>
    </div>
  );
}

export function ProtectedRoute() {
  const { isLoading, session } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <AuthLoading />;
  }

  if (!session) {
    return <Navigate replace state={{ from: location }} to="/login" />;
  }

  return <Outlet />;
}

export function PublicOnlyRoute() {
  const { isLoading, session } = useAuth();

  if (isLoading) {
    return <AuthLoading />;
  }

  if (session) {
    return <Navigate replace to="/" />;
  }

  return <Outlet />;
}
