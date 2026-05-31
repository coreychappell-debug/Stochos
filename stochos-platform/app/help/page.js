export const dynamic = 'force-dynamic';

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppShell from "../components/AppShell";
import HelpClient from "./HelpClient";

export const metadata = {
  title: "Stochos User Guide & Support Center",
};

export default async function HelpPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <AppShell>
      <HelpClient />
    </AppShell>
  );
}
