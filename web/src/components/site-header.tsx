
import { ModeToggle } from "@/components/mode-toggle"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { AlertCircle, Sparkles } from "lucide-react"
import { ReportIssueModal } from "@/components/report-issue-modal"
import { useAskAI } from "@/components/ask-ai-context"
import { cn } from "@/lib/utils"

export function SiteHeader() {
  const { isOpen, toggle } = useAskAI()

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <span className="text-sm font-medium text-muted-foreground">
          Compliance Management System
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggle}
            className={cn(
              "flex h-8 gap-1.5 text-xs font-medium px-2.5 rounded-lg transition-colors cursor-pointer",
              isOpen
                ? "bg-accent text-accent-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            )}
          >
            <Sparkles className="h-3.5 w-3.5 text-foreground" />
            Ask AI
          </Button>
          <ReportIssueModal>
            <Button
              variant="ghost"
              size="sm"
              className="flex h-8 gap-1.5 text-xs font-medium px-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 cursor-pointer"
            >
              <AlertCircle className="h-3.5 w-3.5" />
              Support
            </Button>
          </ReportIssueModal>
          <ModeToggle />
        </div>
      </div>
    </header>
  )
}
