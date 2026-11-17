import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppShell } from './components/layout/AppShell';
import { ProtectedRoute } from './components/guards/ProtectedRoute';

// Páginas Oficiales de URPMP (A5 / BASE.md 5.1)
import { LoginSSOView } from './pages/auth/LoginSSOView';
import { DashboardView } from './pages/dashboard/DashboardView';
import { NewProjectWizard } from './pages/projects/NewProjectWizard';
import { ProjectDetailView } from './pages/projects/ProjectDetailView';
import { ReviewInboxView } from './pages/review/ReviewInboxView';
import { ProjectDocumentsView } from './pages/documents/ProjectDocumentsView';
import { ReportsDashboardView } from './pages/reports/ReportsDashboardView';
import { NormativeAssistantView } from './pages/normative/NormativeAssistantView';
import { AdminPanelView } from './pages/admin/AdminPanelView';
import { PublicVerificationView } from './pages/public/PublicVerificationView';
import { ResolutionView } from './pages/public/ResolutionView';
import { ScientificProductsView } from './pages/products/ScientificProductsView';
import { ObservationSubsanationView } from './pages/projects/ObservationSubsanationView';
import { CollegiateDictamenView } from './pages/review/CollegiateDictamenView';

function RouterContent() {
  const [currentRoute, setCurrentRoute] = useState<string>(
    window.location.hash || '#/inicio'
  );
  const { isAuthenticated, isRestoring } = useAuth();

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentRoute(window.location.hash || '#/inicio');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const isPublicRoute = currentRoute.startsWith('#/verificar') || currentRoute.startsWith('#/resolucion');

  // 0. Mientras se consulta si existe una sesión previa (cookie HttpOnly)
  if (isRestoring && !isPublicRoute) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-base text-sm text-slate-500">
        Verificando sesión institucional…
      </div>
    );
  }

  // 1. Ruta de Ingreso / Login SSO
  if ((currentRoute === '#/ingresar' && !isAuthenticated) || (!isAuthenticated && !isPublicRoute)) {
    return <LoginSSOView />;
  }

  // 2. Ruta Pública de Verificación QR / CVD (accesible sin login NFR-009)
  if (currentRoute.startsWith('#/verificar')) {
    return (
      <div className="min-h-screen bg-bg-base py-8 px-4">
        <PublicVerificationView />
      </div>
    );
  }

  // 3. Resolución Rectoral Pública
  if (currentRoute.startsWith('#/resolucion')) {
    return (
      <div className="min-h-screen bg-bg-base py-8 px-4">
        <ResolutionView />
      </div>
    );
  }

  // 4. Rutas Autenticadas dentro del <AppShell>
  return (
    <AppShell>
      {(() => {
        if (currentRoute === '#/inicio' || currentRoute === '' || currentRoute === '#/') {
          return <DashboardView />;
        }
        if (currentRoute === '#/proyectos/nuevo') {
          return (
            <ProtectedRoute allowedRoles={['researcher']}>
              <NewProjectWizard />
            </ProtectedRoute>
          );
        }
        if (currentRoute === '#/productos') {
          return (
            <ProtectedRoute allowedRoles={['researcher', 'research_coordinator', 'university_authority']}>
              <ScientificProductsView />
            </ProtectedRoute>
          );
        }
        if (currentRoute.startsWith('#/subsanacion')) {
          return (
            <ProtectedRoute allowedRoles={['researcher', 'research_coordinator']}>
              <ObservationSubsanationView />
            </ProtectedRoute>
          );
        }
        if (currentRoute === '#/dictamen-colegiado') {
          return (
            <ProtectedRoute allowedRoles={['committee_member', 'research_coordinator']}>
              <CollegiateDictamenView />
            </ProtectedRoute>
          );
        }
        if (currentRoute.includes('/documentos')) {
          return (
            <ProtectedRoute allowedRoles={['researcher', 'student_researcher', 'research_coordinator', 'department_coordinator']}>
              <ProjectDocumentsView />
            </ProtectedRoute>
          );
        }
        if (currentRoute.startsWith('#/proyectos/')) {
          return (
            <ProtectedRoute allowedRoles={['researcher', 'student_researcher', 'research_coordinator', 'committee_member', 'department_coordinator']}>
              <ProjectDetailView />
            </ProtectedRoute>
          );
        }
        if (currentRoute === '#/revision') {
          return (
            <ProtectedRoute allowedRoles={['research_coordinator', 'committee_member']}>
              <ReviewInboxView />
            </ProtectedRoute>
          );
        }
        if (currentRoute === '#/reportes') {
          return (
            <ProtectedRoute allowedRoles={['research_coordinator', 'department_coordinator', 'university_authority', 'researcher']}>
              <ReportsDashboardView />
            </ProtectedRoute>
          );
        }
        if (currentRoute === '#/normativa') {
          return <NormativeAssistantView />;
        }
        if (currentRoute === '#/administracion') {
          return (
            <ProtectedRoute allowedRoles={['administrator']}>
              <AdminPanelView />
            </ProtectedRoute>
          );
        }

        return <DashboardView />;
      })()}
    </AppShell>
  );
}

export function App() {
  return (
    <AuthProvider>
      <RouterContent />
    </AuthProvider>
  );
}

export default App;
