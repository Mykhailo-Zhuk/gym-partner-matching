import { Suspense, lazy, useState } from 'react';
import type { MatchListItem, UserProfile } from './api';
import { useAuth } from './contexts/AuthContext';
import { useOnboarding } from './contexts/OnboardingContext';
import { Layout } from './components/navigation/Layout';
import { Loading } from './components/ui/Screen';
import { GoalScreen } from './pages/onboarding/GoalScreen';
import { LevelScreen } from './pages/onboarding/LevelScreen';
import { GymScreen } from './pages/onboarding/GymScreen';
import { PreviewScreen } from './pages/onboarding/PreviewScreen';
import { RegisterScreen } from './pages/onboarding/RegisterScreen';

// Lazy-loaded main screens
const MatchingScreen = lazy(() => import('./pages/main/MatchingScreen').then(m => ({ default: m.MatchingScreen })));
const RequestsScreen = lazy(() => import('./pages/main/RequestsScreen').then(m => ({ default: m.RequestsScreen })));
const MatchesScreen = lazy(() => import('./pages/main/MatchesScreen').then(m => ({ default: m.MatchesScreen })));
const ChatScreen = lazy(() => import('./pages/match/ChatScreen').then(m => ({ default: m.ChatScreen })));
const ScheduleScreen = lazy(() => import('./pages/match/ScheduleScreen').then(m => ({ default: m.ScheduleScreen })));
const DashboardScreen = lazy(() => import('./pages/match/DashboardScreen').then(m => ({ default: m.DashboardScreen })));
const WorkoutFormScreen = lazy(() => import('./pages/match/WorkoutFormScreen').then(m => ({ default: m.WorkoutFormScreen })));
const GoalFormScreen = lazy(() => import('./pages/match/GoalFormScreen').then(m => ({ default: m.GoalFormScreen })));
const RatingFormScreen = lazy(() => import('./pages/match/RatingFormScreen').then(m => ({ default: m.RatingFormScreen })));
const ProfileScreen = lazy(() => import('./pages/profile/ProfileScreen').then(m => ({ default: m.ProfileScreen })));
const ProfileEditScreen = lazy(() => import('./pages/profile/ProfileEditScreen').then(m => ({ default: m.ProfileEditScreen })));
const ProfilePreviewScreen = lazy(() => import('./pages/profile/ProfilePreviewScreen').then(m => ({ default: m.ProfilePreviewScreen })));

type MainTab = 'matching' | 'requests' | 'matches' | 'profile';

interface MatchNavState {
  matchId: string;
  match: MatchListItem;
  subScreen: 'chat' | 'schedule' | 'dashboard' | 'workoutForm' | 'goalForm' | 'ratingForm';
}

interface ProfileNavState {
  editProfile: UserProfile;
  subScreen: 'profileEdit' | 'profilePreview';
}

// Onboarding uses useOnboarding context for navigation (setGoal/setLevel/setGym internally call goTo)
function OnboardingFlow({ onComplete }: { onComplete: () => void }) {
  const { complete } = useOnboarding();
  const { setToken } = useAuth();
  const { state } = useOnboarding();

  function handleRegister(token: string) {
    setToken(token);
    complete(token);
    onComplete();
  }

  if (state.step === 'goal') return <GoalScreen />;
  if (state.step === 'level') return <LevelScreen />;
  if (state.step === 'gym') return <GymScreen />;
  if (state.step === 'preview') return <PreviewScreen />;
  // register
  return <RegisterScreen onRegistered={handleRegister} />;
}

function MainFlow() {
  const [currentTab, setCurrentTab] = useState<MainTab>('matching');
  const [matchNav, setMatchNav] = useState<MatchNavState | null>(null);
  const [profileNav, setProfileNav] = useState<ProfileNavState | null>(null);

  function switchTab(tab: MainTab) {
    setMatchNav(null);
    setProfileNav(null);
    setCurrentTab(tab);
  }

  if (matchNav) {
    const { match, subScreen } = matchNav;
    if (subScreen === 'chat') {
      return (
        <ChatScreen
          matchId={match.id}
          match={match}
          onBack={() => setMatchNav(null)}
          onSchedulePress={(m) => setMatchNav({ matchId: m.id, match: m, subScreen: 'schedule' })}
        />
      );
    }
    if (subScreen === 'schedule') {
      return (
        <ScheduleScreen
          match={match}
          onBack={() => setMatchNav(null)}
          onDone={() => setMatchNav(null)}
        />
      );
    }
    if (subScreen === 'dashboard') {
      return (
        <DashboardScreen
          match={match}
          onBack={() => setMatchNav(null)}
          onAddWorkout={(m) => setMatchNav({ matchId: m.id, match: m, subScreen: 'workoutForm' })}
          onCreateGoal={(m) => setMatchNav({ matchId: m.id, match: m, subScreen: 'goalForm' })}
          onRate={(m) => setMatchNav({ matchId: m.id, match: m, subScreen: 'ratingForm' })}
        />
      );
    }
    if (subScreen === 'workoutForm') {
      return (
        <WorkoutFormScreen
          match={match}
          onBack={() => setMatchNav({ matchId: match.id, match, subScreen: 'dashboard' })}
          onDone={() => setMatchNav({ matchId: match.id, match, subScreen: 'dashboard' })}
        />
      );
    }
    if (subScreen === 'goalForm') {
      return (
        <GoalFormScreen
          match={match}
          onBack={() => setMatchNav({ matchId: match.id, match, subScreen: 'dashboard' })}
          onDone={() => setMatchNav({ matchId: match.id, match, subScreen: 'dashboard' })}
        />
      );
    }
    // ratingForm
    return (
      <RatingFormScreen
        match={match}
        onBack={() => setMatchNav(null)}
        onDone={() => setMatchNav(null)}
      />
    );
  }

  if (profileNav) {
    const { editProfile, subScreen } = profileNav;
    if (subScreen === 'profileEdit') {
      return (
        <ProfileEditScreen
          initial={editProfile}
          onSaved={() => setProfileNav(null)}
          onCancel={() => setProfileNav(null)}
        />
      );
    }
    // profilePreview
    return <ProfilePreviewScreen profile={editProfile} />;
  }

  return (
    <Layout currentTab={currentTab} onTabChange={switchTab}>
      <div key={currentTab} className="flex-1 overflow-y-auto">
        <Suspense fallback={<div className="flex items-center justify-center h-full"><Loading /></div>}>
          {currentTab === 'matching' && <MatchingScreen />}
          {currentTab === 'requests' && <RequestsScreen />}
          {currentTab === 'matches' && (
            <MatchesScreen
              onOpenChat={(matchId, match) => setMatchNav({ matchId, match, subScreen: 'chat' })}
              onSchedulePress={(match) => setMatchNav({ matchId: match.id, match, subScreen: 'schedule' })}
              onDashboardPress={(match) => setMatchNav({ matchId: match.id, match, subScreen: 'dashboard' })}
            />
          )}
          {currentTab === 'profile' && (
            <ProfileScreen
              onEdit={(p) => setProfileNav({ editProfile: p, subScreen: 'profileEdit' })}
              onPreview={(p) => setProfileNav({ editProfile: p, subScreen: 'profilePreview' })}
            />
          )}
        </Suspense>
      </div>
    </Layout>
  );
}

export default function App() {
  const { token, isOnboarded } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(!isOnboarded);

  if (!token || showOnboarding) {
    return <OnboardingFlow onComplete={() => setShowOnboarding(false)} />;
  }

  return <MainFlow />;
}
