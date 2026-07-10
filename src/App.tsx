import { Toolbar } from './components/panels/Toolbar'
import { PropertiesPanel } from './components/panels/PropertiesPanel'
import { MaterialsPanel } from './components/panels/MaterialsPanel'
import { CutlistPanel } from './components/panels/CutlistPanel'
import { Viewport } from './components/viewport/Viewport'
import { ResizableSidebar } from './components/layout/ResizableSidebar'

export default function App() {
  return (
    <div className="app">
      <Toolbar />
      <main className="workspace">
        <div className="workspace__viewport">
          <Viewport />
        </div>
        <ResizableSidebar>
          <PropertiesPanel />
          <MaterialsPanel />
          <CutlistPanel />
        </ResizableSidebar>
      </main>
    </div>
  )
}
