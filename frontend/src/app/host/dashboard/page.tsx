import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import HostDashboardClient from './DashboardClient'

export default async function HostDashboardPage() {
    const supabase = await createClient()

    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
        redirect('/host/login')
    }

    return <HostDashboardClient user={session.user} session={session} />
}
