'use client';

import { useState, useEffect } from 'react';
import { getSession, clearSession } from '@/lib/store/auth-store';
import { SettingsSection } from './SettingsSection';
import { LogOut, Shield, Info } from 'lucide-react';

export function AccountSettings() {
  const [session, setSessionState] = useState<ReturnType<typeof getSession>>(null);
  const [hasAuth, setHasAuth] = useState(false);

  useEffect(() => {
    setSessionState(getSession());

    fetch('/api/auth')
      .then(res => res.json())
      .then(data => setHasAuth(data.hasAuth))
      .catch(() => {});
  }, []);

  const handleLogout = () => {
    clearSession();
    window.location.reload();
  };

  if (!hasAuth && !session) return null;

  return (
    <SettingsSection title="账户管理" description="查看当前登录用户信息和账户配置。">
      <div className="space-y-6">
        {/* Current User Info */}
        {session && (
          <div className="flex items-center justify-between p-4 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[var(--radius-2xl)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[var(--radius-full)] bg-[var(--accent-color)]/10 flex items-center justify-center text-[var(--accent-color)] font-bold text-lg border border-[var(--glass-border)]">
                {session.name.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--text-color)]">{session.name}</p>
                <div className="flex items-center gap-1.5">
                  <Shield size={12} className={session.role === 'admin' ? 'text-[var(--accent-color)]' : 'text-[var(--text-color-secondary)]'} />
                  <span className="text-xs text-[var(--text-color-secondary)]">
                    {session.role === 'admin' ? '管理员' : '观众'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[var(--radius-full)] text-[var(--text-color-secondary)] hover:text-red-500 hover:border-red-500/30 transition-all duration-200 cursor-pointer"
              >
                <LogOut size={14} />
                退出登录
              </button>
            </div>
          </div>
        )}

        {/* Config Notice */}
        <div className="flex items-start gap-3 p-4 bg-[color-mix(in_srgb,var(--accent-color)_5%,transparent)] border border-[var(--glass-border)] rounded-[var(--radius-2xl)]">
          <Info className="text-[var(--text-color-secondary)] shrink-0 mt-0.5" size={16} />
          <div className="space-y-1">
            <p className="text-xs text-[var(--text-color-secondary)]">
              账户通过环境变量配置：
            </p>
            <div className="text-xs text-[var(--text-color-secondary)] space-y-0.5">
              <p><code className="px-1 py-0.5 bg-[var(--glass-bg)] rounded text-[10px]">ADMIN_PASSWORD</code> — 单管理员密码</p>
              <p><code className="px-1 py-0.5 bg-[var(--glass-bg)] rounded text-[10px]">ACCOUNTS</code> — 多账户（密码:名称[:角色]）</p>
            </div>
          </div>
        </div>
      </div>
    </SettingsSection>
  );
}
