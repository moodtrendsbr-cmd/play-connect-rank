import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
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
import TournamentMatch from "./pages/TournamentMatch";
import MatchRequests from "./pages/MatchRequests";
import MatchPair from "./pages/MatchPair";
import MatchChat from "./pages/MatchChat";
import AppLayout from "./components/layout/AppLayout";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminTournaments from "./pages/admin/AdminTournaments";
import AdminEnrollments from "./pages/admin/AdminEnrollments";
import AdminFinances from "./pages/admin/AdminFinances";
import AdminCompanies from "./pages/admin/AdminCompanies";
import AdminProducts from "./pages/admin/AdminProducts";
import AdminAds from "./pages/admin/AdminAds";
import AdminSponsors from "./pages/admin/AdminSponsors";
import AdminMonetization from "./pages/admin/AdminMonetization";
import Marketplace from "./pages/Marketplace";
import MarketplaceCompany from "./pages/MarketplaceCompany";
import MarketplaceProduct from "./pages/MarketplaceProduct";
import MarketplaceRegister from "./pages/MarketplaceRegister";
import MyCompany from "./pages/MyCompany";
import Cart from "./pages/Cart";
import MarketplaceCheckout from "./pages/MarketplaceCheckout";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <CartProvider>
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
              <Route path="/tournaments/:id/match" element={<TournamentMatch />} />
              <Route path="/tournaments/:id/match/requests" element={<MatchRequests />} />
              <Route path="/tournaments/:id/match/pair" element={<MatchPair />} />
              <Route path="/tournaments/:id/match/chat/:conversationId" element={<MatchChat />} />
              <Route path="/marketplace" element={<Marketplace />} />
              <Route path="/marketplace/register" element={<MarketplaceRegister />} />
              <Route path="/marketplace/my-company" element={<MyCompany />} />
              <Route path="/marketplace/company/:companyId" element={<MarketplaceCompany />} />
              <Route path="/marketplace/product/:productId" element={<MarketplaceProduct />} />
              <Route path="/marketplace/cart" element={<Cart />} />
              <Route path="/marketplace/checkout" element={<MarketplaceCheckout />} />
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
              <Route path="companies" element={<AdminCompanies />} />
              <Route path="products" element={<AdminProducts />} />
              <Route path="ads" element={<AdminAds />} />
              <Route path="sponsors" element={<AdminSponsors />} />
              <Route path="monetization" element={<AdminMonetization />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
          </CartProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
