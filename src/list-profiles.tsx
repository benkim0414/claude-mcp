import { useState, useEffect } from "react";
import { List, ActionPanel, Action, Toast, showToast, Icon, Color, confirmAlert, open } from "@raycast/api";
import { getProfileSummaries, getActiveProfile, deleteProfile } from "./utils/storage";
import { ProfileSummary } from "./types";

interface ListProfilesState {
  profiles: ProfileSummary[];
  activeProfileId: string | null;
  isLoading: boolean;
  error: string | null;
}

export default function ListProfiles() {
  const [state, setState] = useState<ListProfilesState>({
    profiles: [],
    activeProfileId: null,
    isLoading: true,
    error: null,
  });

  // Load profiles and active profile on mount
  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      // Load profiles and active profile in parallel
      const [profilesResult, activeProfileResult] = await Promise.all([getProfileSummaries(), getActiveProfile()]);

      if (!profilesResult.success) {
        throw new Error(profilesResult.error || "Failed to load profiles");
      }

      if (!activeProfileResult.success) {
        throw new Error(activeProfileResult.error || "Failed to get active profile");
      }

      // Update profiles with active status
      const profiles = (profilesResult.data || []).map((profile) => ({
        ...profile,
        isActive: profile.id === activeProfileResult.data,
      }));

      setState({
        profiles,
        activeProfileId: activeProfileResult.data ?? null,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "Failed to load profiles",
      }));

      await showToast({
        style: Toast.Style.Failure,
        title: "Error loading profiles",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  const handleSwitchProfile = async (profile: ProfileSummary) => {
    if (profile.isActive) {
      await showToast({
        style: Toast.Style.Success,
        title: `${profile.name} is already active`,
      });
      return;
    }

    // Open switch profile command
    await open(`raycast://extensions/gunwoo-ben-kim/claude-mcp/switch-profile`);
  };

  const handleEditProfile = async (profile: ProfileSummary) => {
    // Open edit profile command with profile ID
    await open(
      `raycast://extensions/gunwoo-ben-kim/claude-mcp/edit-profile?arguments=${encodeURIComponent(JSON.stringify({ profileId: profile.id }))}`,
    );
  };

  const handleCreateProfile = async () => {
    // Open create profile command
    await open(`raycast://extensions/gunwoo-ben-kim/claude-mcp/create-profile`);
  };

  const handleDeleteProfile = async (profile: ProfileSummary) => {
    const shouldDelete = await confirmAlert({
      title: `Delete "${profile.name}"?`,
      message: `Are you sure you want to delete this profile? This action cannot be undone.${
        profile.isActive ? "\n\nNote: This is the currently active profile." : ""
      }`,
      primaryAction: {
        title: "Delete",
      },
      dismissAction: {
        title: "Cancel",
      },
    });

    if (!shouldDelete) {
      return;
    }

    try {
      const deleteResult = await deleteProfile(profile.id);

      if (!deleteResult.success) {
        throw new Error(deleteResult.error || "Failed to delete profile");
      }

      await showToast({
        style: Toast.Style.Success,
        title: "Profile deleted",
        message: `${profile.name} has been deleted`,
      });

      // Reload profiles to update the list
      await loadProfiles();
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to delete profile",
        message: error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  };

  const getProfileIcon = (profile: ProfileSummary) => {
    if (profile.isActive) {
      return { source: Icon.CheckCircle, tintColor: Color.Green };
    }
    return { source: Icon.Circle, tintColor: Color.SecondaryText };
  };

  const getProfileSubtitle = (profile: ProfileSummary) => {
    const parts = [];

    if (profile.description) {
      parts.push(profile.description);
    }

    if (profile.serverCount > 0) {
      parts.push(`${profile.serverCount} server${profile.serverCount !== 1 ? "s" : ""}`);
    }

    return parts.join(" • ");
  };

  const getProfileAccessories = (profile: ProfileSummary) => {
    const accessories = [];

    if (profile.isActive) {
      accessories.push({
        text: "Active",
        icon: { source: Icon.CheckCircle, tintColor: Color.Green },
      });
    }

    // Show last used date if available
    if (profile.lastUsed) {
      const lastUsedDate = new Date(profile.lastUsed);
      const now = new Date();
      const diffMs = now.getTime() - lastUsedDate.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        accessories.push({ text: "Used today" });
      } else if (diffDays === 1) {
        accessories.push({ text: "Used yesterday" });
      } else if (diffDays < 7) {
        accessories.push({ text: `Used ${diffDays} days ago` });
      } else {
        accessories.push({ text: `Used ${lastUsedDate.toLocaleDateString()}` });
      }
    } else {
      // Show creation date for profiles that haven't been used
      const createdDate = new Date(profile.createdAt);
      const now = new Date();
      const diffMs = now.getTime() - createdDate.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        accessories.push({ text: "Created today" });
      } else if (diffDays === 1) {
        accessories.push({ text: "Created yesterday" });
      } else if (diffDays < 7) {
        accessories.push({ text: `Created ${diffDays} days ago` });
      } else {
        accessories.push({ text: `Created ${createdDate.toLocaleDateString()}` });
      }
    }

    return accessories;
  };

  if (state.error) {
    return (
      <List>
        <List.EmptyView
          icon={{ source: Icon.ExclamationMark, tintColor: Color.Red }}
          title="Error Loading Profiles"
          description={state.error}
          actions={
            <ActionPanel>
              <Action title="Retry" onAction={loadProfiles} icon={Icon.ArrowClockwise} />
            </ActionPanel>
          }
        />
      </List>
    );
  }

  return (
    <List isLoading={state.isLoading} searchBarPlaceholder="Search profiles..." navigationTitle="MCP Profiles">
      {state.profiles.length === 0 ? (
        <List.EmptyView
          icon={{ source: Icon.Folder, tintColor: Color.SecondaryText }}
          title="No Profiles Found"
          description="Create your first MCP profile to get started with managing your Claude Desktop configurations"
          actions={
            <ActionPanel>
              <Action title="Refresh" onAction={loadProfiles} icon={Icon.ArrowClockwise} />
              <Action title="Create Profile" onAction={handleCreateProfile} icon={Icon.Plus} />
            </ActionPanel>
          }
        />
      ) : (
        state.profiles.map((profile) => (
          <List.Item
            key={profile.id}
            icon={getProfileIcon(profile)}
            title={profile.name}
            subtitle={getProfileSubtitle(profile)}
            accessories={getProfileAccessories(profile)}
            actions={
              <ActionPanel>
                <ActionPanel.Section>
                  <Action
                    title={profile.isActive ? "Already Active" : "Switch to Profile"}
                    onAction={() => handleSwitchProfile(profile)}
                    icon={profile.isActive ? Icon.CheckCircle : Icon.ArrowRight}
                    style={profile.isActive ? Action.Style.Regular : Action.Style.Regular}
                  />
                </ActionPanel.Section>
                <ActionPanel.Section>
                  <Action
                    title="Edit Profile"
                    onAction={() => handleEditProfile(profile)}
                    icon={Icon.Pencil}
                    shortcut={{ modifiers: ["cmd"], key: "e" }}
                  />
                  <Action
                    title="Delete Profile"
                    onAction={() => handleDeleteProfile(profile)}
                    icon={Icon.Trash}
                    style={Action.Style.Destructive}
                    shortcut={{ modifiers: ["cmd", "shift"], key: "d" }}
                  />
                </ActionPanel.Section>
                <ActionPanel.Section>
                  <Action
                    title="Refresh"
                    onAction={loadProfiles}
                    icon={Icon.ArrowClockwise}
                    shortcut={{ modifiers: ["cmd"], key: "r" }}
                  />
                  <Action
                    title="Create New Profile"
                    onAction={handleCreateProfile}
                    icon={Icon.Plus}
                    shortcut={{ modifiers: ["cmd"], key: "n" }}
                  />
                </ActionPanel.Section>
              </ActionPanel>
            }
          />
        ))
      )}
    </List>
  );
}
