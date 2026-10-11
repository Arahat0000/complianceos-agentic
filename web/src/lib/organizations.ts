import type { Invite, Member, Role } from "@complianceos/shared";
import { apiFetch } from "./api";

export type BackendMember = Member;

export function fetchOrgMembers(): Promise<BackendMember[]> {
  return apiFetch<BackendMember[]>("/organizations/me/members");
}

export type BackendInvite = Invite;

export function inviteMember(
  email: string,
  role: Role
): Promise<BackendInvite> {
  return apiFetch<BackendInvite>("/organizations/me/invites", {
    method: "POST",
    body: JSON.stringify({ email, role }),
  });
}
