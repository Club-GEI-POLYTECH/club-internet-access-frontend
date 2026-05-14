'use client'

import PrivateRoute from '@/components/PrivateRoute'
import Layout from '@/components/Layout'
import UserManagement from '@/components/UserManagement'
import { UserRole } from '@/types/api'

export default function AdminUsersPage() {
  return (
    <PrivateRoute allowedRoles={[UserRole.ADMIN]}>
      <Layout>
        <UserManagement />
      </Layout>
    </PrivateRoute>
  )
}
