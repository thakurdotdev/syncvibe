import { useQueryClient } from "@tanstack/react-query"
import { createContext, useContext, useEffect, useMemo, useState } from "react"
import { profileKeys } from "@/api/auth/profile"
import { useProfileQuery } from "@/hooks/queries/useProfileQuery"

export const Context = createContext()

export const useProfile = () => useContext(Context)

export const ContextProvider = ({ children }) => {
  const queryClient = useQueryClient()
  const { data: user, isLoading: loading, refetch } = useProfileQuery()
  const [musicConfig, setMusicConfig] = useState({})

  useEffect(() => {
    const dataFromStorage = localStorage.getItem("musicConfig")
    if (dataFromStorage) {
      setMusicConfig(JSON.parse(dataFromStorage))
    }
  }, [])

  const setUser = (newUser) => {
    queryClient.setQueryData(profileKeys.current(), newUser)
  }

  const getProfile = () => {
    refetch()
  }

  const memoizedValue = useMemo(
    () => ({
      user,
      setUser,
      getProfile,
      loading,
      musicConfig,
      setMusicConfig,
    }),
    [user, loading, musicConfig],
  )

  return <Context.Provider value={memoizedValue}>{children}</Context.Provider>
}
