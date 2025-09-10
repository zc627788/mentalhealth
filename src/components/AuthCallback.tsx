import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Get the hash fragment from the URL
        const hashFragment = window.location.hash

        if (hashFragment && hashFragment.length > 0) {
          // Exchange the auth code for a session
          const { data, error } = await supabase.auth.exchangeCodeForSession(hashFragment)

          if (error) {
            console.error('Error exchanging code for session:', error.message)
            navigate('/login?error=' + encodeURIComponent(error.message))
            return
          }

          if (data.session) {
            // Successfully signed in, redirect to app
            navigate('/dashboard')
            return
          }
        }

        // If we get here, something went wrong
        navigate('/login?error=No session found')
      } catch (error) {
        console.error('Auth callback error:', error)
        navigate('/login?error=Authentication failed')
      }
    }

    handleAuthCallback()
  }, [navigate])

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 to-indigo-200 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">正在验证...</h2>
          <p className="text-gray-600">请稍候，我们正在验证您的账户。</p>
        </div>
      </div>
    </div>
  )
}
