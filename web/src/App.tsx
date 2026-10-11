"use client";

import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AuthProvider } from "@/contexts/AuthProvider";
import { RoleProvider } from "@/contexts/RoleProvider";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import ScrollToTop from "@/components/scroll-to-top";
import { GoogleOAuthProvider } from "@react-oauth/google";

// Helpers
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

function RedirectToRegulationsDetail() {
  const { id } = useParams();
  return <Navigate to={`/regulations/${id}`} replace />;
}

import { AskAIProvider, AskAIPanel } from "@/components/ask-ai-drawer";

// Layout for Dashboard pages
function DashboardLayout() {
  return (
    <AskAIProvider>
      <SidebarProvider
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 62)",
            "--header-height": "calc(var(--spacing) * 12)",
          } as React.CSSProperties
        }
      >
        <AppSidebar variant="inset" />
        <SidebarInset className="min-w-0">
          <SiteHeader />
          <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden relative">
            <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
              <Outlet />
            </div>
            <AskAIPanel />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </AskAIProvider>
  );
}

// Page Imports
import DocumentLibrary from "@/pages/DocumentLibrary";
import KnowledgeBase from "@/pages/KnowledgeBase";
import Gaps from "@/pages/Gaps";
import Controls from "@/pages/Controls";
import AuditLog from "@/pages/AuditLog";
import Settings from "@/pages/Settings";
import Dashboard from "@/pages/Dashboard";
import DocumentDetail from "@/pages/DocumentDetail";
import EditDocument from "@/pages/EditDocument";
import Login from "@/pages/Login";
import SignUp from "@/pages/SignUp";
import ForgotPassword from "@/pages/ForgotPassword";
import UploadDocument from "@/pages/UploadDocument";
import Regulations from "@/pages/Regulations";
import TraceabilityMatrix from "@/pages/TraceabilityMatrix";
import TraceabilityDetail from "@/pages/TraceabilityDetail";
import SimulationEngine from "@/pages/SimulationEngine";
import CircularDetail from "@/pages/CircularDetail";
import EditCircular from "@/pages/EditCircular";
import Obligations from "@/pages/Obligations";
import ObligationDetail from "@/pages/ObligationDetail";
import UploadCircular from "@/pages/UploadCircular";
import NotFound from "@/pages/NotFound";

export default function Page() {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || "PASTE_YOUR_ID_HERE"}>
        <TooltipProvider>
          <BrowserRouter>
            <ScrollToTop />
            <AuthProvider>
              <RoleProvider>
                <Routes>
                  {/* ... standard routes ... */}
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/signup" element={<SignUp />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />

                  {/* Dashboard Area (Protected & Wraps with Sidebar/Header) */}
                  <Route element={
                    <ProtectedRoute>
                      <DashboardLayout />
                    </ProtectedRoute>
                  }>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/library" element={<DocumentLibrary />} />
                    <Route path="/knowledge-base" element={<KnowledgeBase />} />
                    <Route path="/gap-tracker" element={<Navigate to="/gaps" replace />} />
                    <Route path="/gaps" element={<Gaps />} />
                    <Route path="/controls" element={<Controls />} />
                    <Route path="/traceability" element={<TraceabilityMatrix />} />
                    <Route path="/traceability/:id" element={<TraceabilityDetail />} />
                    <Route path="/simulation" element={<SimulationEngine />} />
                    <Route path="/contradictions" element={<Navigate to="/regulations/1?tab=obligations" replace />} />
                    {/* Remediation was merged into Gaps — generating a plan is now a
                        quick action in the gap detail modal instead of its own page. */}
                    <Route path="/remediation" element={<Navigate to="/gaps" replace />} />
                    <Route path="/audit-log" element={<AuditLog />} />
                    <Route path="/admin" element={<Navigate to="/settings" replace />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/library/:id" element={<DocumentDetail />} />
                    <Route path="/library/:id/edit" element={<EditDocument />} />
                    <Route path="/upload-document" element={<UploadDocument />} />
                    <Route path="/library/upload" element={<UploadDocument />} />

                    {/* Assessments (audit-questionnaire workflow) was removed — it wasn't
                        part of the regulation-to-remediation chain this fork demos. The
                        underlying Assessment/AssessmentQuestion data stays as the
                        historical source for Knowledge Base. */}
                    <Route path="/workspace" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/assessment/:id" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/new-assessment" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/evidence-sources" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/upload-assessment" element={<Navigate to="/dashboard" replace />} />

                    <Route path="/regulatory-circulars" element={<Navigate to="/regulations" replace />} />
                    <Route path="/regulatory-circulars/:id" element={<RedirectToRegulationsDetail />} />
                    <Route path="/compliance-library" element={<Navigate to="/regulations" replace />} />
                    <Route path="/compliance-library/:id" element={<RedirectToRegulationsDetail />} />

                    <Route path="/regulations" element={<Regulations />} />
                    <Route path="/regulations/upload" element={<UploadCircular />} />
                    <Route path="/regulations/:id" element={<CircularDetail />} />
                    <Route path="/regulations/:id/edit" element={<EditCircular />} />
                    <Route path="/obligations" element={<Obligations />} />
                    <Route path="/obligations/:circularId" element={<ObligationDetail />} />
                  </Route>

                  <Route path="*" element={<NotFound />} />
                </Routes>
              </RoleProvider>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </GoogleOAuthProvider>
      <Toaster />
    </ThemeProvider>
  );
}
