"use client";

import { useAppSelector } from "@/store/hooks";

export function useIsAdmin(): boolean {
  return useAppSelector((state) => state.dashboard.role) === "admin";
}

export function useIsDoctor(): boolean {
  return useAppSelector((state) => state.dashboard.role) === "doctor";
}

export function useRole() {
  return useAppSelector((state) => state.dashboard.role);
}
