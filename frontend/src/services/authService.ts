import axios from 'axios'

const API_URL = 'http://localhost:8000'

interface LoginRequest {
  email: string
  password: string
}

interface SignupRequest {
  email: string
  password: string
  name?: string
  age?: number
}

interface User {
  id: number
  email: string
  name: string | null
  age: number | null
  created_at: string
  setup_completed_at: string | null
}

interface TokenResponse {
  access_token: string
  token_type: string
}

class AuthService {
  // Signup
  async signup(data: SignupRequest): Promise<User> {
    const response = await axios.post(`${API_URL}/auth/signup`, data)
    return response.data
  }

  // Login
  async login(data: LoginRequest): Promise<TokenResponse> {
    const response = await axios.post(`${API_URL}/auth/login`, data)

    // Store token in localStorage
    if (response.data.access_token) {
      localStorage.setItem('token', response.data.access_token)
    }

    return response.data
  }

  // Logout
  logout(): void {
    localStorage.removeItem('token')
  }

  // Get current user
  async getCurrentUser(): Promise<User | null> {
    const token = localStorage.getItem('token')

    if (!token) {
      return null
    }

    try {
      const response = await axios.get(`${API_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      return response.data
    } catch (error) {
      // Token invalid or expired
      localStorage.removeItem('token')
      return null
    }
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return !!localStorage.getItem('token')
  }

  // Get token
  getToken(): string | null {
    return localStorage.getItem('token')
  }
}

const authServiceInstance = new AuthService()
export default authServiceInstance
