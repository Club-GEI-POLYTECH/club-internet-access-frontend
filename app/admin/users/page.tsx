'use client'

import PrivateRoute from '@/components/PrivateRoute'
import Layout from '@/components/Layout'
import UserManagement from '@/components/UserManagement'

export default function AdminUsersPage() {
  return (
    <PrivateRoute>
      <Layout>
        <UserManagement />
      </Layout>
    </PrivateRoute>
  )
}
