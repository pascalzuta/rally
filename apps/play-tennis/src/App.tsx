import { useState } from 'react'
import Home from './components/Home'
import CreateTournament from './components/CreateTournament'
import TournamentView from './components/TournamentView'
import './styles.css'

type Screen =
  | { page: 'home' }
  | { page: 'create' }
  | { page: 'tournament'; id: string }

export default function App() {
  const [screen, setScreen] = useState<Screen>({ page: 'home' })

  return (
    <div className="app">
      {screen.page === 'home' && (
        <Home
          onCreate={() => setScreen({ page: 'create' })}
          onOpen={(id) => setScreen({ page: 'tournament', id })}
        />
      )}
      {screen.page === 'create' && (
        <CreateTournament
          onBack={() => setScreen({ page: 'home' })}
          onCreated={(id) => setScreen({ page: 'tournament', id })}
        />
      )}
      {screen.page === 'tournament' && (
        <TournamentView
          tournamentId={screen.id}
          onBack={() => setScreen({ page: 'home' })}
        />
      )}
    </div>
  )
}
