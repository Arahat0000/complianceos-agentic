import * as React from "react"
import {
  flexRender,
  useTable,
  type ColumnFiltersState,
  type ColumnVisibilityState,
  type SortingState,
  type RowSelectionState,
  type OnChangeFn,
  type Row,
} from "@tanstack/react-table"
import {
  appTableFeatures,
  type AppColumnDef,
  type AppTableFeatures,
} from "@/lib/table-features"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core"
import { restrictToVerticalAxis } from "@dnd-kit/modifiers"
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconLayoutColumns,
} from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface DataTableProps<TData extends { id: string | number }> {
  columns: AppColumnDef<TData>[]
  data: TData[]
  tabs?: {
    value: string
    label: string
    badge?: number
    badgeClassName?: string
  }[]
  defaultTab?: string
  actions?: React.ReactNode
  enableReordering?: boolean
  onReorder?: (data: TData[]) => void
  searchKey?: string
  searchPlaceholder?: string
  /** When provided, search is controlled by parent (e.g. to filter by date text). */
  searchValue?: string
  onSearchChange?: (value: string) => void
  /** Renders in the same row as the search input (e.g. date filters). */
  searchBarExtra?: React.ReactNode
  rowSelection?: RowSelectionState
  onRowSelectionChange?: OnChangeFn<RowSelectionState>
  onTabChange?: (value: string) => void
  onRowClick?: (data: TData) => void
}

function DraggableRow<TData extends { id: string | number }>({ 
  row, 
  reorderable 
}: { 
  row: Row<AppTableFeatures, TData>, 
  reorderable: boolean 
}) {
  const { transform, transition, setNodeRef, isDragging } = useSortable({
    id: row.id,
    disabled: !reorderable
  })

  const style = reorderable ? {
    transform: CSS.Transform.toString(transform),
    transition: transition,
  } : undefined

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      data-state={row.getIsSelected() && "selected"}
      data-dragging={isDragging}
      className={cn(
        "relative z-0",
        reorderable && "cursor-default",
        isDragging && "z-10 opacity-80"
      )}
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell key={cell.id}>
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  )
}

export function GenericDataTable<TData extends { id: string | number }>({
  columns,
  data: initialData,
  tabs,
  defaultTab,
  actions,
  enableReordering = false,
  onReorder,
  searchKey,
  searchPlaceholder = "Filter...",
  searchValue: controlledSearchValue,
  onSearchChange,
  searchBarExtra,
  rowSelection: externalRowSelection,
  onRowSelectionChange,
  onTabChange,
  onRowClick,
}: DataTableProps<TData>) {
  const [data, setData] = React.useState(initialData)
  const [internalRowSelection, setInternalRowSelection] = React.useState({})
  
  const rowSelection = externalRowSelection || internalRowSelection
  const setRowSelection = onRowSelectionChange || setInternalRowSelection
  const [columnVisibility, setColumnVisibility] = React.useState<ColumnVisibilityState>({})
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  })

  // Reset local (reorderable) copy when the incoming data changes.
  const [prevInitialData, setPrevInitialData] = React.useState(initialData)
  if (prevInitialData !== initialData) {
    setPrevInitialData(initialData)
    setData(initialData)
  }

  const sortableId = React.useId()
  const sensors = useSensors(
    useSensor(MouseSensor),
    useSensor(TouchSensor),
    useSensor(KeyboardSensor)
  )

  const dataIds = React.useMemo<UniqueIdentifier[]>(
    () => data.map((item) => item.id as UniqueIdentifier),
    [data]
  )

  const table = useTable({
    features: appTableFeatures,
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      pagination,
    },
    getRowId: (row) => row.id.toString(),
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
  })

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (active && over && active.id !== over.id) {
      const oldIndex = dataIds.indexOf(active.id)
      const newIndex = dataIds.indexOf(over.id)
      const newData = arrayMove(data, oldIndex, newIndex)
      setData(newData)
      onReorder?.(newData)
    }
  }

  const tableContent = (
    <div className="relative flex flex-col gap-4 min-w-0">
      <div className="overflow-x-auto rounded-lg border min-w-0">
        {enableReordering ? (
          <DndContext
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleDragEnd}
            sensors={sensors}
            id={sortableId}
          >
            <Table>
              <TableHeader className="bg-background sticky top-0 z-10 transition-colors">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id} colSpan={header.colSpan}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                <SortableContext items={dataIds} strategy={verticalListSortingStrategy}>
                  {table.getRowModel().rows.map((row) => (
                    <DraggableRow key={row.id} row={row} reorderable={true} />
                  ))}
                </SortableContext>
              </TableBody>
            </Table>
          </DndContext>
        ) : (
          <Table>
            <TableHeader className="bg-background sticky top-0 z-10">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} colSpan={header.colSpan}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow 
                    key={row.id} 
                    data-state={row.getIsSelected() && "selected"}
                    className={cn("group", onRowClick && "cursor-pointer hover:bg-muted/50")}
                    onClick={() => onRowClick?.(row.original)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="flex items-center justify-between px-2">
        <div className="text-muted-foreground hidden flex-1 text-sm lg:flex">
          {table.getFilteredSelectedRowModel().rows.length} of{" "}
          {table.getFilteredRowModel().rows.length} row(s) selected.
        </div>
        <div className="flex w-full items-center gap-8 lg:w-fit">
          <div className="hidden items-center gap-2 lg:flex">
            <Label htmlFor="rows-per-page" className="text-sm font-medium">Rows per page</Label>
            <Select
              value={`${table.state.pagination.pageSize}`}
              onValueChange={(val) => table.setPageSize(Number(val))}
            >
              <SelectTrigger size="sm" className="w-20" id="rows-per-page">
                <SelectValue placeholder={table.state.pagination.pageSize} />
              </SelectTrigger>
              <SelectContent side="top">
                {[10, 20, 30, 40, 50].map((size) => (
                  <SelectItem key={size} value={`${size}`}>{size}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-center text-sm font-medium">
            Page {table.state.pagination.pageIndex + 1} of {table.getPageCount()}
          </div>
          <div className="flex items-center gap-2">
             <Button variant="outline" className="h-8 w-8 p-0" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
               <IconChevronLeft className="size-4" />
             </Button>
             <Button variant="outline" className="h-8 w-8 p-0" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
               <IconChevronRight className="size-4" />
             </Button>
          </div>
        </div>
      </div>
    </div>
  )

  const content = (
    <div className="flex flex-col gap-4">
      {tabs && (
        <TabsList className="h-auto w-fit hidden sm:flex justify-start overflow-x-auto rounded-lg bg-muted p-1 border border-border/50 gap-1">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="rounded-md gap-2 text-xs font-semibold py-1.5 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <span className="whitespace-nowrap">{tab.label}</span>
              {tab.badge !== undefined && (
                <Badge variant="secondary" className={cn("ml-1 flex h-5 min-w-5 px-2 items-center justify-center rounded-full bg-muted-foreground/10 text-[10px] font-bold p-0 border-none shrink-0", tab.badgeClassName)}>
                  {tab.badge}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      )}
      <div className="flex flex-col md:flex-row md:items-center justify-between px-0 gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 w-full md:flex-1 overflow-visible flex-wrap">
          {searchKey && (
            <Input
              placeholder={searchPlaceholder}
              value={
                controlledSearchValue !== undefined
                  ? controlledSearchValue
                  : ((table.getColumn(searchKey)?.getFilterValue() as string) ?? "")
              }
              onChange={(event) => {
                const v = event.target.value;
                if (onSearchChange) onSearchChange(v);
                else table.getColumn(searchKey)?.setFilterValue(v);
              }}
              className="h-9 w-full sm:w-[200px] lg:w-[250px] shrink-0"
            />
          )}
          {searchBarExtra}
        </div>
        <div className="flex items-center w-full md:w-auto gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <IconLayoutColumns className="size-4 mr-2" />
                Columns
                <IconChevronDown className="size-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {table
                .getAllColumns()
                .filter((col) => col.getCanHide())
                .map((col) => (
                  <DropdownMenuCheckboxItem
                    key={col.id}
                    className="capitalize"
                    checked={col.getIsVisible()}
                    onCheckedChange={(val) => col.toggleVisibility(!!val)}
                  >
                    {col.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {actions}
        </div>
      </div>

      {tabs ? (
        tabs.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="mt-0 focus-visible:outline-none">
            {tableContent}
          </TabsContent>
        ))
      ) : (
        <div className="px-0">{tableContent}</div>
      )}
    </div>
  )

  if (tabs) {
    return (
      <Tabs 
        defaultValue={defaultTab || tabs[0]?.value} 
        onValueChange={onTabChange}
        className="w-full"
      >
        {content}
      </Tabs>
    )
  }

  return content
}
