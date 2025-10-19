export type VerifyResp = { token: string; role: "master" | "fnbo"; exp?: number };

export async function verifyPasscode(passcode: string, role: "master" | "fnbo" = "master") {
  const res = await fetch("/api/auth/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ passcode, role }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || `Auth failed (${res.status})`);
  }
  return (await res.json()) as VerifyResp;
}
