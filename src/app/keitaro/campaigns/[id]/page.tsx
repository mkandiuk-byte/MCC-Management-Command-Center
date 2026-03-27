import { KeitaroCampaignPage } from "@/components/keitaro-campaign-page"

export default async function CampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const { id } = await params
  const { from, to } = await searchParams
  return (
    <KeitaroCampaignPage
      id={parseInt(id, 10)}
      from={from}
      to={to}
    />
  )
}
