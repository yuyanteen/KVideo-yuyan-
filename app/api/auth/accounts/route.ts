/**
 * Accounts API Route
 * Returns account list (names + roles, no passwords) for admin visibility
 */

import { NextResponse } from 'next/server';

export const runtime = 'edge';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const ACCESS_PASSWORD = process.env.ACCESS_PASSWORD || '';
const ACCOUNTS = process.env.ACCOUNTS || '';

const effectiveAdminPassword = ADMIN_PASSWORD || ACCESS_PASSWORD;

interface AccountInfo {
  name: string;
  role: 'admin' | 'viewer';
}

function getAccountList(): AccountInfo[] {
  const accounts: AccountInfo[] = [];

  // Add admin from ADMIN_PASSWORD
  if (effectiveAdminPassword) {
    accounts.push({ name: '管理员', role: 'admin' });
  }

  // Add accounts from ACCOUNTS env var
  if (ACCOUNTS) {
    ACCOUNTS.split(',')
      .map(entry => entry.trim())
      .filter(entry => entry.length > 0)
      .forEach(entry => {
        const parts = entry.split(':');
        if (parts.length >= 2) {
          const name = parts[1].trim();
          const role = parts[2]?.trim() === 'admin' ? 'admin' : 'viewer';
          if (name) {
            accounts.push({ name, role });
          }
        }
      });
  }

  return accounts;
}

export async function GET() {
  const accounts = getAccountList();

  return NextResponse.json({
    accounts,
    hasAdminPassword: !!effectiveAdminPassword,
    hasAccounts: !!ACCOUNTS,
    totalCount: accounts.length,
  });
}
