import { useState, useEffect } from "react";
import { Detail, ActionPanel, Action, showToast, Toast, useNavigation, confirmAlert, Icon, Color } from "@raycast/api";
import { getProfile, deleteProfile, getActiveProfile } from "../utils/storage";
import { MCPProfile } from "../types";

interface DeleteProfileDetailProps {
  profileId: string;
  onRefresh?: () => void;
}

export default function DeleteProfileDetail({ profileId, onRefresh }: DeleteProfileDetailProps) {
  const { pop } = useNavigation();
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<MCPProfile | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load profile data on mount
  useEffect(() => {
    loadProfile();
  }, [profileId]);

  const loadProfile = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load profile and check if it's active
      const [profileResult, activeResult] = await Promise.all([getProfile(profileId), getActiveProfile()]);

      if (!profileResult.success || !profileResult.data) {
        throw new Error(profileResult.error || "Profile not found");
      }

      const profileData = profileResult.data;
      setProfile(profileData);

      // Check if this profile is currently active
      if (activeResult.success && activeResult.data === profileId) {
        setIsActive(true);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load profile";
      setError(errorMessage);
      await showToast({
        style: Toast.Style.Failure,
        title: "Error loading profile",
        message: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!profile) return;

    const shouldDelete = await confirmAlert({
      title: `Delete "${profile.name}"?`,
      message: `Are you sure you want to delete this profile? This action cannot be undone.${
        isActive ? "\n\n⚠️ Warning: This is the currently active profile." : ""
      }`,
      primaryAction: {
        title: "Delete",
        style: Action.Style.Destructive,
      },
      dismissAction: {
        title: "Cancel",
      },
    });

    if (!shouldDelete) {
      return;
    }

    try {
      const deleteResult = await deleteProfile(profileId);

      if (!deleteResult.success) {
        throw new Error(deleteResult.error || "Failed to delete profile");
      }

      await showToast({
        style: Toast.Style.Success,
        title: "Profile deleted",
        message: `"${profile.name}" has been deleted`,
      });

      // Refresh parent list before navigating back
      onRefresh?.();

      // Navigate back to profiles list
      pop();
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to delete profile",
        message: error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  };

  const getProfileDetailsMarkdown = () => {
    if (!profile) return "";

    const serverList = Object.entries(profile.mcpServers)
      .map(([name, config]) => {
        const envVarCount = config.env ? Object.keys(config.env).length : 0;
        const argsList = config.args.length > 0 ? `\n  - Args: ${config.args.join(" ")}` : "";
        const envInfo = envVarCount > 0 ? `\n  - Environment variables: ${envVarCount}` : "";

        return `### ${name}
- Command: \`${config.command}\`${argsList}${envInfo}`;
      })
      .join("\n\n");

    const activeWarning = isActive
      ? `
⚠️ **Warning**: This is the currently active profile. Deleting it will clear the active profile selection.

`
      : "";

    return `# Delete Profile: ${profile.name}

${activeWarning}${profile.description ? `**Description**: ${profile.description}\n\n` : ""}**Created**: ${profile.createdAt.toLocaleDateString()} at ${profile.createdAt.toLocaleTimeString()}

${profile.lastUsed ? `**Last Used**: ${profile.lastUsed.toLocaleDateString()} at ${profile.lastUsed.toLocaleTimeString()}\n\n` : ""}## MCP Servers (${Object.keys(profile.mcpServers).length})

${serverList}

---

**⚠️ This action cannot be undone. The profile and all its configurations will be permanently deleted.**`;
  };

  if (error) {
    return (
      <Detail
        markdown={`# Error Loading Profile

${error}

Please check that the profile exists and try again.`}
        actions={
          <ActionPanel>
            <Action title="Retry" onAction={loadProfile} icon={Icon.ArrowClockwise} />
            <Action title="Go Back" onAction={pop} icon={Icon.ArrowLeft} />
          </ActionPanel>
        }
      />
    );
  }

  return (
    <Detail
      isLoading={isLoading}
      markdown={getProfileDetailsMarkdown()}
      actions={
        <ActionPanel>
          <Action
            title="Delete Profile"
            onAction={handleDelete}
            style={Action.Style.Destructive}
            icon={Icon.Trash}
            shortcut={{ modifiers: ["cmd", "shift"], key: "d" }}
          />
          <ActionPanel.Section>
            <Action
              title="Cancel"
              onAction={pop}
              icon={Icon.XMarkCircle}
              shortcut={{ modifiers: ["cmd"], key: "escape" }}
            />
          </ActionPanel.Section>
        </ActionPanel>
      }
      metadata={
        profile && (
          <Detail.Metadata>
            <Detail.Metadata.Label title="Profile ID" text={profile.id} />
            <Detail.Metadata.Label title="Name" text={profile.name} />
            {profile.description && <Detail.Metadata.Label title="Description" text={profile.description} />}
            <Detail.Metadata.Separator />
            <Detail.Metadata.Label
              title="Status"
              text={isActive ? "Active" : "Inactive"}
              icon={isActive ? { source: Icon.CheckCircle, tintColor: Color.Green } : { source: Icon.Circle }}
            />
            <Detail.Metadata.Label title="Servers" text={Object.keys(profile.mcpServers).length.toString()} />
            <Detail.Metadata.Separator />
            <Detail.Metadata.Label
              title="Created"
              text={`${profile.createdAt.toLocaleDateString()} ${profile.createdAt.toLocaleTimeString()}`}
            />
            {profile.lastUsed && (
              <Detail.Metadata.Label
                title="Last Used"
                text={`${profile.lastUsed.toLocaleDateString()} ${profile.lastUsed.toLocaleTimeString()}`}
              />
            )}
          </Detail.Metadata>
        )
      }
    />
  );
}
