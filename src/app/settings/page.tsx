import { SidebarTrigger } from "@/components/ui/sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function SettingsPage() {
  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center gap-2 px-6 py-4 border-b shrink-0">
        <SidebarTrigger />
        <div>
          <h1 className="text-xl font-semibold">Settings</h1>
          <p className="text-sm text-muted-foreground">Panel configuration</p>
        </div>
      </header>
      <div className="flex-1 overflow-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>AAP Panel v1.0</CardTitle>
            <CardDescription>
              Running on port 3777 · Next.js 15 · shadcn/ui
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              To add new functionality, ask Claude to extend this panel.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
