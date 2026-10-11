import * as React from "react";
import {
  Database,
  FileOutput,
  Library,
  Settings,
  TriangleAlert,
  PanelsTopLeft,
  ScrollText,
  ShieldCheck,
  Layers,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { fetchComplianceGaps } from "@/lib/complianceGaps";
import { CLOSED_GAP_STATUSES, DEMO_OPEN_GAPS_COUNT } from "@/demo/complianceScenario";

import StacksIcon from "@/components/stack_icon";

import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
} from "@/components/ui/sidebar";

const dashboardNav = [
  { title: "Dashboard", url: "/dashboard", icon: PanelsTopLeft },
];

// The traceability chain the whole product is built around: regulations ->
// obligations -> controls -> gaps -> remediation. Kept in this exact order
// and as its own group so the sidebar reads as the pipeline, not just an
// alphabetical feature list. Remediation isn't its own nav item — generating
// a plan is a quick action inside a gap's detail modal — but the label
// still names it so the last pipeline stage isn't invisible in the nav.
const buildPipelineNav = (gapBadge?: number) => [
  {
    title: "Regulations & Obligations",
    url: "/regulations",
    icon: ScrollText,
    relatedPaths: ["/obligations"],
  },
  { title: "Controls", url: "/controls", icon: ShieldCheck },
  {
    title: "Gaps & Remediation",
    url: "/gaps",
    icon: TriangleAlert,
    relatedPaths: ["/gap-tracker", "/remediation"],
    badge: gapBadge,
    badgeClassName: "bg-red-500 !text-white border-none shadow-sm",
  },
  {
    title: "Regulatory Traceability Matrix",
    url: "/traceability",
    icon: Layers,
  },
  {
    title: "What-If Simulation",
    url: "/simulation",
    icon: Zap,
  },
];

const libraryNav = [
  {
    title: "Document Library",
    url: "/library",
    icon: Library,
    relatedPaths: ["/upload-document"],
  },
  { title: "Knowledge Base", url: "/knowledge-base", icon: Database },
];

const systemNav = [
  { title: "Audit Log", url: "/audit-log", icon: FileOutput },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user, isDemo } = useAuth();
  const [openGaps, setOpenGaps] = React.useState<number | undefined>(
    isDemo ? DEMO_OPEN_GAPS_COUNT : undefined
  );

  React.useEffect(() => {
    if (isDemo) return;
    fetchComplianceGaps()
      .then((gaps) => {
        setOpenGaps(gaps.filter((g) => !CLOSED_GAP_STATUSES.has(g.status)).length);
      })
      .catch(() => setOpenGaps(undefined));
  }, [isDemo]);

  const displayUser = {
    name: user?.name || "Guest",
    email: user?.email || "guest@example.com",
    avatar: user?.avatar || user?.avatarUrl || user?.AvatarUrl || user?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user?.name || "Guest")}`,
  };

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <Link
              to="/dashboard"
              className="flex items-center gap-1 px-2 py-2 font-medium text-foreground"
            >
              <div className="flex size-6 shrink-0 items-center justify-center">
                <StacksIcon size={24} color="text-primary" />
              </div>
              <span className="truncate font-semibold text-base">
                ComplianceOS
              </span>
            </Link>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <NavMain items={dashboardNav} />
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Pipeline</SidebarGroupLabel>
          <NavMain items={buildPipelineNav(openGaps)} />
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Library</SidebarGroupLabel>
          <NavMain items={libraryNav} />
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>System Administration</SidebarGroupLabel>
          <NavMain items={systemNav} />
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={displayUser} />
      </SidebarFooter>
    </Sidebar>
  );
}
