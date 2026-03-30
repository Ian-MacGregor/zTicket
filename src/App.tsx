/**
 * App.tsx
 *
 * Root of the application. Sets up global context providers (auth, colors),
 * the client-side router, and all top-level route definitions. Every protected
 * route is wrapped in <ProtectedRoute> so unauthenticated users are redirected
 * to /login automatically.
 *
 * Route structure:
 *   /login              — LoginPage (redirects to / if already signed in)
 *   /                   — DashboardPage (ticket list + side-panel slot)
 *     tickets/new       — TicketFormPage rendered inside the side panel
 *     tickets/:id       — TicketDetailPage rendered inside the side panel
 *     tickets/:id/edit  — TicketFormPage (edit mode) inside the side panel
 *   /clients            — ClientsPage
 *   /colors             — ColorsPage
 *   /settings           — SettingsPage
 *   /activity           — ActivityPage
 *   *                   — catch-all redirect to /
 */

import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  useNavigate,
  useOutlet,
  useLocation,
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

/**
 * Wraps any route that requires a signed-in user.
 * Shows a loading indicator while the auth state is being resolved,
 * then redirects to /login if no user is present.
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-state">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/**
 * Keeps DashboardPage permanently mounted so its filter/pagination state
 * is preserved when the user opens or closes a ticket panel.
 *
 * The nested outlet (ticket detail / form) is passed as a prop rather than
 * rendered as a child, which allows DashboardPage to decide where in its own
 * layout to display it.
 *
 * Note: useOutlet() returns a truthy element even for the index route whose
 * element is null, so panel visibility is derived from the URL path instead.
 */
function DashboardLayout() {
  const outlet = useOutlet();
  const navigate = useNavigate();
  const location = useLocation();
  // Always keeps DashboardPage mounted; passes outlet content in as a prop
  // so filter/pagination state is never reset when opening a ticket panel.
  const isTicketRoute = /^\/tickets\//.test(location.pathname);

  return (
    <DashboardPage
      panelContent={isTicketRoute ? outlet : null}
      onClosePanel={() => navigate("/")}
    />
  );
}

/**
 * Renders the full route tree once auth state has resolved.
 * Separating this from <App> avoids an extra re-render cycle on load.
 */
function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return <div className="loading-state">Loading…</div>;

  return (
    <Routes>
      {/* Public route — redirects authenticated users away from the login page */}
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
        {/* Index renders no panel content — dashboard shows the plain ticket list */}
        <Route index element={null} />
        <Route path="tickets/new" element={<TicketFormPage />} />
        <Route path="tickets/:id" element={<TicketDetailPage />} />
        <Route path="tickets/:id/edit" element={<TicketFormPage />} />
      </Route>

      {/* Stand-alone pages — each rendered inside the shared chrome Layout */}
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

      {/* Catch-all — any unknown path falls back to the dashboard */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

/**
 * Top-level component. Wraps the app in:
 *   - AuthProvider   — supplies user session state to the whole tree
 *   - ColorProvider  — applies the user's custom theme CSS variables
 *   - BrowserRouter  — scopes all routes under the /zTicket basename
 */
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
