import { KeitaroOfferPage } from "@/components/keitaro-offer-page"

export default async function OfferPage({
  params,
  searchParams,
}: {
  params: Promise<{ name: string }>
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const { name } = await params
  const { from, to } = await searchParams
  return (
    <KeitaroOfferPage
      name={decodeURIComponent(name)}
      from={from}
      to={to}
    />
  )
}
