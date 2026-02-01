import axios from "axios"

const API_URL = import.meta.env.VITE_API_URL

export const paymentKeys = {
  all: ["payment"],
  order: () => [...paymentKeys.all, "order"],
  entitlement: () => [...paymentKeys.all, "entitlement"],
  plans: () => [...paymentKeys.all, "plans"],
  history: () => [...paymentKeys.all, "history"],
}

export const createPaymentOrder = async () => {
  const { data } = await axios.post(`${API_URL}/api/payments/create`, {}, { withCredentials: true })
  return data
}

export const fetchEntitlement = async () => {
  const { data } = await axios.get(`${API_URL}/api/entitlement`, {
    withCredentials: true,
  })
  return data
}

export const fetchPlans = async () => {
  const { data } = await axios.get(`${API_URL}/api/plans`)
  return data
}

export const fetchPaymentHistory = async () => {
  const { data } = await axios.get(`${API_URL}/api/payments/history`, {
    withCredentials: true,
  })
  return data
}
