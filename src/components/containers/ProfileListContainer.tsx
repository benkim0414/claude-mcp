/**
 * Profile list container component following Single Responsibility Principle
 * Handles business logic and state management, delegates rendering to view component
 */

import React from "react";
import { open } from "@raycast/api";
import { ProfileListView } from "../ui/ProfileListView";
import { useProfileList, useProfileFilter, useProfileSort } from "../../hooks/useProfileList";
import { ServiceProvider } from "../../context/ServiceProvider";
import { ProfileSummary } from "../../types/profile-types";

export default function ProfileListContainer() {
  const {
    profiles,
    activeProfileId,
    isLoading,
    error,
    loadProfiles,
    refreshProfiles,
    clearError
  } = useProfileList();

  const { searchQuery, setSearchQuery, filteredProfiles } = useProfileFilter(profiles);
  const { sortBy, sortOrder, sortedProfiles, toggleSort } = useProfileSort(filteredProfiles);

  const handleSwitchProfile = async (profile: ProfileSummary) => {
    if (profile.isActive) {
      return; // Already active, no action needed
    }

    // Open switch profile command
    await open(`raycast://extensions/benkim0414/claude-mcp/switch-profile`);
  };

  const handleCreateProfile = async () => {
    // Open create profile command
    await open(`raycast://extensions/benkim0414/claude-mcp/create-profile`);
  };

  const handleRetry = () => {
    clearError();
    loadProfiles();
  };

  return (
    <ServiceProvider>
      <ProfileListView
        profiles={sortedProfiles}
        activeProfileId={activeProfileId}
        isLoading={isLoading}
        error={error}
        searchQuery={searchQuery}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSearchQueryChange={setSearchQuery}
        onSortToggle={toggleSort}
        onSwitchProfile={handleSwitchProfile}
        onCreateProfile={handleCreateProfile}
        onRefresh={refreshProfiles}
        onRetry={handleRetry}
      />
    </ServiceProvider>
  );
}