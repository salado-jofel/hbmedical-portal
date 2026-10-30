import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isDevLoginAllowed } from "@/lib/dev/dev-login-guard";
import { getDevAccounts } from "./(services)/actions";
import { DevAccountList } from "./(sections)/DevAccountList";

export const metadata: Metadata = { title: "Dev Login" };
export const dynamic = "force-dynamic";

export default async function DevLoginPage() {
  // 404 rather than 403 — the page should look like it does not exist.
  if (!(await isDevLoginAllowed())) notFound();

  return <DevAccountList accounts={await getDevAccounts()} />;
}
