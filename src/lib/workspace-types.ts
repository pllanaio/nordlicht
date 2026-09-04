import type { ScheduleItem } from "@/lib/data";

export const storedSecretPlaceholder = "••••••••••••";

export type OrganizationRole = "Administrator" | "Manager";

export type OrganizationMember = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: OrganizationRole;
  status: "Aktiv" | "Eingeladen";
};

export type SmtpSettings = {
  host: string;
  port: string;
  username: string;
  password: string;
  fromEmail: string;
  encryption: "STARTTLS" | "SSL/TLS";
};

export type Organization = {
  id: string;
  name: string;
  members: OrganizationMember[];
  smtp: SmtpSettings;
};

export type UserProfile = {
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string;
};

export type MediaAsset = {
  id: string;
  name: string;
  kind: "image" | "video";
  preview: string;
  size: number;
  uploadedAt: string;
  uploadedInSession?: boolean;
};

export type WorkspaceDashboardData = {
  revision: number;
  role: OrganizationRole;
  calendarAnchorDate: string;
  items: ScheduleItem[];
  mediaAssets: MediaAsset[];
  organization: Organization | null;
  profile: UserProfile;
};

export type WorkspaceStateInput = Pick<WorkspaceDashboardData, "revision" | "items" | "organization" | "profile">;
