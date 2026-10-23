import { redirect } from "next/navigation";
import { currentUser, publicUser } from "@/lib/auth";
import { AppShell } from "@/components/app";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if ((user.setupStep ?? 3) < 3) redirect("/setup");
  return <AppShell initialUser={publicUser(user)}>{children}</AppShell>;
}
