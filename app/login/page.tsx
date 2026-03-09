import { AuthForm } from "@/components/AuthForm";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <img src="/icon.svg" alt="My Rundown" width={24} height={24} />
            <h1 className="text-xl font-semibold text-text-primary">
              My Rundown
            </h1>
          </div>
          <p className="text-text-muted text-sm">Sign in or create an account</p>
        </div>

        <div className="bg-surface border border-border rounded-xl p-6">
          <AuthForm />
        </div>
      </div>
    </div>
  );
}
