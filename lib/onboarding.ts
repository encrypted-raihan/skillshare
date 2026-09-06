export const ONBOARDING_DRAFT_KEY = 'skillswap:onboarding-draft:v1'
export const ONBOARDING_SECRET_KEY = 'skillswap:onboarding-password:v1'
export const ONBOARDING_PENDING_AVATAR_KEY = 'skillswap:onboarding-avatar:v1'

export type OnboardingDraft = {
  accountEmail: string
  fullName: string
  phoneNumber: string
  dateOfBirth: string
  bio: string
  offeredSkills: string[]
}

export const emptyOnboardingDraft: OnboardingDraft = {
  accountEmail: '',
  fullName: '',
  phoneNumber: '',
  dateOfBirth: '',
  bio: '',
  offeredSkills: [],
}

export function readDraft(): OnboardingDraft {
  if (typeof window === 'undefined') return emptyOnboardingDraft
  try {
    const raw = window.sessionStorage.getItem(ONBOARDING_DRAFT_KEY)
    if (!raw) return emptyOnboardingDraft
    const parsed = JSON.parse(raw) as Partial<OnboardingDraft>
    return {
      accountEmail: typeof parsed.accountEmail === 'string' ? parsed.accountEmail : '',
      fullName: typeof parsed.fullName === 'string' ? parsed.fullName : '',
      phoneNumber: typeof parsed.phoneNumber === 'string' ? parsed.phoneNumber : '',
      dateOfBirth: typeof parsed.dateOfBirth === 'string' ? parsed.dateOfBirth : '',
      bio: typeof parsed.bio === 'string' ? parsed.bio : '',
      offeredSkills: Array.isArray(parsed.offeredSkills)
        ? parsed.offeredSkills.filter((v): v is string => typeof v === 'string')
        : [],
    }
  } catch {
    return emptyOnboardingDraft
  }
}

export function writeDraft(draft: OnboardingDraft) {
  window.sessionStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify(draft))
}

export function readTemporaryPassword() {
  if (typeof window === 'undefined') return ''
  return window.sessionStorage.getItem(ONBOARDING_SECRET_KEY) ?? ''
}

export function writeTemporaryPassword(password: string) {
  window.sessionStorage.setItem(ONBOARDING_SECRET_KEY, password)
}

export function readPendingAvatar() {
  if (typeof window === 'undefined') return ''
  return window.sessionStorage.getItem(ONBOARDING_PENDING_AVATAR_KEY) ?? ''
}

export function writePendingAvatar(dataUrl: string) {
  if (typeof window === 'undefined') return
  if (!dataUrl) {
    window.sessionStorage.removeItem(ONBOARDING_PENDING_AVATAR_KEY)
    return
  }
  window.sessionStorage.setItem(ONBOARDING_PENDING_AVATAR_KEY, dataUrl)
}

export function clearPendingAvatar() {
  if (typeof window === 'undefined') return
  window.sessionStorage.removeItem(ONBOARDING_PENDING_AVATAR_KEY)
}

export function clearOnboardingStorage() {
  if (typeof window === 'undefined') return
  window.sessionStorage.removeItem(ONBOARDING_DRAFT_KEY)
  window.sessionStorage.removeItem(ONBOARDING_SECRET_KEY)
  window.sessionStorage.removeItem(ONBOARDING_PENDING_AVATAR_KEY)
}

// Backwards-compatible alias used by older onboarding screens.
export function clearAllOnboardingStorage() {
  clearOnboardingStorage()
}
