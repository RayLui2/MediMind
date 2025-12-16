import React, { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Fetch data from backend
    fetch('http://localhost:8000/test-db')
      .then((response) => response.json())
      .then((data) => {
        setData(data)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  return (
    <div className="App">
      <header className="App-header">
        <h1>MediMind - Connection Test</h1>

        {loading && <p>Loading...</p>}

        {error && (
          <div style={{ color: 'red' }}>
            <p>Error: {error}</p>
            <p>Make sure backend is running on http://localhost:8000</p>
          </div>
        )}

        {data && (
          <div>
            <h2>✅ Connection Successful!</h2>
            <p>Status: {data.status}</p>
            <h3>Data from PostgreSQL:</h3>
            <ul style={{ textAlign: 'left' }}>
              {data.data.map((item: any) => (
                <li key={item.id}>
                  ID: {item.id} - {item.message}
                </li>
              ))}
            </ul>
          </div>
        )}
      </header>
    </div>
  )
}

export default App
