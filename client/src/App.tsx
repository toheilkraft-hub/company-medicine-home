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

function Routes() {
  return (
    <Switch>
      <Route path="/">
        <Redirect to="/chat" />
      </Route>

      <Route path="/chat">
        <AppShell><Chat /></AppShell>
      </Route>
      <Route path="/chat/:id">
        <AppShell><Chat /></AppShell>
      </Route>
      <Route path="/settings">
        <AppShell><Settings /></AppShell>
      </Route>
      <Route path="/profile">
        <AppShell><Profile /></AppShell>
      </Route>

      <Route><Redirect to="/chat" /></Route>
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
