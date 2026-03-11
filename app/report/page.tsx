import ReportView from "./report-view";

type ReportPageProps = {
  searchParams?: Promise<{
    chatId?: string;
  }>;
};

export default async function ReportPage({ searchParams }: ReportPageProps) {
  const resolved = searchParams ? await searchParams : undefined;
  const chatId = (resolved?.chatId || "").trim();
  return <ReportView chatId={chatId} />;
}
