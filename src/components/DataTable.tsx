import React from "react";
import { useTranslation } from "react-i18next";
import { Grid, _ } from "gridjs-react";
import "gridjs/dist/theme/mermaid.css";

interface ColumnDef {
  header: string;
  field?: string;
  cellRenderer?: (row: any) => React.ReactNode;
  width?: string;
}

interface DataTableProps<T extends object> {
  columns: ColumnDef[];
  data: T[];
  height?: number;
  rowHeight?: number;
  loading?: boolean;
  emptyText?: string;
  className?: string;
  searchPlaceholder?: string;
  preservePagination?: boolean;
}

function DataTableInner<T extends object>({
  columns,
  data,
  height = 520,
  loading,
  emptyText,
  className,
  searchPlaceholder,
  preservePagination = false,
}: DataTableProps<T>) {
  const { t } = useTranslation();
  const rawColName = "__raw__";
  const resolvedEmptyText = emptyText || t("dataTable.empty");
  const resolvedSearchPlaceholder =
    searchPlaceholder || t("dataTable.searchPlaceholder");

  const gridColumns = React.useMemo(
    () => [
      ...columns.map((column) => ({
        name: column.header,
        width: column.width,
        formatter: column.cellRenderer
          ? (_cell: any, row: any) => {
              const cellsArray = row?.cells?.map((item: any) => item.data) || [];
              const raw = cellsArray[cellsArray.length - 1];
              const payload: any = cellsArray;
              payload.data = raw;
              return _(column.cellRenderer(payload));
            }
          : undefined,
      })),
      { name: rawColName, hidden: true } as any,
    ],
    [columns]
  );

  const gridData = React.useMemo(
    () =>
      data.map((row: any) => [
        ...columns.map((column) => (column.field ? row[column.field] : row)),
        row,
      ]),
    [data, columns]
  );

  return (
    <div className={className} style={{ height, position: "relative" as const }}>
      <Grid
        key={preservePagination ? "preserved-table" : undefined}
        data={gridData}
        columns={gridColumns}
        search={true}
        pagination={{ limit: 10 }}
        language={{
          noRecordsFound: resolvedEmptyText,
          search: { placeholder: resolvedSearchPlaceholder },
        }}
      />
      {loading && (
        <div className="absolute inset-0 bg-white/60 flex items-center justify-center gap-3 text-gray-500">
          <div className="h-5 w-5 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
          <span>{t("dataTable.loading")}</span>
        </div>
      )}
    </div>
  );
}

function areEqual(prevProps: any, nextProps: any) {
  if (prevProps.loading !== nextProps.loading) return false;
  if (prevProps.height !== nextProps.height) return false;
  if (prevProps.className !== nextProps.className) return false;
  if (prevProps.searchPlaceholder !== nextProps.searchPlaceholder) return false;
  if (prevProps.preservePagination !== nextProps.preservePagination) return false;
  if (prevProps.data !== nextProps.data) return false;

  const prevLen = Array.isArray(prevProps.data) ? prevProps.data.length : 0;
  const nextLen = Array.isArray(nextProps.data) ? nextProps.data.length : 0;
  if (prevLen !== nextLen) return false;
  if (prevProps.columns !== nextProps.columns) return false;

  return true;
}

const DataTable = React.memo(DataTableInner as any, areEqual) as typeof DataTableInner;

export default DataTable;
