import React from 'react'
import { Grid, _ } from 'gridjs-react'
import 'gridjs/dist/theme/mermaid.css'

interface ColumnDef {
	header: string
	field?: string
	cellRenderer?: (row: any) => React.ReactNode
	width?: string
}

interface DataTableProps<T extends object> {
	columns: ColumnDef[]
	data: T[]
	height?: number
	rowHeight?: number
	loading?: boolean
	emptyText?: string
	className?: string
	searchPlaceholder?: string
	preservePagination?: boolean  // 新增：是否保持分页状态
}

function DataTableInner<T extends object>({ columns, data, height = 520, loading, emptyText = '暂无数据', className, searchPlaceholder = '请输入关键词搜索…', preservePagination = false }: DataTableProps<T>) {
    // 为了在 formatter 中拿到整行原始对象，追加一个隐藏列存放 rawRow
    const rawColName = '__raw__'

    const gridColumns = React.useMemo(() => ([
        ...columns.map((c) => ({
            // 使用 name 作为表头展示文本
            name: c.header,
            width: c.width,
            formatter: c.cellRenderer
                ? (cell: any, row: any) => {
                    const cellsArray = row?.cells?.map((x: any) => x.data) || []
                    const raw = cellsArray[cellsArray.length - 1]
                    const payload: any = cellsArray
                    payload.data = raw
                    return _(c.cellRenderer!(payload))
                }
                : undefined,
        })),
        // 追加隐藏列，供 formatter 读取原始行对象
        { name: rawColName, hidden: true } as any,
    ]), [columns])

    const gridData = React.useMemo(() => data.map((row: any) => [
        ...columns.map((c) => (c.field ? row[c.field] : row)),
        row,
    ]), [data, columns])

	return (
		<div className={className} style={{ height, position: 'relative' as const }}>
			<Grid
				key={preservePagination ? "preserved-table" : undefined}
				data={gridData}
				columns={gridColumns}
				search={true}
				pagination={{ limit: 10 }}
				language={{ 'noRecordsFound': emptyText, search: { placeholder: searchPlaceholder } }}
			/>
			{loading && (
				<div className="absolute inset-0 bg-white/60 flex items-center justify-center gap-3 text-gray-500">
					<div className="h-5 w-5 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"/>
					<span>加载中，请稍候…</span>
				</div>
			)}
		</div>
	)
}

// 自定义比较：当 columns 的引用没变、data 长度没变时不重渲染（分页状态将被 gridjs 自管）
function areEqual(prevProps: any, nextProps: any) {
    if (prevProps.loading !== nextProps.loading) return false
    if (prevProps.height !== nextProps.height) return false
    if (prevProps.className !== nextProps.className) return false
    if (prevProps.searchPlaceholder !== nextProps.searchPlaceholder) return false
    if (prevProps.preservePagination !== nextProps.preservePagination) return false
    // 若数据引用变化（服务端返回了新数组），需要刷新表格
    if (prevProps.data !== nextProps.data) return false
    // 避免频繁重渲：仅当数据条数变化时才认为需要重渲
    const prevLen = Array.isArray(prevProps.data) ? prevProps.data.length : 0
    const nextLen = Array.isArray(nextProps.data) ? nextProps.data.length : 0
    if (prevLen !== nextLen) return false
    // 列对象通常稳定，由父组件 useMemo 保证；这里按引用比较
    if (prevProps.columns !== nextProps.columns) return false
    return true
}

const DataTable = React.memo(DataTableInner as any, areEqual) as typeof DataTableInner

export default DataTable
