import { client } from "../api/client"

/** Label size in printer dots (203 dpi, 101.5 × 74.88 mm). */
export const LABEL_WIDTH = 811
export const LABEL_HEIGHT = 598
export const DOTS_PER_MM = 8

/** The backend accepts 1–50 texts per label. */
export const MAX_ITEMS = 50

/** Fonts the printer has. A wrong name silently falls back to the default, so only offer these. */
export const FONTS = [
    'Univers',
    'Univers Bold',
    'Univers Condensed Bold',
    'Univers Extra Condensed',
    'CG Times',
    'CG Times Bold',
    'Century Schoolbook Roman',
    'Dutch 801 Roman',
    'CG Triumvirate Condensed Bold',
    'Andale Mono',
    'Andale Mono Bold',
    'Monospace 821',
    'Monospace 821 Bold',
    'Letter Gothic',
    'OCR A',
    'OCR B',
] as const

/** One text on the label. (x, y) is its top-left corner, in dots from the label's top-left. */
export interface PrintItem {
    text: string
    /** dots, 0–810 */
    x: number
    /** dots, 0–597 */
    y: number
    /** 1 = 0°, 2 = 90°, 3 = 180°, 4 = 270°; defaults to 1 */
    dir?: number
    /** defaults to "Univers" */
    font?: string
    /** points, 4–200; defaults to 12 */
    fontSize?: number
}

/** One label: every item prints together, and `copies` repeats the whole label. */
export interface PrintJob {
    /** 1–99; defaults to 1 */
    copies?: number
    /** 1–50 */
    items: PrintItem[]
}

const endpointPrinter = '/printer';

/**
 * Resolves on 200 (empty body). Rejects on 400/503/500 with {"error": "..."};
 * position errors name the item number, counting from 1.
 */
export const print = async ({ copies, items }: PrintJob): Promise<void> => {
    await client.post(`${endpointPrinter}/print`, {
        copies: Number(copies) || 1,
        items: items.map((it) => ({
            text: it.text,
            x: Number(it.x),
            y: Number(it.y),
            dir: Number(it.dir) || 1,
            font: it.font || 'Univers',
            fontSize: Number(it.fontSize) || 12,
        })),
    });
};
