import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { RunReportView } from '../components/RunReportView'
import { getSharedReport, type RunReport } from '../lib/auth'

export const Route=createFileRoute('/reports/$token')({component:SharedRunReport})
function SharedRunReport(){const {token}=Route.useParams(),[report,setReport]=useState<RunReport>(),[error,setError]=useState('');useEffect(()=>{getSharedReport(token).then(setReport).catch(()=>setError('This report link is invalid or private.'))},[token]);if(error)return <main className="flex min-h-screen items-center justify-center bg-[#F3F5FA] text-sm text-[#545C8C]">{error}</main>;if(!report)return <main className="flex min-h-screen items-center justify-center bg-[#F3F5FA] text-sm text-[#545C8C]">Loading shared proof…</main>;return <RunReportView report={report} shareToken={token}/>}
