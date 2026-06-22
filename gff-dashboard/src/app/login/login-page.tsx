"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button, Card, FilterInput, PageHeader } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      username,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid username or password.");
      return;
    }

    const callbackUrl = searchParams.get("callbackUrl") ?? "/";
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <PageHeader
          title="GFF Dashboard"
          description="Sign in with your admin credentials."
        />
        <Card>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <label className="grid gap-1 text-sm">
              <span className="text-muted">Username</span>
              <FilterInput
                value={username}
                onChange={setUsername}
                placeholder="admin"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-muted">Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="border-card-border bg-background focus:border-accent w-full rounded-lg border px-3 py-2 text-sm outline-none"
                placeholder="••••••••"
              />
            </label>
            {error ? <p className="text-danger text-sm">{error}</p> : null}
            <Button type="submit" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
