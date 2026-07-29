import { Switch, Route, Redirect } from "wouter";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Chat from "./pages/Chat";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";
import AppShell from "./components/layout/AppShell";

function Spinner() {
  return (
    <div className="h-screen flex flex-col items-center justify-center gap-3 bg-gray-950">
      <div className="w-10 h-10 border-4 border-brand-800 border-t-brand-400 rounded-full animate-spin" />
      <p className="text-sm text-gray-500">Loading…</p>
    </div>
  );
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Redirect to="/login" />;
  return <>{children}</>;
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (user) return <Redirect to="/chat" />;
  return <>{children}</>;
}

function Routes() {
  return (
    <Switch>
      {/* Root → chat (authenticated) or login */}
      <Route path="/">
        <PublicOnlyRoute><Login /></PublicOnlyRoute>
      </Route>

      <Route path="/login">
        <PublicOnlyRoute><Login /></PublicOnlyRoute>
      </Route>
      <Route path="/register">
        <PublicOnlyRoute><Register /></PublicOnlyRoute>
      </Route>

      {/* App routes — all require auth */}
      <Route path="/chat">
        <PrivateRoute>
          <AppShell><Chat /></AppShell>
        </PrivateRoute>
      </Route>
      <Route path="/chat/:id">
        <PrivateRoute>
          <AppShell><Chat /></AppShell>
        </PrivateRoute>
      </Route>
      <Route path="/settings">
        <PrivateRoute>
          <AppShell><Settings /></AppShell>
        </PrivateRoute>
      </Route>
      <Route path="/profile">
        <PrivateRoute>
          <AppShell><Profile /></AppShell>
        </PrivateRoute>
      </Route>

      <Route><Redirect to="/" /></Route>
    </Switch>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes />
    </AuthProvider>
  );
}
