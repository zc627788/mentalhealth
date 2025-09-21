import React, { useEffect, useMemo, useRef, useState } from 'react'

interface VirtualListProps<T> {
	height: number
	itemHeight: number
	items: T[]
	overscan?: number
	renderItem: (item: T, index: number) => React.ReactNode
	className?: string
}

export default function VirtualList<T>({ height, itemHeight, items, overscan = 6, renderItem, className }: VirtualListProps<T>) {
	const containerRef = useRef<HTMLDivElement | null>(null)
	const [scrollTop, setScrollTop] = useState(0)
	const totalHeight = items.length * itemHeight

	useEffect(() => {
		const el = containerRef.current
		if (!el) return
		const onScroll = () => setScrollTop(el.scrollTop)
		el.addEventListener('scroll', onScroll, { passive: true })
		return () => el.removeEventListener('scroll', onScroll)
	}, [])

	const { start, end, offset } = useMemo(() => {
		const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
		const visibleCount = Math.ceil(height / itemHeight) + overscan * 2
		const endIndex = Math.min(items.length, startIndex + visibleCount)
		return { start: startIndex, end: endIndex, offset: startIndex * itemHeight }
	}, [scrollTop, height, itemHeight, items.length, overscan])

	return (
		<div ref={containerRef} style={{ height }} className={"overflow-auto " + (className || '')}>
			<div style={{ height: totalHeight, position: 'relative' }}>
				<div style={{ position: 'absolute', top: offset, left: 0, right: 0 }}>
					{items.slice(start, end).map((item, i) => (
						<div key={start + i} style={{ height: itemHeight }}>
							{renderItem(item, start + i)}
						</div>
					))}
				</div>
			</div>
		</div>
	)
}
