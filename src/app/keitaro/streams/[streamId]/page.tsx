import { KeitaroStreamPage } from "@/components/keitaro-stream-page"

export default async function StreamPage({
  params,
  searchParams,
}: {
  params: Promise<{ streamId: string }>
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const { streamId } = await params
  const { from, to } = await searchParams
  return (
    <KeitaroStreamPage
      streamId={parseInt(streamId, 10)}
      from={from}
      to={to}
    />
  )
}
