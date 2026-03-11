"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        setError(payload.message ?? "Đăng nhập thất bại.");
        return;
      }

      router.replace("/admin");
      router.refresh();
    } catch {
      setError("Không thể kết nối tới máy chủ. Vui lòng thử lại.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="grid gap-5" onSubmit={handleSubmit}>
      <label className="grid gap-2 text-sm text-stone-700">
        Email
        <input
          autoComplete="username"
          className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-base text-stone-900 outline-none transition focus:border-amber-700"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email quản trị"
          required
          type="email"
          value={email}
        />
      </label>

      <label className="grid gap-2 text-sm text-stone-700">
        Mật khẩu
        <input
          autoComplete="current-password"
          className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-base text-stone-900 outline-none transition focus:border-amber-700"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Mật khẩu"
          required
          type="password"
          value={password}
        />
      </label>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <button
        className="rounded-2xl bg-stone-950 px-4 py-3 text-base font-medium text-stone-50 transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-stone-400"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "Đang kiểm tra..." : "Đăng nhập"}
      </button>
    </form>
  );
}
