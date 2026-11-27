import axios from "axios";

export const client = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    timeout:5000,
    headers: {'Content-type':'application/json'},
})

client.interceptors.response.use(
    (response) => response,
    (error) => {
        return Promise.reject(error)
    },
)