import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { TenantProvider } from "@/contexts/TenantContext";
import Index from "./pages/Index";
import FlowTournament from "./pages/FlowTournament";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import CreateTournament from "./pages/CreateTournament";
import Tournaments from "./pages/Tournaments";
import TournamentDetail from "./pages/TournamentDetail";
import TournamentShare from "./pages/TournamentShare";
import ManageTournament from "./pages/ManageTournament";
import RedirectToManage from "./components/tournament/RedirectToManage";
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
import SocialProfile from "./pages/SocialProfile";
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
import AdminFeaturedListings from "./pages/admin/AdminFeaturedListings";
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
import ArenaProfile from "./pages/arena-dashboard/ArenaProfile";
import ArenaQR from "./pages/arena-dashboard/ArenaQR";
import ArenaProducts from "./pages/arena-dashboard/ArenaProducts";
import ArenaTeam from "./pages/arena-dashboard/ArenaTeam";
import ArenaCheckinList from "./pages/arena-dashboard/ArenaCheckinList";
import ArenaReception from "./pages/arena-dashboard/ArenaReception";
import PublicCheckin from "./pages/PublicCheckin";
import TenantArenaProfiles from "./pages/tenant/TenantArenaProfiles";
import TenantQR from "./pages/tenant/TenantQR";
import TenantProducts from "./pages/tenant/TenantProducts";
import TenantTeam from "./pages/tenant/TenantTeam";
import AdminControlTower from "./pages/admin/AdminControlTower";
import AdminInternalTools from "./pages/admin/AdminInternalTools";
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
import OrganizerDashboard from "./pages/organizer/OrganizerDashboard";
import AthleteDashboard from "./pages/athlete/AthleteDashboard";
import AdminShell from "./layouts/AdminShell";
import TenantShell from "./layouts/TenantShell";
import TenantDashboard from "./pages/tenant/TenantDashboard";
import ArenaShell from "./layouts/ArenaShell";
import OrganizerShell from "./layouts/OrganizerShell";
import AthleteShell from "./layouts/AthleteShell";
import CompanyShell from "./layouts/CompanyShell";
import CompanyDashboard from "./pages/company/CompanyDashboard";
import CompanySponsorBridge from "./pages/company/CompanySponsorBridge";
import AdminCommands from "./pages/admin/AdminCommands";
import OnboardingPending from "./pages/onboarding/OnboardingPending";
import ArenaOnboarding from "./pages/onboarding/ArenaOnboarding";
import CompanyOnboarding from "./pages/onboarding/CompanyOnboarding";
import OrganizerEvents from "./pages/organizer/OrganizerEvents";
import OrganizerEnrollments from "./pages/organizer/OrganizerEnrollments";
import OrganizerGames from "./pages/organizer/OrganizerGames";
import TenantCompanies from "./pages/tenant/TenantCompanies";
import AdminTenants from "./pages/admin/AdminTenants";
import CompanyMessages from "./pages/company/CompanyMessages";
import AdminWhatsAppInstances from "./pages/admin/AdminWhatsAppInstances";
import AdminWhatsAppMessages from "./pages/admin/AdminWhatsAppMessages";
import AdminWhatsAppBindings from "./pages/admin/AdminWhatsAppBindings";
import AdminWhatsAppLeads from "./pages/admin/AdminWhatsAppLeads";
import TenantWhatsAppRouting from "./pages/tenant/TenantWhatsAppRouting";
import ArenaMessages from "./pages/arena-dashboard/ArenaMessages";
import TenantMessages from "./pages/tenant/TenantMessages";
import TenantTournaments from "./pages/tenant/TenantTournaments";
import TenantCircuits from "./pages/tenant/TenantCircuits";
import TenantCalendar from "./pages/tenant/TenantCalendar";
import TenantFinance from "./pages/tenant/TenantFinance";
import TenantProfile from "./pages/tenant/TenantProfile";
import TournamentCheckinScan from "./pages/TournamentCheckinScan";
import OrganizerMessages from "./pages/organizer/OrganizerMessages";
import ConnectWhatsApp from "./pages/connect/ConnectWhatsApp";
import TenantConnectWhatsApp from "./pages/tenant/TenantConnectWhatsApp";
import ArenaConnectWhatsApp from "./pages/arena-dashboard/ArenaConnectWhatsApp";
import OrganizerConnectWhatsApp from "./pages/organizer/OrganizerConnectWhatsApp";
import CompanyConnectWhatsApp from "./pages/company/CompanyConnectWhatsApp";
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
            <Route path="/flow-tournament" element={<FlowTournament />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/onboarding/arena" element={<ArenaOnboarding />} />
            <Route path="/onboarding/company" element={<CompanyOnboarding />} />
            <Route path="/onboarding/:kind" element={<OnboardingPending />} />
            {/* Phase 13 — WhatsApp connection (outside shells to avoid gate redirect loop) */}
            <Route path="/connect-whatsapp" element={<ConnectWhatsApp />} />
            <Route path="/tenant/connect-whatsapp" element={<TenantConnectWhatsApp />} />
            <Route path="/arena/connect-whatsapp" element={<ArenaConnectWhatsApp />} />
            <Route path="/organizer/connect-whatsapp" element={<OrganizerConnectWhatsApp />} />
            <Route path="/company/connect-whatsapp" element={<CompanyConnectWhatsApp />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/tournaments/create" element={<CreateTournament />} />
            <Route element={<AppLayout />}>
              <Route path="/feed" element={<Feed />} />
              <Route path="/ranking" element={<Ranking />} />
              <Route path="/tournaments" element={<Tournaments />} />
              <Route path="/tournaments/:id" element={<TournamentDetail />} />
              <Route path="/tournaments/:id/share" element={<TournamentShare />} />
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
              <Route path="/u/:username" element={<SocialProfile />} />
            </Route>
            <Route path="/tournaments/:id/manage" element={<ManageTournament />} />
            <Route path="/tournaments/:id/brackets" element={<Brackets />} />
            <Route path="/tournaments/:id/results" element={<Results />} />
            <Route path="/tournaments/:id/checkin/scan" element={<TournamentCheckinScan />} />
            <Route path="/sponsor" element={<SponsorLayout />}>
              <Route path="dashboard" element={<SponsorDashboard />} />
              <Route path="tournaments" element={<SponsorTournaments />} />
              <Route path="sponsorships/:id" element={<SponsorshipDetail />} />
            </Route>
            <Route path="/arena/checkin" element={<ArenaCheckin />} />
            <Route path="/c/:code" element={<PublicCheckin />} />
            <Route path="/arena/dashboard" element={<ArenaShell />}>
              <Route index element={<ArenaDashboard />} />
              <Route path="torneios" element={<ArenaTournaments />} />
              <Route path="torneios/:id" element={<RedirectToManage />} />
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
              <Route path="mensagens-wa" element={<ArenaMessages />} />
              <Route path="perfil" element={<ArenaProfile />} />
              <Route path="qr" element={<ArenaQR />} />
              <Route path="produtos" element={<ArenaProducts />} />
              <Route path="equipe" element={<ArenaTeam />} />
              <Route path="entradas" element={<ArenaCheckinList />} />
              <Route path="recepcao" element={<ArenaReception />} />
            </Route>
            <Route path="/organizer/onboarding" element={<OrganizerOnboarding />} />
            {/* Phase 11.4 — Organizer Event Engine (additive shell) */}
            <Route path="/organizer/dashboard" element={<OrganizerShell />}>
              <Route index element={<OrganizerDashboard />} />
              <Route path="eventos" element={<OrganizerEvents />} />
              <Route path="eventos/:id" element={<RedirectToManage />} />
              <Route path="inscricoes" element={<OrganizerEnrollments />} />
              <Route path="jogos" element={<OrganizerGames />} />
              <Route path="financeiro" element={<OrganizerFinance />} />
              <Route path="mensagens-wa" element={<OrganizerMessages />} />
            </Route>
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
              <Route index element={<Navigate to="/athlete/feed" replace />} />
              <Route path="dashboard" element={<AthleteDashboard />} />
              <Route path="perfil" element={<Profile />} />
              <Route path="meu-dia" element={<AthleteDashboard />} />
              <Route path="feed" element={<Feed />} />
              <Route path="torneios" element={<Tournaments />} />
              <Route path="jogos" element={<AthleteDashboard />} />
              <Route path="ranking" element={<Ranking />} />
              <Route path="historico" element={<AthleteDashboard />} />
              <Route path="descobrir" element={<Explore />} />
              <Route path="mensagens" element={<Messages />} />
            </Route>
            {/* Phase 11.6 — Company Commercial Profile */}
            <Route path="/company" element={<CompanyShell />}>
              <Route index element={<Navigate to="/company/dashboard" replace />} />
              <Route path="dashboard" element={<CompanyDashboard />} />
              <Route path="marketplace" element={<MyCompany />} />
              <Route path="produtos" element={<MyCompany />} />
              <Route path="pedidos" element={<MyCompany />} />
              <Route path="campanhas" element={<CompanyDashboard />} />
              <Route path="performance" element={<CompanyDashboard />} />
              <Route path="visibilidade" element={<CompanyDashboard />} />
              <Route path="mensagens-wa" element={<CompanyMessages />} />
              {/* Sponsor bridge: provides `company` via Outlet context */}
              <Route path="sponsor" element={<CompanySponsorBridge />}>
                <Route path="torneios" element={<SponsorTournaments />} />
                <Route path="resumo" element={<SponsorDashboard />} />
              </Route>
              {/* Legacy alias — also passes through bridge */}
              <Route path="torneios-patrocinados" element={<CompanySponsorBridge />}>
                <Route index element={<SponsorTournaments />} />
              </Route>
            </Route>
            <Route path="/tenant" element={<TenantShell />}>
              <Route index element={<Navigate to="/tenant/dashboard" replace />} />
              <Route path="dashboard" element={<TenantDashboard />} />
              <Route path="arenas" element={<OrganizerArenas />} />
              <Route path="empresas" element={<TenantCompanies />} />
              <Route path="membros" element={<OrganizerMembers />} />
              <Route path="financeiro" element={<TenantFinance />} />
              <Route path="pagamento" element={<OrganizerPayment />} />
              <Route path="dominios" element={<OrganizerDomains />} />
              <Route path="whatsapp-routing" element={<TenantWhatsAppRouting />} />
              <Route path="mensagens-wa" element={<TenantMessages />} />
              <Route path="tournaments" element={<TenantTournaments />} />
              <Route path="torneios" element={<TenantTournaments />} />
              <Route path="circuitos" element={<TenantCircuits />} />
              <Route path="calendario" element={<TenantCalendar />} />
              <Route path="perfil" element={<TenantProfile />} />
              <Route path="arenas/perfis" element={<TenantArenaProfiles />} />
              <Route path="qr" element={<TenantQR />} />
              <Route path="produtos" element={<TenantProducts />} />
              <Route path="equipe" element={<TenantTeam />} />
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
              <Route path="featured-listings" element={<AdminFeaturedListings />} />
              <Route path="arenas" element={<AdminArenas />} />
              <Route path="split-rules" element={<AdminSplitRules />} />
              <Route path="adjustments" element={<AdminAdjustments />} />
              <Route path="ad-campaigns" element={<AdminAdCampaigns />} />
              <Route path="orkym" element={<AdminOrkymMonitor />} />
              <Route path="orkym-actions" element={<AdminOrkymActions />} />
              <Route path="autonomy" element={<AdminAutonomy />} />
              <Route path="control-tower" element={<AdminControlTower />} />
              <Route path="internal-tools" element={<AdminInternalTools />} />
              <Route path="tenants" element={<AdminTenants />} />
              <Route path="commands" element={<AdminCommands />} />
              <Route path="whatsapp-instances" element={<AdminWhatsAppInstances />} />
              <Route path="whatsapp-messages" element={<AdminWhatsAppMessages />} />
              <Route path="whatsapp-bindings" element={<AdminWhatsAppBindings />} />
              <Route path="whatsapp-leads" element={<AdminWhatsAppLeads />} />
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
