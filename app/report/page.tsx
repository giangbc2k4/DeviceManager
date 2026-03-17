import { getDefaultReportDate } from "@/lib/google-sheets";
import ReportView from "./report-view";

type ReportPageProps = {
  searchParams?: Promise<{
    chatId?: string;
    date?: string;
  }>;
};

export default async function ReportPage({ searchParams }: ReportPageProps) {
  const resolved = searchParams ? await searchParams : undefined;
  const chatId = (resolved?.chatId || "").trim();
  const reportDate = (resolved?.date || "").trim() || getDefaultReportDate();
  return <ReportView chatId={chatId} reportDate={reportDate} />;
}
