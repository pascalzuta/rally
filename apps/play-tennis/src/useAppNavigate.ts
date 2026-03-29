import { useNavigate } from 'react-router-dom'
import { useCallback } from 'react'
import { ROUTES, RoutePath } from './routes'

/** App-level navigation hook wrapping React Router's useNavigate */
export function useAppNavigate() {
  const navigate = useNavigate()

  const go = useCallback((path: RoutePath) => {
    navigate(path)
  }, [navigate])

  return {
    navigate: go,
    goHome: useCallback(() => navigate(ROUTES.HOME), [navigate]),
    goBracket: useCallback(() => navigate(ROUTES.BRACKET), [navigate]),
    goPlayNow: useCallback(() => navigate(ROUTES.PLAYNOW), [navigate]),
    goProfile: useCallback(() => navigate(ROUTES.PROFILE), [navigate]),
    goLeaderboard: useCallback(() => navigate(ROUTES.LEADERBOARD), [navigate]),
    goHelp: useCallback(() => navigate(ROUTES.HELP), [navigate]),
  }
}
