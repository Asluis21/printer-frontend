import { computed, reactive, ref } from 'vue'
import { usePrinter } from './usePrinter'
import {
    DOTS_PER_MM,
    LABEL_HEIGHT,
    LABEL_WIDTH,
    MAX_ITEMS,
    type PrintItem
} from '../services/printerService'

import type {
    EditorItem,
    HistoryEntry,
    Box
} from '../types/printer'

export function usePrintEditor() {
    const { loading, error, sendJob } = usePrinter()

    let nextId = 1

    const newItem = (over: Partial<PrintItem> = {}): EditorItem => ({
        id: nextId++,
        text: '',
        x: 20,
        y: 20,
        dir: 1,
        font: 'Univers',
        fontSize: 12,
        ...over
    })

    const firstItem = () => newItem({ x: 50, y: 200 })

    const items = ref<EditorItem[]>([firstItem()])
    const copies = ref(1)
    const selectedId = ref<number | null>(items.value[0]!.id)
    const sentOk = ref(false)

    const history = ref<HistoryEntry[]>([])
    const boxes = ref<Record<number, Box>>({})

    const selected = computed(() =>
        items.value.find(i => i.id === selectedId.value) ?? null
    )

    const selectedIndex = computed(() =>
        items.value.findIndex(i => i.id === selectedId.value)
    )

    const maxX = LABEL_WIDTH - 1
    const maxY = LABEL_HEIGHT - 1

    const label = {
        width: LABEL_WIDTH,
        height: LABEL_HEIGHT
    }

    const clamp = (value: number, min: number, max: number) =>
        Math.min(Math.max(value, min), max)

    const toMm = (dots: number) =>
        (dots / DOTS_PER_MM).toFixed(1)

    const ptToDots = (pt: number) =>
        (pt || 12) * (203 / 72)

    const dirDegrees = (dir: number) =>
        (dir - 1) * 90

    const toRequestItems = (list: EditorItem[]): Required<PrintItem>[] =>
        list.map(({ id: _id, ...rest }) => ({ ...rest }))

    const endpoint = `${import.meta.env.VITE_API_URL ?? ''}/printer/print`

    const payload = computed(() =>
        JSON.stringify({
            copies: copies.value,
            items: toRequestItems(items.value)
        }, null, 2)
    )

    const status = computed(() => {
        if (error.value) {
            return { kind: 'error', text: error.value }
        }

        if (sentOk.value) {
            return {
                kind: 'success',
                text: 'Sent to the printer.'
            }
        }

        return null
    })

    const addItem = () => {
        if (items.value.length >= MAX_ITEMS) return

        const base = selected.value ?? items.value.at(-1)

        const item = newItem({
            x: base?.x ?? 20,
            y: base
                ? clamp(
                    Math.round(base.y + ptToDots(base.fontSize) * 1.3),
                    0,
                    maxY
                )
                : 20,
            font: base?.font ?? 'Univers',
            fontSize: base?.fontSize ?? 12
        })

        items.value.push(item)
        selectedId.value = item.id
    }

    const removeItem = (id: number) => {
        if (items.value.length <= 1) return

        const index = items.value.findIndex(i => i.id === id)

        if (index < 0) return

        items.value.splice(index, 1)

        if (selectedId.value === id) {
            selectedId.value =
                items.value[Math.min(index, items.value.length - 1)]!.id
        }
    }

    const grid = reactive({
        cols: 2,
        rows: 2
    })

    const gridCount = computed(() =>
        Math.min(
            clamp(Math.round(grid.cols) || 1, 1, 10) *
            clamp(Math.round(grid.rows) || 1, 1, 10),
            MAX_ITEMS
        )
    )

    const fillGrid = () => {
        const cols = clamp(Math.round(grid.cols) || 1, 1, 10)
        const rows = clamp(Math.round(grid.rows) || 1, 1, 10)
        const style = selected.value ?? items.value[0]
        const pad = 20

        const next = Array.from({ length: gridCount.value }, (_, i) =>
            newItem({
                text: items.value[i]?.text ?? '',
                x: Math.round(((i % cols) * LABEL_WIDTH) / cols) + pad,
                y: Math.round((Math.floor(i / cols) * LABEL_HEIGHT) / rows) + pad,
                font: style?.font ?? 'Univers',
                fontSize: style?.fontSize ?? 12
            })
        )

        items.value = next
        selectedId.value = next[0]!.id
    }

    const overflows = (id: number) => {
        const box = boxes.value[id]

        if (!box) return false

        const slack = 0.5

        return (
            box.x < -slack ||
            box.y < -slack ||
            box.x + box.width > LABEL_WIDTH + slack ||
            box.y + box.height > LABEL_HEIGHT + slack
        )
    }

    const changeCopies = (delta: number) => {
        copies.value = clamp((copies.value || 1) + delta, 1, 99)
    }

    const reset = () => {
        items.value = [firstItem()]
        selectedId.value = items.value[0]!.id
        copies.value = 1
        sentOk.value = false
        error.value = null
    }

    const reuse = (entry: HistoryEntry) => {
        items.value = entry.items.map(i => newItem(i))
        copies.value = entry.copies
        selectedId.value = items.value[0]!.id
        sentOk.value = false
        error.value = null
    }

    const onSubmit = async () => {
        sentOk.value = false

        const sentItems = toRequestItems(items.value)
        const sentCopies = copies.value

        const ok = await sendJob({
            copies: sentCopies,
            items: sentItems
        })

        sentOk.value = ok

        history.value.unshift({
            id: Date.now(),
            items: sentItems,
            copies: sentCopies,
            ok,
            time: new Date().toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
            })
        })

        history.value = history.value.slice(0, 5)
    }

    return {
        items,
        copies,
        selectedId,
        selected,
        selectedIndex,
        history,
        boxes,
        loading,
        error,
        status,
        label,
        maxX,
        maxY,
        grid,
        gridCount,
        endpoint,
        payload,
        clamp,
        toMm,
        ptToDots,
        dirDegrees,
        addItem,
        removeItem,
        fillGrid,
        overflows,
        changeCopies,
        reset,
        reuse,
        onSubmit
    }

}

export type PrintEditor = ReturnType<typeof usePrintEditor>