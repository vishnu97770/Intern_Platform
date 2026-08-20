import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, isInitializing } = useAuth();

  if (isInitializing) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 text-sm text-slate-500" role="status">
        Loading your session…
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
