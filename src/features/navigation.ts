import type { LucideIcon } from "lucide-react";
import {
  Building2,
  Images,
  LayoutDashboard,
  Lightbulb,
  Megaphone,
  MessageCircleQuestion,
  Settings,
} from "lucide-react";

export type NavGroupId = "analyse" | "workspace";

export interface NavGroup {
  id: NavGroupId;
  label: string;
}

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  group: NavGroupId;
  /** Short description used for page metadata and the mobile sheet. */
  description: string;
}

export const NAV_GROUPS: readonly NavGroup[] = [
  { id: "analyse", label: "Analyse" },
  { id: "workspace", label: "Workspace" },
];

export const PRIMARY_NAV: readonly NavItem[] = [
  {
    href: "/",
    label: "Overview",
    icon: LayoutDashboard,
    group: "analyse",
    description: "Account performance at a glance",
  },
  {
    href: "/campaigns",
    label: "Campaigns",
    icon: Megaphone,
    group: "analyse",
    description: "Campaign-level performance",
  },
  {
    href: "/creatives",
    label: "Creatives",
    icon: Images,
    group: "analyse",
    description: "Creative performance and trends",
  },
  {
    href: "/insights",
    label: "Insights",
    icon: Lightbulb,
    group: "analyse",
    description: "What changed and why",
  },
  {
    href: "/ask",
    label: "Ask Analyst",
    icon: MessageCircleQuestion,
    group: "analyse",
    description: "Query your data in plain English",
  },
  {
    href: "/clients",
    label: "Clients",
    icon: Building2,
    group: "workspace",
    description: "Agency clients",
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
    group: "workspace",
    description: "Client targets and workspace",
  },
];

export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
