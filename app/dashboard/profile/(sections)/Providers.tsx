"use client";

import { useAppDispatch } from "@/store/hooks";
import { ReactNode, useEffect } from "react";
import { setProfile } from "../(redux)/profile-slice";
import { Profile } from "@/app/(interfaces)/profiles";

export default function Providers({
  children,
  profile,
}: {
  children: ReactNode;
  profile: Profile;
}) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(setProfile(profile));
  }, [profile]);

  return <>{children}</>;
}
