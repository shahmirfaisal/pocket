import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";

export default async function SetupLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if ((user.setupStep ?? 3) >= 3) redirect("/");
  return children;
}
