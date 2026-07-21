import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import type { Role } from '../../types/domain';

export function ProtectedRoute({ children, allowedRoles }: { children: ReactNode; allowedRoles?: Role[] }) {
  const { user, roles, loading, configured } = useAuth();
  const location = useLocation();
  if (loading) return <div className="grid min-h-screen place-items-center text-slate-600">Carregando...</div>;
  if (!configured) return <Navigate to="/configuracao-inicial" replace />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (allowedRoles && !allowedRoles.some(role => roles.includes(role))) return <Navigate to="/acesso-negado" replace />;
  return <>{children}</>;
}
