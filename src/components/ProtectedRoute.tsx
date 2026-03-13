import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

type ProtectedRouteProps = {
  children: ReactNode;
  redirectTo?: string;
  message?: string;
};

export default function ProtectedRoute({
  children,
  redirectTo = "/profile",
  message = "Please log in to continue.",
}: ProtectedRouteProps) {
  const { isAuthenticated, isAuthLoading } = useAuth();
  const location = useLocation();

  if (isAuthLoading) {
    return (
      <div className="bg-bg text-text min-h-screen flex items-center justify-center p-6">
        <p className="text-text-muted">Checking authentication status...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        replace
        state={{ fromPath: location.pathname, message }}
        to={redirectTo}
      />
    );
  }

  return <>{children}</>;
}
