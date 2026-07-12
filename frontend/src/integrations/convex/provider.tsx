import { ConvexProvider } from 'convex/react'
import { ConvexQueryClient } from '@convex-dev/react-query'

const convexUrl = (import.meta as ImportMeta & { env?: { VITE_CONVEX_URL?: string } }).env?.VITE_CONVEX_URL
const convexQueryClient = convexUrl ? new ConvexQueryClient(convexUrl) : null

export default function AppConvexProvider({ children }: { children: React.ReactNode }) {
  if (!convexQueryClient) return children
  return <ConvexProvider client={convexQueryClient.convexClient}>{children}</ConvexProvider>
}
