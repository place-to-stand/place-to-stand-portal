import { Suspense } from "react";
import { redirect } from "next/navigation";

// Redirect-only page: the redirect happens behind Suspense so the route keeps
// a prerenderable shell (Cache Components instant-navigation pattern).
async function SettingsIndexRedirect() {
  return redirect("/settings/users");
}

export default function SettingsIndexPage() {
  return (
    <Suspense fallback={null}>
      <SettingsIndexRedirect />
    </Suspense>
  );
}
