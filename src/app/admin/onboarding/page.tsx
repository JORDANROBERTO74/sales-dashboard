import { OnboardingForm } from "@/components/auth/onboarding-form";
import { requireAuth } from "@/lib/auth/require-auth";

export default async function AdminOnboardingPage() {
  // Ensure the user is authenticated using admin auth entrypoint.
  await requireAuth({
    redirectTo: "/auth/login",
  });

  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-muted/40 p-6 md:p-10">
      <div className="w-full max-w-lg">
        <OnboardingForm />
      </div>
    </div>
  );
}
