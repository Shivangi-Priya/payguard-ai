import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Sidebar } from './components/Sidebar'
import { Overview } from './pages/Overview'
import { Transactions } from './pages/Transactions'
import { TransactionDetail } from './pages/TransactionDetail'
import { Analytics } from './pages/Analytics'
import { Merchants } from './pages/Merchants'
import { MerchantDetail } from './pages/MerchantDetail'
import { Agents } from './pages/Agents'
import { AgentDetail } from './pages/AgentDetail'
import { Alerts } from './pages/Alerts'
import { AttackSimulator } from './pages/AttackSimulator'

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-6 py-7">
            <Routes>
              <Route path="/" element={<Overview />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/transactions/:id" element={<TransactionDetail />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/merchants" element={<Merchants />} />
              <Route path="/merchants/:id" element={<MerchantDetail />} />
              <Route path="/agents" element={<Agents />} />
              <Route path="/agents/:id" element={<AgentDetail />} />
              <Route path="/alerts" element={<Alerts />} />
              <Route path="/simulator" element={<AttackSimulator />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>
      </div>
    </BrowserRouter>
  )
}
