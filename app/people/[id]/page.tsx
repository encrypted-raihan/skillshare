import { PublicProfilePage } from '@/components/public-profile-page'
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <PublicProfilePage profileId={id} />
}
