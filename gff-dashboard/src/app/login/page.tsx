import { Suspense } from "react";
import LoginPage from "./login-page";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-muted text-sm">Loading...</p>
        </div>
      }
    >
      <LoginPage />
    </Suspense>
  );
}
