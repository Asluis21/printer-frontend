import type { PrintItem } from '../services/printerService'

export type EditorItem = Required<PrintItem> & {
    id: number
}

export interface HistoryEntry {
    id: number
    items: Required<PrintItem>[]
    copies: number
    ok: boolean
    time: string
}

export interface Box {
    x: number
    y: number
    width: number
    height: number
}

export type EditorSection = 'text' | 'grid' | 'copies'

export type ActiveEditorSection = EditorSection | null