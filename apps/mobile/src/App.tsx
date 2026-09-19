import React, { useEffect, useState } from 'react';
import { Pressable, StatusBar, View, Text, StyleSheet } from 'react-native';
import { OnboardingProvider, useOnboarding } from './onboarding/store';
import { AuthProvider, useAuth } from './auth';
import { GoalScreen } from './screens/GoalScreen';
import { GymScreen } from './screens/GymScreen';
import { LevelScreen } from './screens/LevelScreen';
import { PreviewScreen } from './screens/PreviewScreen';
import { RegisterScreen } from './screens/RegisterScreen';
import { MatchingScreen } from './screens/MatchingScreen';
import { RequestsScreen } from './screens/RequestsScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { ProfileEditScreen } from './screens/ProfileEditScreen';
import { ProfilePreviewScreen } from './screens/ProfilePreviewScreen';
import { MatchesScreen } from './screens/MatchesScreen';
import { ChatScreen } from './screens/ChatScreen';
import { ScheduleScreen } from './screens/ScheduleScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { WorkoutFormScreen } from './screens/WorkoutFormScreen';
import { GoalFormScreen } from './screens/GoalFormScreen';
import { RatingFormScreen } from './screens/RatingFormScreen';
import { authApi, type UserProfile, type MatchListItem } from './api';

/* ── Bottom tab bar ──────────────────────────────────────────────────────── */
type Tab = 'search' | 'matches' | 'requests' | 'profile';

function TabBar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const TABS: Array<{ key: Tab; label: string; icon: string }> = [
    { key: 'search', label: 'Пошук', icon: '🔍' },
    { key: 'matches', label: 'Матчі', icon: '💬' },
    { key: 'requests', label: 'Запити', icon: '✉️' },
    { key: 'profile', label: 'Профіль', icon: '👤' },
  ];
  return (
    <View style={tb.wrap}>
      {TABS.map((t) => (
        <Pressable key={t.key} style={tb.item} onPress={() => setTab(t.key)}>
          <Text style={[tb.icon, tab === t.key && tb.iconActive]}>{t.icon}</Text>
          <Text style={[tb.label, tab === t.key && tb.labelActive]}>{t.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/* ── Navigation stack ──────────────────────────────────────────────────── */
type MatchScreen =
  | { type: 'chat'; matchId: string; match: MatchListItem | null }
  | { type: 'schedule'; match: MatchListItem }
  | { type: 'dashboard'; match: MatchListItem }
  | { type: 'workout'; match: MatchListItem }
  | { type: 'goal'; match: MatchListItem }
  | { type: 'rating'; match: MatchListItem }
  | null;

function AuthenticatedShell() {
  const { token } = useAuth();
  const [tab, setTab] = useState<Tab>('search');
  const [view, setView] = useState<'main' | 'edit' | 'preview'>('main');
  const [screen, setScreen] = useState<MatchScreen>(null);

  // Navigate to a match sub-screen
  function navigate(s: MatchScreen) { setScreen(s); }

  // If a match sub-screen is active, render it
  if (screen) {
    switch (screen.type) {
      case 'chat':
        return (
          <ChatScreen
            matchId={screen.matchId}
            match={screen.match}
            onBack={() => setScreen(null)}
            onSchedulePress={(m) => navigate({ type: 'schedule', match: m })}
          />
        );
      case 'schedule':
        return (
          <ScheduleScreen
            match={screen.match}
            onBack={() => setScreen(null)}
          />
        );
      case 'dashboard':
        return (
          <DashboardScreen
            match={screen.match}
            onBack={() => setScreen(null)}
            onAddWorkout={(m) => navigate({ type: 'workout', match: m })}
            onCreateGoal={(m) => navigate({ type: 'goal', match: m })}
            onRate={(m) => navigate({ type: 'rating', match: m })}
          />
        );
      case 'workout':
        return (
          <WorkoutFormScreen
            match={screen.match}
            onBack={() => navigate({ type: 'dashboard', match: screen.match })}
            onDone={() => navigate({ type: 'dashboard', match: screen.match })}
          />
        );
      case 'goal':
        return (
          <GoalFormScreen
            match={screen.match}
            onBack={() => navigate({ type: 'dashboard', match: screen.match })}
            onDone={() => navigate({ type: 'dashboard', match: screen.match })}
          />
        );
      case 'rating':
        return (
          <RatingFormScreen
            match={screen.match}
            onBack={() => navigate({ type: 'dashboard', match: screen.match })}
            onDone={() => { setScreen(null); setTab('matches'); }}
          />
        );
    }
  }

  // Matches tab
  if (tab === 'matches') {
    return (
      <View style={{ flex: 1 }}>
        <MatchesScreen
          onOpenChat={(id, match) => navigate({ type: 'chat', matchId: id, match })}
          onDashboardPress={(match) => navigate({ type: 'dashboard', match })}
          onSchedulePress={(match) => navigate({ type: 'schedule', match })}
        />
        <TabBar tab={tab} setTab={setTab} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        {tab === 'search' && (
          <MatchingScreen onShowProfile={(id) => { /* TODO */ }} />
        )}
        {tab === 'requests' && <RequestsScreen />}
        {tab === 'profile' && view === 'main' && (
          <ProfileScreen
            onEdit={() => setView('edit')}
            onPreview={() => setView('preview')}
          />
        )}
        {tab === 'profile' && view === 'edit' && (
          <ProfileEditScreenWithNav onCancel={() => setView('main')} onSaved={() => setView('main')} />
        )}
        {tab === 'profile' && view === 'preview' && (
          <ProfilePreviewWithNav onBack={() => setView('main')} />
        )}
      </View>
      <TabBar tab={tab} setTab={setTab} />
    </View>
  );
}

/* ── Profile sub-screens ───────────────────────────────────────────────── */
function ProfileEditScreenWithNav({ onCancel, onSaved }: { onCancel: () => void; onSaved: () => void }) {
  const { token } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authApi(token!).getMe().then(setProfile).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  if (loading || !profile) return null;
  return <ProfileEditScreen initial={profile} onSaved={(p) => { setProfile(p); onSaved(); }} onCancel={onCancel} />;
}

function ProfilePreviewWithNav({ onBack }: { onBack: () => void }) {
  const { token } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authApi(token!).getMe().then(setProfile).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  if (loading || !profile) return null;
  return (
    <View style={{ flex: 1 }}>
      <Pressable style={{ padding: 16 }} onPress={onBack}>
        <Text style={{ color: '#4f8cff', fontSize: 16 }}>← Назад</Text>
      </Pressable>
      <ProfilePreviewScreen profile={profile} />
    </View>
  );
}

/* ── Onboarding ─────────────────────────────────────────────────────────── */
function OnboardingFlow() {
  const { state, hydrated, reset } = useOnboarding();

  if (!hydrated) return null;

  switch (state.step) {
    case 'goal':    return <GoalScreen />;
    case 'level':   return <LevelScreen />;
    case 'gym':     return <GymScreen />;
    case 'preview': return <PreviewScreen />;
    case 'register': return <RegisterScreen />;
    case 'done':
      return (
        <View style={done.wrap}>
          <Text style={done.title}>Вітаємо в GymBros! 🎉</Text>
          <Text style={done.sub}>Стрічка партнерів зʼявиться після входу.</Text>
          <Pressable style={done.btn} onPress={reset}>
            <Text style={done.btnText}>Вийти</Text>
          </Pressable>
        </View>
      );
  }
}

/* ── Root ───────────────────────────────────────────────────────────────── */
export default function App() {
  const { token } = useAuth();

  return (
    <OnboardingProvider>
      <AuthProvider>
        <StatusBar barStyle="light-content" />
        {token ? <AuthenticatedShell /> : <OnboardingFlow />}
      </AuthProvider>
    </OnboardingProvider>
  );
}

const tb = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    backgroundColor: '#1a2233',
    borderTopWidth: 1,
    borderTopColor: '#2a3554',
    paddingBottom: 24,
    paddingTop: 8,
  },
  item: { flex: 1, alignItems: 'center' },
  icon: { fontSize: 22 },
  iconActive: {},
  label: { color: '#8b93a7', fontSize: 11, marginTop: 2 },
  labelActive: { color: '#4f8cff' },
});

const done = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#0f1420', padding: 20, paddingTop: 80, alignItems: 'center' },
  title: { color: '#e8ecf4', fontSize: 28, fontWeight: '700', marginBottom: 12 },
  sub: { color: '#8b93a7', fontSize: 16, textAlign: 'center' },
  btn: { marginTop: 40, backgroundColor: '#1a2233', borderRadius: 12, paddingHorizontal: 32, paddingVertical: 14 },
  btnText: { color: '#8b93a7', fontSize: 16 },
});
