import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  useNavigate,
  useOutlet,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { ColorProvider } from "./hooks/useColors";
import Layout from "./components/Layout";
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

// Always keeps DashboardPage mounted; passes outlet content in as a prop
// so filter/pagination state is never reset when opening a ticket panel.
function DashboardLayout() {
  const outlet = useOutlet();
  const navigate = useNavigate();

  return (
    <DashboardPage
      panelContent={outlet}
      onClosePanel={() => navigate("/")}
    />
  );
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return <div className="loading-state">Loading…</div>;

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <LoginPage />}
      />
      {/* Dashboard + ticket panel (nested routes share the dashboard layout) */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout>
              <DashboardLayout />
            </Layout>
          </ProtectedRoute>
        }
      >
        <Route index element={null} />
        <Route path="tickets/new" element={<TicketFormPage />} />
        <Route path="tickets/:id" element={<TicketDetailPage />} />
        <Route path="tickets/:id/edit" element={<TicketFormPage />} />
      </Route>

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
