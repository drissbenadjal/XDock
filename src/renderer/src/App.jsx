import Dock from './components/Dock'
import DockSettings from './components/DockSettings'

const query = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
const showSettings = query && query.get('dockSettings') === '1'

function App() {
  return <div className="app-root">{showSettings ? <DockSettings /> : <Dock />}</div>
}

export default App
