import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { TenantProvider } from "@/contexts/TenantContext";
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
import MarketplaceTournaments from "./pages/MarketplaceTournaments";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import AdminSponsorships from "./pages/admin/AdminSponsorships";
import AdminAnalytics from "./pages/admin/AdminAnalytics";
import AdminGifts from "./pages/admin/AdminGifts";
import AdminPlans from "./pages/admin/AdminPlans";
import AdminArenas from "./pages/admin/AdminArenas";
import SponsorLayout from "./pages/sponsor/SponsorLayout";
import SponsorDashboard from "./pages/sponsor/SponsorDashboard";
import SponsorTournaments from "./pages/sponsor/SponsorTournaments";
import SponsorshipDetail from "./pages/sponsor/SponsorshipDetail";
import ArenaLayout from "./pages/arena-dashboard/ArenaLayout";
import ArenaDashboard from "./pages/arena-dashboard/ArenaDashboard";
import ArenaCourts from "./pages/arena-dashboard/ArenaCourts";
import ArenaSchedule from "./pages/arena-dashboard/ArenaSchedule";
import ArenaBookings from "./pages/arena-dashboard/ArenaBookings";
import ArenaSponsors from "./pages/arena-dashboard/ArenaSponsors";
import ArenaStudents from "./pages/arena-dashboard/ArenaStudents";
import ArenaInstructors from "./pages/arena-dashboard/ArenaInstructors";
import ArenaClasses from "./pages/arena-dashboard/ArenaClasses";
import ArenaClassEnrollments from "./pages/arena-dashboard/ArenaClassEnrollments";
import ArenaCheckin from "./pages/arena-dashboard/ArenaCheckin";
import ArenaPlans from "./pages/arena-dashboard/ArenaPlans";
import ArenaSubscriptions from "./pages/arena-dashboard/ArenaSubscriptions";
import ArenaBilling from "./pages/arena-dashboard/ArenaBilling";
import ArenaOccurrences from "./pages/arena-dashboard/ArenaOccurrences";
import ArenaTournaments from "./pages/arena-dashboard/ArenaTournaments";
import ArenaFinance from "./pages/arena-dashboard/ArenaFinance";
import ArenaTransactions from "./pages/arena-dashboard/ArenaTransactions";
import OrganizerFinance from "./pages/organizer/OrganizerFinance";
import AdminSplitRules from "./pages/admin/AdminSplitRules";
import AdminAdjustments from "./pages/admin/AdminAdjustments";
import AdminAdCampaigns from "./pages/admin/AdminAdCampaigns";
import AdminOrkymMonitor from "./pages/admin/AdminOrkymMonitor";
import AdminOrkymActions from "./pages/admin/AdminOrkymActions";
import AdminAutonomy from "./pages/admin/AdminAutonomy";
import ArenaActions from "./pages/arena-dashboard/ArenaActions";
import ArenaAutonomy from "./pages/arena-dashboard/ArenaAutonomy";
import ArenaControlTower from "./pages/arena-dashboard/ArenaControlTower";
import AdminControlTower from "./pages/admin/AdminControlTower";
import Explore from "./pages/Explore";
import AthletesList from "./pages/AthletesList";
import ArenasList from "./pages/arenas/ArenasList";
import ArenaPublic from "./pages/arenas/ArenaPublic";
import ArenaBooking from "./pages/arenas/ArenaBooking";
import OrganizerOnboarding from "./pages/organizer/OrganizerOnboarding";
import OrganizerLayout from "./pages/organizer/OrganizerLayout";
import OrganizerSettings from "./pages/organizer/OrganizerSettings";
import OrganizerMembers from "./pages/organizer/OrganizerMembers";
import OrganizerArenas from "./pages/organizer/OrganizerArenas";
import OrganizerDomains from "./pages/organizer/OrganizerDomains";
import OrganizerPayment from "./pages/organizer/OrganizerPayment";
import AdminShell from "./layouts/AdminShell";
import TenantShell from "./layouts/TenantShell";
import ArenaShell from "./layouts/ArenaShell";
import OrganizerShell from "./layouts/OrganizerShell";
import AthleteShell from "./layouts/AthleteShell";
import CompanyShell from "./layouts/CompanyShell";
import { Navigate } from "react-router-dom";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <TenantProvider>
        <AuthProvider>
          <CartProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
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
              <Route path="/marketplace/tournaments" element={<MarketplaceTournaments />} />
              <Route path="/explore" element={<Explore />} />
              <Route path="/athletes" element={<AthletesList />} />
              <Route path="/arenas" element={<ArenasList />} />
              <Route path="/arenas/:arenaSlug" element={<ArenaPublic />} />
              <Route path="/arenas/:arenaSlug/reservar" element={<ArenaBooking />} />
            </Route>
            <Route path="/tournaments/:id/manage" element={<ManageTournament />} />
            <Route path="/tournaments/:id/brackets" element={<Brackets />} />
            <Route path="/tournaments/:id/results" element={<Results />} />
            <Route path="/sponsor" element={<SponsorLayout />}>
              <Route path="dashboard" element={<SponsorDashboard />} />
              <Route path="tournaments" element={<SponsorTournaments />} />
              <Route path="sponsorships/:id" element={<SponsorshipDetail />} />
            </Route>
            <Route path="/arena/checkin" element={<ArenaCheckin />} />
            <Route path="/arena/dashboard" element={<ArenaLayout />}>
              <Route index element={<ArenaDashboard />} />
              <Route path="torneios" element={<ArenaTournaments />} />
              <Route path="financeiro" element={<ArenaFinance />} />
              <Route path="transacoes" element={<ArenaTransactions />} />
              <Route path="alunos" element={<ArenaStudents />} />
              <Route path="professores" element={<ArenaInstructors />} />
              <Route path="aulas" element={<ArenaClasses />} />
              <Route path="matriculas" element={<ArenaClassEnrollments />} />
              <Route path="quadras" element={<ArenaCourts />} />
              <Route path="horarios" element={<ArenaSchedule />} />
              <Route path="reservas" element={<ArenaBookings />} />
              <Route path="patrocinios" element={<ArenaSponsors />} />
              <Route path="planos" element={<ArenaPlans />} />
              <Route path="assinaturas" element={<ArenaSubscriptions />} />
              <Route path="cobrancas" element={<ArenaBilling />} />
              <Route path="ocorrencias" element={<ArenaOccurrences />} />
              <Route path="acoes-ia" element={<ArenaActions />} />
              <Route path="autonomia" element={<ArenaAutonomy />} />
              <Route path="control-tower" element={<ArenaControlTower />} />
            </Route>
            <Route path="/organizer/onboarding" element={<OrganizerOnboarding />} />
            <Route path="/organizer" element={<OrganizerLayout />}>
              <Route index element={<Navigate to="/organizer/settings" replace />} />
              <Route path="settings" element={<OrganizerSettings />} />
              <Route path="members" element={<OrganizerMembers />} />
              <Route path="arenas" element={<OrganizerArenas />} />
              <Route path="domains" element={<OrganizerDomains />} />
              <Route path="payment" element={<OrganizerPayment />} />
              <Route path="finance" element={<OrganizerFinance />} />
            </Route>
            {/* Phase 11.1 — alias shells (additive, do not break legacy routes) */}
            <Route path="/arena" element={<Navigate to="/arena/dashboard" replace />} />
            <Route path="/athlete" element={<AthleteShell />}>
              <Route index element={<Navigate to="/athlete/perfil" replace />} />
              <Route path="perfil" element={<Profile />} />
              <Route path="feed" element={<Feed />} />
              <Route path="torneios" element={<Tournaments />} />
              <Route path="ranking" element={<Ranking />} />
              <Route path="mensagens" element={<Messages />} />
            </Route>
            <Route path="/company" element={<CompanyShell />}>
              <Route index element={<Navigate to="/company/marketplace" replace />} />
              <Route path="marketplace" element={<MyCompany />} />
              <Route path="produtos" element={<MyCompany />} />
              <Route path="pedidos" element={<MyCompany />} />
              <Route path="campanhas" element={<SponsorDashboard />} />
              <Route path="torneios-patrocinados" element={<SponsorTournaments />} />
              <Route path="performance" element={<SponsorDashboard />} />
            </Route>
            <Route path="/tenant" element={<TenantShell />}>
              <Route index element={<Navigate to="/tenant/overview" replace />} />
              <Route path="overview" element={<OrganizerSettings />} />
              <Route path="arenas" element={<OrganizerArenas />} />
              <Route path="membros" element={<OrganizerMembers />} />
              <Route path="empresas" element={<OrganizerArenas />} />
              <Route path="financeiro" element={<OrganizerFinance />} />
              <Route path="pagamento" element={<OrganizerPayment />} />
              <Route path="branding" element={<OrganizerSettings />} />
              <Route path="dominios" element={<OrganizerDomains />} />
              <Route path="autonomia" element={<AdminAutonomy />} />
            </Route>
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
              <Route path="sponsorships" element={<AdminSponsorships />} />
              <Route path="analytics" element={<AdminAnalytics />} />
              <Route path="gifts" element={<AdminGifts />} />
              <Route path="plans" element={<AdminPlans />} />
              <Route path="monetization" element={<AdminMonetization />} />
              <Route path="arenas" element={<AdminArenas />} />
              <Route path="split-rules" element={<AdminSplitRules />} />
              <Route path="adjustments" element={<AdminAdjustments />} />
              <Route path="ad-campaigns" element={<AdminAdCampaigns />} />
              <Route path="orkym" element={<AdminOrkymMonitor />} />
              <Route path="orkym-actions" element={<AdminOrkymActions />} />
              <Route path="autonomy" element={<AdminAutonomy />} />
              <Route path="control-tower" element={<AdminControlTower />} />
              <Route path="tenants" element={<AdminArenas />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
          </CartProvider>
        </AuthProvider>
        </TenantProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
