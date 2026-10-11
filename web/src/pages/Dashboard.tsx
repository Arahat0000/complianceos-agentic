"use client"

import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { DataTable } from "@/components/data-table"
import { SectionCards } from "@/components/section-cards"
import { useAuth } from "@/contexts/AuthContext"
import { fetchControls, type BackendControl } from "@/lib/controls"
import { DEMO_CONTROLS } from "@/demo/complianceScenario"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowUpRight } from "lucide-react"

interface ControlItem {
  id: string
  title: string
  source: string
  relevance: string
  category: string
  description: string
  circularId?: string
  framework?: string
  status?: string
  questionText?: string
}

const titleCase = (v: string) => v.charAt(0).toUpperCase() + v.slice(1).toLowerCase()

const mapBackendControl = (c: BackendControl): ControlItem => {
  return {
    id: c.id,
    title: c.title,
    source: c.source.toLowerCase(),
    relevance: c.relevance ? titleCase(c.relevance) : "Unspecified",
    category: c.category ?? "Uncategorized",
    description: c.description ?? "",
    circularId: c.circularId,
    framework: c.framework ?? "RBI/MD/nbfc/211",
    status: c.status === "COMPLIANCE_GAP" ? "Compliance Gap" : "Active",
    questionText: c.description ?? undefined,
  }
}

export default function Dashboard() {
  const { isDemo } = useAuth()
  const navigate = useNavigate()
  const [controls, setControls] = useState<ControlItem[]>(isDemo ? DEMO_CONTROLS.map(mapBackendControl) : [])

  useEffect(() => {
    if (isDemo) return
    let cancelled = false
    fetchControls()
      .then((data) => {
        if (!cancelled) setControls(data.map(mapBackendControl))
      })
      .catch(() => {
        // SectionCards already surfaces a load-failure banner for this
        // session; the table just stays empty rather than duplicating it.
      })
    return () => {
      cancelled = true
    }
  }, [isDemo])

  return (
    <div className="@container/main flex flex-1 flex-col gap-2 overflow-auto">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <SectionCards />
        <div className="px-4 lg:px-6">
          <ChartAreaInteractive />
        </div>
        <div className="px-4 lg:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-foreground tracking-tight">Internal Controls Registry</h2>
              <Badge variant="outline" className="font-mono text-[10px] bg-primary/5 text-primary border-primary/20">
                All Master Directions & Standards
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Continuous monitoring across RBI Master Directions, SEBI Master Circulars, and ISO Standards.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/controls")}
            className="h-8 text-xs gap-1.5 shrink-0 self-start sm:self-auto cursor-pointer shadow-xs hover:border-primary/40"
          >
            <span>Open Control Library</span>
            <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </div>
        <DataTable data={controls} />
      </div>
    </div>
  )
}
