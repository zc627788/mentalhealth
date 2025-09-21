declare module 'gridjs-react' {
  import * as React from 'react'

  export const _: (node: React.ReactNode) => any

  export interface GridProps {
    data?: any[] | (() => Promise<any[]>)
    columns?: any[]
    pagination?: any
    search?: boolean | any
    language?: Record<string, any>
    className?: string
  }

  export class Grid extends React.Component<GridProps> {}
}


