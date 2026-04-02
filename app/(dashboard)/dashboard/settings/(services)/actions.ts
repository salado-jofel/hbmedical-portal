"use server";

// Consolidated settings actions — re-exports from feature-specific services

export {
  getProfile as getMyProfile,
  updateProfile,
} from "@/app/(dashboard)/dashboard/profile/(services)/actions";

export {
  getMyCredentials,
  saveCredentials,
  deleteCredentials,
} from "@/app/(dashboard)/dashboard/(services)/provider-credentials/actions";

export {
  getFacilityMembers,
  removeFacilityMember,
  updateMemberRole,
} from "@/app/(dashboard)/dashboard/(services)/facility-members/actions";

export {
  generateInviteToken as generateMemberInviteToken,
} from "@/app/(dashboard)/dashboard/onboarding/(services)/actions";
