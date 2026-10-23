import { redirect } from "next/navigation";
import { sessionUserId } from "@/lib/auth";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await sessionUserId()) redirect("/");
  return children;
}
