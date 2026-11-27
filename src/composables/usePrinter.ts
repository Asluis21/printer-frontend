import { ref } from "vue";
import axios from "axios";
import { print, type PrintJob } from "../services/printerService";

/** Backend errors come as {"error": "..."}; anything else means we never reached it. */
const errorMessage = (e: unknown): string => {
    if (axios.isAxiosError(e)) {
        const backendError = (e.response?.data as { error?: string } | undefined)?.error
        if (backendError) return backendError
    }
    return 'Could not reach the print server'
}

export function usePrinter(){

    const loading   = ref(false);
    const error     = ref<string | null> (null)

    /** Returns true if the job reached the printer. */
    const sendJob = async (job: PrintJob): Promise<boolean> => {
        loading.value = true;
        error.value = null

        try {
            await print(job)
            return true
        } catch (e) {
            error.value = errorMessage(e)
            return false
        } finally {
            loading.value = false
        }
    };

    return {loading, error, sendJob}
}
