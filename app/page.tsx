import { redirect } from "next/navigation";

import { LoginForm } from "@/app/login-form";
import { isAuthenticated } from "@/lib/auth";

type HomeProps = {
  searchParams?: Promise<{
    loggedOut?: string;
  }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const authenticated = await isAuthenticated();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const loggedOut = resolvedSearchParams?.loggedOut === "1";

  if (authenticated) {
    redirect("/admin");
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(160deg,#efe7d7_0%,#d9cfbe_45%,#8b7759_100%)] px-6 py-10 text-stone-950">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="flex flex-col justify-center rounded-[36px] border border-white/30 bg-[linear-gradient(145deg,rgba(255,248,235,0.85),rgba(255,255,255,0.45))] p-8 shadow-[0_30px_120px_rgba(52,37,9,0.18)] backdrop-blur lg:p-12">
          <div>
            <p className="text-xs uppercase tracking-[0.45em] text-amber-800">Device Manager</p>
            <h1 className="mt-5 max-w-xl text-5xl font-semibold leading-tight text-stone-950">
              Trang đăng nhập quản trị thiết bị.
            </h1>
            <p className="mt-6 max-w-lg text-base leading-8 text-stone-700">
              Đăng nhập để truy cập khu vực điều hành hệ thống, quản lý trạng thái thiết bị và thao tác khóa hoặc mở khóa khi cần.
            </p>
          </div>
        </section>

        <section className="flex items-center">
          <div className="w-full rounded-[32px] bg-white p-8 shadow-[0_25px_90px_rgba(20,15,5,0.2)] lg:p-10">
            <p className="text-sm uppercase tracking-[0.35em] text-stone-500">Device Manager</p>
            <h2 className="mt-3 text-3xl font-semibold text-stone-950">Đăng nhập để vào bảng điều khiển</h2>
            <p className="mt-3 text-sm leading-7 text-stone-600">
              Nhập tài khoản quản trị để tiếp tục. 
              
            </p>
            {loggedOut ? (
              <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
                Đã đăng xuất. Vui lòng đăng nhập lại để tiếp tục.
              </div>
            ) : null}
            <div className="mt-8">
              <LoginForm />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
