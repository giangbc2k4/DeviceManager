import ReportView from "../report-view";

type ReportByChatIdPageProps = {
  params: Promise<{
    chatId: string;
  }>;
};

export default async function ReportByChatIdPage({ params }: ReportByChatIdPageProps) {
  const resolved = await params;
  return <ReportView chatId={resolved.chatId || ""} />;
}