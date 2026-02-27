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
  const { isAuthenticated } = useAuth();
  const location = useLocation();

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
