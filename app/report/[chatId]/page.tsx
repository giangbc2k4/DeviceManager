import { getDefaultReportDate } from "@/lib/google-sheets";
import ReportView from "../report-view";

type ReportByChatIdPageProps = {
  params: Promise<{
    chatId: string;
  }>;
  searchParams?: Promise<{
    date?: string;
  }>;
};

export default async function ReportByChatIdPage({ params, searchParams }: ReportByChatIdPageProps) {
  const resolved = await params;
  const resolvedSearch = searchParams ? await searchParams : undefined;
  const reportDate = (resolvedSearch?.date || "").trim() || getDefaultReportDate();
  return <ReportView chatId={resolved.chatId || ""} reportDate={reportDate} />;
}