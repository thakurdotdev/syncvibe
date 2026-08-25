import { User } from "@/types/user"
import useApi from "@/utils/hooks/useApi"
import { signOutGoogle } from "@/lib/googleAuth"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { router } from "expo-router"
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"

interface UserContextType {
  user: User | null
  setUser: React.Dispatch<React.SetStateAction<User | null>>
  selectedLanguages: string
  setSelectedLanguages: React.Dispatch<React.SetStateAction<string>>
  getProfile: () => Promise<void>
  loading: boolean
  musicConfig: Record<string, any>
  setMusicConfig: React.Dispatch<React.SetStateAction<Record<string, any>>>
  logout: () => Promise<void>
  updateUser: (userData: Partial<User>) => Promise<void>
}

const UserContext = createContext<UserContextType | null>(null)

export const useUser = () => {
  const context = useContext(UserContext)
  if (!context) {
    throw new Error("useUser must be used within a UserProvider")
  }
  return context
}

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const api = useApi()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [musicConfig, setMusicConfig] = useState<Record<string, any>>({})
  const [selectedLanguages, setSelectedLanguages] = useState<string>("hindi")

  const getProfile = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token")
      if (!token) {
        setLoading(false)
        return
      }

      const cachedProfile = await AsyncStorage.getItem("@user_profile")
      if (cachedProfile) {
        setUser(JSON.parse(cachedProfile))
        setLoading(false)
      }

      const response = await api.get("/api/profile")
      if (response.status === 200) {
        const freshUser = response.data.user
        setUser(freshUser)
        await AsyncStorage.setItem("@user_profile", JSON.stringify(freshUser))
      }
    } catch (error: any) {
      console.error("Error fetching profile:", error)
      if (error.response?.status === 401) {
        await AsyncStorage.multiRemove(["token", "@user_profile"])
      }
    } finally {
      setLoading(false)
    }
  }, [api])

  const loadMusicConfig = useCallback(async () => {
    try {
      const data = await AsyncStorage.getItem("language-preferance")
      if (data) {
        setSelectedLanguages(data)
      }
    } catch (error) {
      console.error("Error loading music config:", error)
    }
  }, [])

  useEffect(() => {
    getProfile()
    loadMusicConfig()
  }, [getProfile, loadMusicConfig])

  const logout = useCallback(async () => {
    try {
      await Promise.allSettled([
        AsyncStorage.clear(),
        signOutGoogle(),
      ])
      setUser(null)
      router.reload()
    } catch (error) {
      setUser(null)
      router.reload()
    }
  }, [])

  const updateUser = useCallback(
    async (userData: Partial<User>) => {
      try {
        const response = await api.post("/api/update-profile", userData)
        if (response.status === 200) {
          const updated = response.data.user
          setUser(updated)
          await AsyncStorage.setItem("@user_profile", JSON.stringify(updated))
        }
      } catch (error) {
        console.error("Error updating profile:", error)
        throw error
      }
    },
    [api],
  )

  const memoizedValue = useMemo(
    () => ({
      user,
      setUser,
      getProfile,
      loading,
      musicConfig,
      setMusicConfig,
      logout,
      selectedLanguages,
      setSelectedLanguages,
      updateUser,
    }),
    [user, loading, musicConfig, logout, selectedLanguages, updateUser],
  )

  return <UserContext.Provider value={memoizedValue}>{children}</UserContext.Provider>
}
