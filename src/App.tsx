import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import CreateTournament from "./pages/CreateTournament";
import Tournaments from "./pages/Tournaments";
import TournamentDetail from "./pages/TournamentDetail";
import ManageTournament from "./pages/ManageTournament";
import Brackets from "./pages/Brackets";
import Results from "./pages/Results";
import Payment from "./pages/Payment";
import Profile from "./pages/Profile";
import Ranking from "./pages/Ranking";
import Feed from "./pages/Feed";
import Messages from "./pages/Messages";
import ChatView from "./pages/ChatView";
import NotFound from "./pages/NotFound";
import UserProfile from "./pages/UserProfile";
import AppLayout from "./components/layout/AppLayout";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminTournaments from "./pages/admin/AdminTournaments";
import AdminEnrollments from "./pages/admin/AdminEnrollments";
import AdminFinances from "./pages/admin/AdminFinances";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/tournaments/create" element={<CreateTournament />} />
            <Route element={<AppLayout />}>
              <Route path="/feed" element={<Feed />} />
              <Route path="/ranking" element={<Ranking />} />
              <Route path="/tournaments" element={<Tournaments />} />
              <Route path="/tournaments/:id" element={<TournamentDetail />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/profile/:userId" element={<UserProfile />} />
              <Route path="/payment/:id" element={<Payment />} />
              <Route path="/messages" element={<Messages />} />
              <Route path="/messages/:userId" element={<ChatView />} />
            </Route>
            <Route path="/tournaments/:id/manage" element={<ManageTournament />} />
            <Route path="/tournaments/:id/brackets" element={<Brackets />} />
            <Route path="/tournaments/:id/results" element={<Results />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="tournaments" element={<AdminTournaments />} />
              <Route path="enrollments" element={<AdminEnrollments />} />
              <Route path="finances" element={<AdminFinances />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
