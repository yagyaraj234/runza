import { useCallback, useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { RunReportView } from '../components/RunReportView'
import { getRunReport, type RunReport } from '../lib/auth'

export const Route=createFileRoute('/dashboard/runs/$runId')({component:PrivateRunReport})
function PrivateRunReport(){const {runId}=Route.useParams(),navigate=useNavigate(),[report,setReport]=useState<RunReport>(),[error,setError]=useState('');const load=useCallback(()=>getRunReport(runId).then(setReport).catch(()=>setError('Report not found or you do not have access.')),[runId]);useEffect(()=>{load()},[load]);if(error)return <Message text={error} action={()=>navigate({to:'/dashboard'})}/>;if(!report)return <Message text="Loading run proof…"/>;return <RunReportView report={report} onRefresh={load}/>}
function Message({text,action}:{text:string;action?:()=>void}){return <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F3F5FA] text-sm text-[#545C8C]"><p>{text}</p>{action&&<button onClick={action} className="rounded-full bg-[#131B4D] px-5 py-2 text-xs font-semibold text-white">Back to dashboard</button>}</main>}
