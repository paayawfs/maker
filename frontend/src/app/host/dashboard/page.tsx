import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import HostDashboardClient from './DashboardClient'

export default async function HostDashboardPage() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/host/login')
    }

    return <HostDashboardClient user={user} />
}
