import type { LucideIcon } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuBadge,
} from "@/components/ui/sidebar";

export function NavMain({
  items,
}: {
  items: {
    title: string;
    url: string;
    icon: LucideIcon;
    badge?: string | number;
    badgeClassName?: string;
    relatedPaths?: string[];
  }[];
}) {
  const location = useLocation();

  return (
    <SidebarMenu>
      {items.map((item) => {
        const isActive =
          location.pathname === item.url ||
          location.pathname.startsWith(`${item.url}/`) ||
          (item.relatedPaths?.some((path) => location.pathname.startsWith(path)) ?? false);

        return (
          <SidebarMenuItem key={item.title}>
            <SidebarMenuButton
              asChild
              tooltip={item.title}
              isActive={isActive}
            >
              <Link to={item.url}>
                <item.icon />
                <span>{item.title}</span>
              </Link>
            </SidebarMenuButton>
            {!!item.badge && (
              <SidebarMenuBadge className={item.badgeClassName}>
                {item.badge}
              </SidebarMenuBadge>
            )}
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}
