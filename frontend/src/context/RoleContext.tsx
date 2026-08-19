import React, { createContext, useContext, useState, useEffect } from 'react'

export type Role = 'citizen' | 'officer' | 'admin' | null

export interface RoleProfile {
  role: Role
  name: string
  email: string
  department: string
}

interface RoleContextType {
  role: Role
  name: string
  email: string
  department: string
  setRoleProfile: (profile: Partial<RoleProfile> & { role: Role }) => void
  clearRole: () => void
}

const STORAGE_KEY = 'cci_role_profile'

const initialProfile: RoleProfile = {
  role: null,
  name: '',
  email: '',
  department: 'Electricity Board',
}

const RoleContext = createContext<RoleContextType | undefined>(undefined)

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<RoleProfile>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        return JSON.parse(saved)
      }
    } catch {
      // ignore
    }
    return initialProfile
  })

  useEffect(() => {
    try {
      if (profile.role) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
      } else {
        localStorage.removeItem(STORAGE_KEY)
      }
    } catch {
      // ignore
    }
  }, [profile])

  const setRoleProfile = (newProfile: Partial<RoleProfile> & { role: Role }) => {
    setProfile(prev => ({
      ...prev,
      ...newProfile,
      name: newProfile.name ?? prev.name,
      email: newProfile.email ?? prev.email,
      department: newProfile.department ?? prev.department,
    }))
  }

  const clearRole = () => {
    setProfile(initialProfile)
    localStorage.removeItem(STORAGE_KEY)
  }

  return (
    <RoleContext.Provider
      value={{
        role: profile.role,
        name: profile.name,
        email: profile.email,
        department: profile.department,
        setRoleProfile,
        clearRole,
      }}
    >
      {children}
    </RoleContext.Provider>
  )
}

export function useRole(): RoleContextType {
  const context = useContext(RoleContext)
  if (!context) {
    throw new Error('useRole must be used within a RoleProvider')
  }
  return context
}
