import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function ReadsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-[640px] mx-auto px-4">{children}</div>
    </div>
  );
}
