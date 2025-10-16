import { useState, useEffect } from "react";
import { Smartphone } from "lucide-react";
import { VisualDeviceEmulator } from "../VisualDeviceEmulator";

// Profile Selector Component
function ProfileSelector({ onSelectProfile }: { onSelectProfile: (profile: any) => void }) {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch profiles function
  const fetchProfiles = () => {
    setLoading(true);
    fetch('/api/profiles')
      .then(res => res.json())
      .then(data => {
        setProfiles(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load profiles:', err);
        setProfiles([]);
        setLoading(false);
      });
  };

  // Fetch on mount
  useEffect(() => {
    fetchProfiles();
  }, []);

  // Refetch when window regains focus
  useEffect(() => {
    const handleFocus = () => {
      console.log('[ProfileSelector] Window focused, refetching profiles...');
      fetchProfiles();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading profiles...</p>
        </div>
      </div>
    );
  }

  const activeProfiles = profiles.filter(p => p.status === 'active');

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">
          Visual Device Recorder
        </h2>
        <p className="text-gray-600">
          Select a running profile to start creating automation scripts visually
        </p>
      </div>

      {activeProfiles.length === 0 ? (
        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-8 text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h3 className="text-xl font-semibold text-yellow-800 mb-2">No Active Profiles</h3>
          <p className="text-yellow-700 mb-4">
            Please launch a profile first from the Profiles tab.
          </p>
          <button
            onClick={fetchProfiles}
            className="px-6 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
          >
            Refresh List
          </button>
        </div>
      ) : (
        <>
          <div className="grid gap-4 mb-4">
            {activeProfiles.map(profile => (
              <button
                key={profile.id}
                onClick={() => onSelectProfile(profile)}
                className="group p-6 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all text-left hover:shadow-lg"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Smartphone className="w-6 h-6 text-blue-500" />
                      <h3 className="text-lg font-semibold text-gray-800">
                        {profile.name}
                      </h3>
                      <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                        Active
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 ml-9">
                      <span className="font-medium">Instance:</span> {profile.instanceName}
                      <span className="mx-2">•</span>
                      <span className="font-medium">Port:</span> {profile.port}
                    </div>
                    {profile.device?.brand && (
                      <div className="text-xs text-gray-500 ml-9 mt-1">
                        {profile.device.brand} {profile.device.model}
                        {profile.device.realResolution && (
                          <span> • {profile.device.realResolution}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="text-blue-500 group-hover:translate-x-2 transition-transform">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </button>
            ))}
          </div>
          <div className="text-center">
            <button
              onClick={fetchProfiles}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Refresh Profile List
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function AutomationBuilderMobile() {
  const [selectedProfile, setSelectedProfile] = useState<any>(null);

  return (
    <div className="h-full w-full bg-gray-50">
      {selectedProfile ? (
        <div className="h-full w-full p-6">
          {/* Header */}
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Visual Device Recorder</h2>
              <p className="text-sm text-gray-600">
                Recording on: <span className="font-medium">{selectedProfile.name}</span> ({selectedProfile.instanceName})
              </p>
            </div>
            <button
              onClick={() => setSelectedProfile(null)}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              ← Change Profile
            </button>
          </div>

          {/* Visual Device Emulator */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <VisualDeviceEmulator
              profileId={selectedProfile.id}
              port={selectedProfile.port}
              instanceName={selectedProfile.instanceName}
            />
          </div>
        </div>
      ) : (
        <ProfileSelector onSelectProfile={setSelectedProfile} />
      )}
    </div>
  );
}
