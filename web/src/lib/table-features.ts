import {
  columnFacetingFeature,
  columnFilteringFeature,
  columnVisibilityFeature,
  createFacetedRowModel,
  createFacetedUniqueValues,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFns,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFns,
  tableFeatures,
  type ColumnDef,
  type RowData,
} from "@tanstack/react-table"

/**
 * Single place where TanStack Table v9 features and row models are registered.
 * Prerequisite features must be declared before the row-model slots that use them.
 */
export const appTableFeatures = tableFeatures({
  columnFilteringFeature,
  columnVisibilityFeature,
  columnFacetingFeature,
  rowSortingFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  filterFns,
  sortFns,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  facetedRowModel: createFacetedRowModel(),
  facetedUniqueValues: createFacetedUniqueValues(),
})

export type AppTableFeatures = typeof appTableFeatures

/** Column definition bound to the app's registered table features. */
export type AppColumnDef<TData extends RowData, TValue = unknown> = ColumnDef<AppTableFeatures, TData, TValue>
