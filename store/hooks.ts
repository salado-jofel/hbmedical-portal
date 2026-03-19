import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "./store";

// ─── Typed hooks (use these instead of plain useDispatch/useSelector) ─────────
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector = <T>(selector: (state: RootState) => T): T =>
  useSelector(selector);
