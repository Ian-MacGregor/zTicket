import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { ColorProvider } from "./hooks/useColors";
import Layout from "./components/Layout";
import PanelDrawer from "./components/PanelDrawer";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import TicketFormPage from "./pages/TicketFormPage";
import TicketDetailPage from "./pages/TicketDetailPage";
import ClientsPage from "./pages/ClientsPage";
import ColorsPage from "./pages/ColorsPage";
import SettingsPage from "./pages/SettingsPage";
import ActivityPage from "./pages/ActivityPage";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-state">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const backgroundLocation = (location.state as any)?.backgroundLocation;

  if (loading) return <div className="loading-state">Loading…</div>;

  return (
    <>
      {/* Background (and direct-access) routes */}
      <Routes location={backgroundLocation || location}>
        <Route
          path="/login"
          element={user ? <Navigate to="/" replace /> : <LoginPage />}
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout><DashboardPage /></Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/tickets/new"
          element={
            <ProtectedRoute>
              <Layout><TicketFormPage /></Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/tickets/:id"
          element={
            <ProtectedRoute>
              <Layout><TicketDetailPage /></Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/tickets/:id/edit"
          element={
            <ProtectedRoute>
              <Layout><TicketFormPage /></Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/clients"
          element={
            <ProtectedRoute>
              <Layout><ClientsPage /></Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/colors"
          element={
            <ProtectedRoute>
              <Layout><ColorsPage /></Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Layout><SettingsPage /></Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/activity"
          element={
            <ProtectedRoute>
              <Layout><ActivityPage /></Layout>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Overlay routes — rendered as a right-side drawer when backgroundLocation is present */}
      {backgroundLocation && (
        <PanelDrawer onClose={() => navigate(-1)}>
          <Routes>
            <Route
              path="/tickets/new"
              element={
                <ProtectedRoute>
                  <TicketFormPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tickets/:id"
              element={
                <ProtectedRoute>
                  <TicketDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tickets/:id/edit"
              element={
                <ProtectedRoute>
                  <TicketFormPage />
                </ProtectedRoute>
              }
            />
          </Routes>
        </PanelDrawer>
      )}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ColorProvider>
        <BrowserRouter basename="/zTicket">
          <AppRoutes />
        </BrowserRouter>
      </ColorProvider>
    </AuthProvider>
  );
}
