import axios from "axios"

export const profileKeys = {
  all: ["profile"],
  current: () => [...profileKeys.all, "current"],
}

export const fetchProfile = async () => {
  const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/profile`, {
    withCredentials: true,
  })
  return response.data.user
}
