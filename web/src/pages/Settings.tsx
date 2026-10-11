import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import {
  Users,
  Lock,
  Plus,
  Shield,
  CheckCircle2,
  Trash2,
  Mail,
  UserCheck,
  Sparkles,
  Database,
  User,
  Camera,
  Loader2,
  Building2,
} from "lucide-react";
import { motion } from "motion/react";
import { pageContainer, pageItem } from "@/lib/animations";
import { GenericDataTable } from "@/components/generic-data-table";
import type { AppColumnDef } from "@/lib/table-features";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import {
  fetchOrgMembers,
  inviteMember as apiInviteMember,
  type BackendMember,
} from "@/lib/organizations";

import { EntityProfileForm } from "@/components/EntityProfileForm";
import { MOCK_USERS, type UserData } from "@/data/users";

const mapBackendMember = (m: BackendMember): UserData => ({
  id: m.id,
  name: m.name,
  email: m.email,
  role: m.role.charAt(0) + m.role.slice(1).toLowerCase(),
  status: m.status.toLowerCase(),
  lastLogin: m.lastLogin
    ? new Date(m.lastLogin).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : "Never",
});

const PROVIDER_LABELS: Record<string, string> = {
  bedrock: "AWS Bedrock",
  vertexai: "Google Vertex AI",
  anthropic: "Anthropic",
  openai: "OpenAI",
  ollama: "Ollama",
  sarvam: "Sarvam AI",
};
const providerLabel = (p?: string) => (p ? (PROVIDER_LABELS[p] ?? p) : "—");

const AI_MODEL_MAP: Record<string, string[]> = {
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
  anthropic: ["claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5"],
  vertexai: ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-1.0-pro"],
  bedrock: Array.from(
    new Set([
      __AI_DEFAULTS__.model,
      "apac.amazon.nova-pro-v1:0",
      "anthropic.claude-3-5-sonnet-20241022-v2:0",
      "anthropic.claude-3-5-haiku-20241022-v1:0",
      "us.anthropic.claude-3-7-sonnet-20250219-v1:0",
      "amazon.nova-pro-v1:0",
    ]),
  ),
  ollama: ["llama3", "phi3", "gemma"],
  sarvam: ["sarvam-1"],
};

const EMBEDDING_MODEL_MAP: Record<string, string[]> = {
  openai: [
    "text-embedding-3-small",
    "text-embedding-3-large",
    "text-embedding-ada-002",
  ],
  vertexai: ["text-embedding-004", "text-multilingual-embedding-002"],
  bedrock: [
    __AI_DEFAULTS__.embeddingModel,
    "amazon.titan-embed-text-v2:0",
    "cohere.embed-english-v3",
    "cohere.embed-multilingual-v3",
  ],
  ollama: ["nomic-embed-text", "all-minilm", "mxbai-embed-large"],
};

const Settings = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get("tab") || "users";
  const { isDemo } = useAuth();

  const [userData, setUserData] = useState<UserData[]>(isDemo ? MOCK_USERS : []);
  const [isLoadingUsers, setIsLoadingUsers] = useState(!isDemo);
  const [usersLoadError, setUsersLoadError] = useState<string | null>(null);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"ADMIN" | "EDITOR" | "VIEWER">("VIEWER");
  const [isInviting, setIsInviting] = useState(false);

  const loadMembers = () => {
    if (isDemo) return;
    fetchOrgMembers()
      .then((members) => {
        setUserData(members.map(mapBackendMember));
        setUsersLoadError(null);
      })
      .catch((err) => {
        setUsersLoadError(err instanceof Error ? err.message : "Failed to load users.");
      })
      .finally(() => setIsLoadingUsers(false));
  };

  useEffect(() => {
    loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return toast.error("Email is required");
    setIsInviting(true);
    try {
      await apiInviteMember(inviteEmail.trim(), inviteRole);
      toast.success(`Invite sent to ${inviteEmail.trim()}`);
      setInviteDialogOpen(false);
      setInviteEmail("");
      setInviteRole("VIEWER");
      if (!isDemo) setIsLoadingUsers(true);
      loadMembers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send invite");
    } finally {
      setIsInviting(false);
    }
  };
  const [aiProvider, setAiProvider] = useState<string>("bedrock");
  const [aiModel, setAiModel] = useState<string>(__AI_DEFAULTS__.model);
  const [apiKey, setApiKey] = useState<string>("");
  const [embeddingProvider, setEmbeddingProvider] =
    useState<string>("bedrock");
  const [embeddingModel, setEmbeddingModel] =
    useState<string>(__AI_DEFAULTS__.embeddingModel);

  // Account Settings State
  const { user, updateProfile, changePassword, uploadAvatar, refreshUser } =
    useAuth();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [name, setName] = useState(user?.name || "");
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const profileHasChanges = name !== (user?.name || "");
  const passwordHasChanges =
    currentPassword !== "" || newPassword !== "" || confirmPassword !== "";

  const [aiConfigMode, setAiConfigMode] = useState<string>("default");
  const [defaultAiConfig, setDefaultAiConfig] = useState<{
    provider: string;
    model: string;
  }>({ provider: __AI_DEFAULTS__.provider, model: __AI_DEFAULTS__.model });
  const [defaultEmbeddingConfig, setDefaultEmbeddingConfig] = useState<{
    provider: string;
    model: string;
  }>({ provider: __AI_DEFAULTS__.provider, model: __AI_DEFAULTS__.embeddingModel });
  const [availableProviders, setAvailableProviders] = useState<
    { name: string; defaultModel: string }[]
  >([]);
  const [availableEmbeddingProviders, setAvailableEmbeddingProviders] =
    useState<{ name: string; defaultModel: string }[]>([]);

  useEffect(() => {
    // Demo sessions have no backend: the env-derived defaults above are shown.
    if (isDemo) return;
    // Fetch AI config and providers
    const fetchAiData = async () => {
      try {
        const [configRes, providersRes] = await Promise.all([
          apiFetch<{ provider: string; model: string }>(
            "/organizations/me/ai/platform-default",
          ),
          apiFetch<{ providers: { name: string; defaultModel: string }[] }>(
            "/organizations/me/ai/providers",
          ),
        ]);
        if (configRes) setDefaultAiConfig(configRes);
        if (providersRes && providersRes.providers)
          setAvailableProviders(providersRes.providers);

        // Initialize custom AI provider/model from backend config or first available provider
        const initialProvider =
          configRes.provider || providersRes.providers?.[0]?.name || "bedrock";
        setAiProvider(initialProvider);
        setAiModel(
          initialProvider === __AI_DEFAULTS__.provider
            ? __AI_DEFAULTS__.model
            : (AI_MODEL_MAP[initialProvider]?.[0] ?? __AI_DEFAULTS__.model),
        );
      } catch (err) {
        console.error("Failed to fetch AI data", err);
      }
    };

    const fetchEmbeddingData = async () => {
      try {
        const [configRes, providersRes] = await Promise.all([
          apiFetch<{ embeddingProvider: string; embeddingModel: string }>(
            "/organizations/me/ai/platform-default",
          ).then((cfg) => ({
            provider: cfg.embeddingProvider,
            model: cfg.embeddingModel,
          })),
          apiFetch<{ providers: { name: string; defaultModel: string }[] }>(
            "/organizations/me/embeddings/providers",
          ),
        ]);
        if (configRes) setDefaultEmbeddingConfig(configRes);
        if (providersRes && providersRes.providers)
          setAvailableEmbeddingProviders(providersRes.providers);

        // Initialize custom embedding provider/model from backend config or first available provider
        const initialEmbeddingProvider =
          configRes.provider || providersRes.providers?.[0]?.name || "bedrock";
        setEmbeddingProvider(initialEmbeddingProvider);
        setEmbeddingModel(
          initialEmbeddingProvider === __AI_DEFAULTS__.provider
            ? __AI_DEFAULTS__.embeddingModel
            : (EMBEDDING_MODEL_MAP[initialEmbeddingProvider]?.[0] ??
              __AI_DEFAULTS__.embeddingModel),
        );
      } catch (err) {
        console.error("Failed to fetch embedding data", err);
      }
    };

    fetchAiData();
    fetchEmbeddingData();
  }, [user, isDemo]);

  useEffect(() => {
    refreshUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/"))
      return toast.error("Please upload an image file");
    if (file.size > 2 * 1024 * 1024)
      return toast.error("File size must be less than 2MB");

    setIsUploadingAvatar(true);
    const res = await uploadAvatar(file);
    setIsUploadingAvatar(false);
    if (res.success) toast.success("Profile photo updated");
    else toast.error(res.error || "Failed to upload photo");
    if (e.target) e.target.value = "";
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Name is required");
    setIsUpdatingProfile(true);
    const res = await updateProfile({ name });
    setIsUpdatingProfile(false);
    if (res.success) toast.success("Profile updated successfully");
    else toast.error(res.error || "Failed to update profile");
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword)
      return toast.error("All fields are required");
    if (newPassword !== confirmPassword)
      return toast.error("Passwords do not match");
    if (newPassword.length < 8)
      return toast.error("New password must be at least 8 characters");

    setIsChangingPassword(true);
    const res = await changePassword(currentPassword, newPassword);
    setIsChangingPassword(false);

    if (res.success) {
      toast.success("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } else toast.error(res.error || "Failed to change password");
  };

  const getProviderIcon = (name: string) => {
    const icons: Record<string, string> = {
      openai: "https://openai.com/favicon.ico",
      anthropic: "https://www.anthropic.com/favicon.ico",
      vertexai: "https://google.com/favicon.ico",
      bedrock: "https://amazon.com/favicon.ico",
      ollama: "https://ollama.com/public/icon-64x64.png",
      sarvam: "https://www.sarvam.ai/favicon.svg",
    };
    return icons[name.toLowerCase()] || "";
  };

  const columns = useMemo<AppColumnDef<UserData>[]>(
    () => [
      {
        accessorKey: "name",
        header: "User",
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-[10px]">
              {row.original.name
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground leading-tight">
                {row.original.name}
              </p>
              <p className="text-[11px] text-muted-foreground md:hidden">
                {row.original.email}
              </p>
            </div>
          </div>
        ),
      },
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground hidden md:inline">
            {row.original.email}
          </span>
        ),
      },
      {
        accessorKey: "role",
        header: "Role",
        cell: ({ row }) =>
          isDemo ? (
            <Select
              defaultValue={row.original.role.toLowerCase()}
              onValueChange={(val) => {
                const newRole = val.charAt(0).toUpperCase() + val.slice(1);
                setUserData((prev) =>
                  prev.map((u) =>
                    u.id === row.original.id ? { ...u, role: newRole } : u,
                  ),
                );
              }}
            >
              <SelectTrigger className="h-8 w-24 text-[11px] bg-background font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="editor">Editor</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <Badge variant="outline" className="text-[11px] font-medium">
              {row.original.role}
            </Badge>
          ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={cn(
              "text-[11px] px-2 py-0.5 capitalize",
              row.original.status === "active"
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20"
                : "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border-amber-100 dark:border-amber-500/20",
            )}
          >
            {row.original.status}
          </Badge>
        ),
      },
      {
        accessorKey: "lastLogin",
        header: "Last Login",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {row.original.lastLogin}
          </span>
        ),
      },
      // Email/reset-password/remove aren't backed by any API yet — only
      // show this column in demo, where it's a harmless no-op UI.
      ...(isDemo
        ? [
          {
            id: "actions",
            header: () => <div className="text-right pr-4">Actions</div>,
            cell: () => (
              <div className="flex items-center justify-end gap-2 pr-4">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 opacity-100 transition-opacity"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 rounded-xl p-2">
                    <DropdownMenuItem className="gap-2 font-medium">
                      <Mail className="h-4 w-4" /> Email User
                    </DropdownMenuItem>
                    <DropdownMenuItem className="gap-2 font-medium">
                      <UserCheck className="h-4 w-4" /> Reset Password
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="gap-2 font-medium text-red-500 focus:text-red-600 focus:bg-red-500/10">
                      <Trash2 className="h-4 w-4" /> Remove User
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ),
          } as AppColumnDef<UserData>,
        ]
        : []),
    ],
    [isDemo],
  );

  return (
    <motion.div
      variants={pageContainer}
      initial="hidden"
      animate="show"
      className="flex-1 overflow-auto p-4 md:p-6 space-y-6"
    >
      <motion.div
        variants={pageItem}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight">
            Settings
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">
            Manage users and security
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            size="default"
            className="h-10 px-5 rounded-lg font-medium bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-all active:scale-[0.98] w-full sm:w-auto"
            onClick={() => {
              if (isDemo) {
                toast.success("This is a demo — invites aren't sent.");
                return;
              }
              setInviteDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Invite User
          </Button>
        </div>
      </motion.div>

      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite a team member</DialogTitle>
            <DialogDescription>
              They'll receive an invite to join your organization.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="invite-email" className="text-xs font-semibold">
                Email Address
              </Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="colleague@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-xs font-semibold">Role</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as typeof inviteRole)}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="EDITOR">Editor</SelectItem>
                  <SelectItem value="VIEWER">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full h-9 text-xs font-semibold"
              disabled={isInviting}
              onClick={handleInvite}
            >
              {isInviting && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Send Invite
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <motion.div variants={pageItem}>
        <Tabs
          value={currentTab}
          onValueChange={(val) => setSearchParams({ tab: val })}
          className="w-full space-y-4"
        >
          <TabsList className="w-full sm:w-fit justify-start overflow-x-auto [&::-webkit-scrollbar]:hidden bg-muted/50 p-1 h-11">
            <TabsTrigger
              value="users"
              className="min-w-max whitespace-nowrap shrink-0 sm:flex-none rounded-md px-6"
            >
              <Users className="h-4 w-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger
              value="account"
              className="min-w-max whitespace-nowrap shrink-0 sm:flex-none rounded-md px-6"
            >
              <User className="h-4 w-4 mr-2" />
              Account
            </TabsTrigger>
            <TabsTrigger
              value="security"
              className="min-w-max whitespace-nowrap shrink-0 sm:flex-none rounded-md px-6"
            >
              <Lock className="h-4 w-4 mr-2" />
              Security
            </TabsTrigger>
            <TabsTrigger
              value="ai"
              className="min-w-max whitespace-nowrap shrink-0 sm:flex-none rounded-md px-6"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              AI Models
            </TabsTrigger>
            <TabsTrigger
              value="profile"
              className="min-w-max whitespace-nowrap shrink-0 sm:flex-none rounded-md px-6"
            >
              <Building2 className="h-4 w-4 mr-2" />
              Entity profile
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="m-0">
            <EntityProfileForm isDemo={isDemo} />
          </TabsContent>

          {/* Users */}
          <TabsContent
            value="users"
            className="animate-in fade-in slide-in-from-bottom-2 duration-300 m-0"
          >
            {!isDemo && isLoadingUsers && (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Loading users...
              </div>
            )}
            {!isDemo && usersLoadError && (
              <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20 p-4 text-sm font-medium">
                Failed to load users: {usersLoadError}
              </div>
            )}
            {(isDemo || (!isLoadingUsers && !usersLoadError)) && (
              <GenericDataTable
                columns={columns}
                data={userData}
                searchKey="name"
                searchPlaceholder="Search users by name or email..."
              />
            )}
          </TabsContent>

          {/* Account Settings */}
          <TabsContent
            value="account"
            className="animate-in fade-in slide-in-from-bottom-2 duration-300 m-0 space-y-6"
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
              <Card className="border-border/50 shadow-sm">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold">
                        Profile Information
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Update your public profile details.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                    <div
                      className="relative group cursor-pointer"
                      onClick={handleAvatarClick}
                    >
                      <Avatar className="h-20 w-20 border-2 border-primary/20 transition-all group-hover:border-primary/50">
                        <AvatarImage
                          src={
                            user?.avatar ||
                            user?.avatarUrl ||
                            user?.AvatarUrl ||
                            user?.avatar_url ||
                            user?.picture ||
                            user?.photoURL ||
                            user?.photoUrl
                          }
                          alt={user?.name}
                          referrerPolicy="no-referrer"
                        />
                        <AvatarFallback className="text-xl bg-muted">
                          {user?.name?.slice(0, 2).toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div
                        className={`absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity rounded-full ${isUploadingAvatar ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                      >
                        {isUploadingAvatar ? (
                          <Loader2 className="h-6 w-6 text-white animate-spin" />
                        ) : (
                          <Camera className="h-6 w-6 text-white" />
                        )}
                      </div>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="image/*"
                        className="hidden"
                      />
                    </div>
                    <div className="space-y-1">
                      <h3
                        className="font-medium cursor-pointer hover:text-primary transition-colors text-sm"
                        onClick={handleAvatarClick}
                      >
                        Profile Photo
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Click the photo to upload. (JPEG, PNG, WEBP)
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleUpdateProfile} className="space-y-4">
                    <div className="grid gap-2">
                      <Label htmlFor="email" className="text-xs font-semibold">
                        Email Address
                      </Label>
                      <Input
                        id="email"
                        value={user?.email || ""}
                        disabled
                        className="bg-muted h-9 text-xs"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="name" className="text-xs font-semibold">
                        Full Name
                      </Label>
                      <Input
                        id="name"
                        placeholder="John Doe"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="bg-transparent h-9 text-xs transition-all focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={isUpdatingProfile || !profileHasChanges}
                      className="h-9 px-6 text-xs font-semibold transition-all hover:shadow-md active:scale-95 disabled:opacity-50"
                    >
                      {isUpdatingProfile && (
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      )}
                      Save Profile
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card className="border-border/50 shadow-sm relative overflow-hidden group">
                {!user?.hasPassword && user?.isGoogleUser && (
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-8 text-center bg-background/80 backdrop-blur-[2px] border-image-source: linear-gradient(to bottom, transparent, white)">
                    <div className="p-4 bg-primary/10 rounded-2xl mb-4 self-center group-hover:scale-110 transition-transform">
                      <Sparkles className="h-8 w-8 text-primary" />
                    </div>
                    <h4 className="font-bold text-lg">Google Account</h4>
                    <p className="text-[12px] text-muted-foreground max-w-[260px] mt-2 leading-relaxed">
                      Security for your account is handled by Google. You can
                      manage access from your Google Account hub.
                    </p>
                    <Button
                      variant="default"
                      size="default"
                      className="mt-8 px-8 font-bold h-10 shadow-lg"
                      onClick={() =>
                        window.open(
                          "https://myaccount.google.com/security",
                          "_blank",
                        )
                      }
                    >
                      Visit Google Hub
                    </Button>
                  </div>
                )}

                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Lock className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold">
                        Security
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Update your password correctly.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleChangePassword} className="space-y-4">
                    <div className="grid gap-2">
                      <Label
                        htmlFor="current"
                        className="text-xs font-semibold"
                      >
                        Current Password
                      </Label>
                      <Input
                        id="current"
                        type="password"
                        autoComplete="current-password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        disabled={!user?.hasPassword}
                        className="h-9 text-xs"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="new" className="text-xs font-semibold">
                        New Password
                      </Label>
                      <Input
                        id="new"
                        type="password"
                        autoComplete="new-password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="h-9 text-xs"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label
                        htmlFor="confirm"
                        className="text-xs font-semibold"
                      >
                        Confirm Password
                      </Label>
                      <Input
                        id="confirm"
                        type="password"
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="h-9 text-xs"
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={isChangingPassword || !passwordHasChanges}
                      className="h-9 px-6 text-xs font-semibold transition-all hover:shadow-md active:scale-95 disabled:opacity-50"
                    >
                      {isChangingPassword && (
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      )}
                      {user?.hasPassword ? "Change Password" : "Set Password"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Security */}
          <TabsContent
            value="security"
            className="animate-in fade-in slide-in-from-bottom-2 duration-300 m-0 space-y-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <Card className="border-border/50">
                <CardHeader className="pb-3 pt-5">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    Authentication Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 divide-y divide-border/30">
                  <div className="flex items-center justify-between p-4 px-6 hover:bg-muted/30 transition-colors">
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold text-foreground">
                        Single Sign-On (SSO)
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        SAML 2.0 via Azure AD
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-none text-[10px] px-2 py-0 font-bold"
                    >
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      ENABLED
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-4 px-6 hover:bg-muted/30 transition-colors">
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold text-foreground">
                        Multi-Factor Authentication
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Require MFA for all users
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between p-4 px-6 hover:bg-muted/30 transition-colors">
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold text-foreground">
                        Session Timeout
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Auto-logout after inactivity
                      </p>
                    </div>
                    <Select defaultValue="30">
                      <SelectTrigger className="w-32 h-8 text-[11px] font-bold bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15">15 minutes</SelectItem>
                        <SelectItem value="30">30 minutes</SelectItem>
                        <SelectItem value="60">1 hour</SelectItem>
                        <SelectItem value="120">2 hours</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardHeader className="pb-3 pt-5">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Lock className="h-4 w-4 text-primary" />
                    Network Restrictions
                  </CardTitle>
                  <CardDescription className="text-[11px]">
                    Restrict access to specific IP ranges
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2 p-1 bg-muted/30 rounded-xl border border-border/50">
                    <Input
                      placeholder="e.g., 192.168.1.0/24"
                      className="flex-1 bg-transparent border-none focus-visible:ring-0 shadow-none text-xs"
                    />
                    <Button
                      size="sm"
                      className="h-9 px-4 font-bold rounded-lg pointer-events-none opacity-50"
                    >
                      Add IP
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 px-4 rounded-xl bg-muted/50 border border-border/50">
                      <span className="text-xs text-foreground font-mono font-bold tracking-tight">
                        10.0.0.0/8
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive h-7 w-7 p-0 hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* AI Models */}
          <TabsContent
            value="ai"
            className="animate-in fade-in slide-in-from-bottom-2 duration-300 m-0 space-y-6"
          >
            <Tabs
              defaultValue="default"
              value={aiConfigMode}
              onValueChange={setAiConfigMode}
              className="w-full space-y-6"
            >
              <TabsList className="w-full sm:w-fit justify-start bg-muted/50 p-1 h-11">
                <TabsTrigger value="default" className="px-6 rounded-md">
                  Default
                </TabsTrigger>
                <TabsTrigger value="custom" className="px-6 rounded-md">
                  Customize
                </TabsTrigger>
              </TabsList>

              <TabsContent
                value="default"
                className="space-y-4 animate-in fade-in duration-300"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="border-border/50">
                    <CardHeader className="pb-3 pt-5">
                      <CardTitle className="text-base font-bold flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        AI Provider
                      </CardTitle>
                      <CardDescription className="text-[11px]">
                        Using optimized default models for drafting and
                        analysis.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-2">
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                            Provider
                          </p>
                          <Select
                            value={defaultAiConfig.provider || "bedrock"}
                            disabled
                          >
                            <SelectTrigger className="w-full h-9 text-xs font-medium bg-muted/30">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem
                                value={defaultAiConfig.provider || "bedrock"}
                              >
                                <span className="flex items-center gap-2">
                                  {getProviderIcon(
                                    defaultAiConfig.provider || "bedrock",
                                  ) ? (
                                    <img
                                      src={getProviderIcon(
                                        defaultAiConfig.provider || "bedrock",
                                      )}
                                      alt=""
                                      className="h-4 w-4 rounded-sm object-contain"
                                    />
                                  ) : null}
                                  <span className="capitalize">
                                    {providerLabel(defaultAiConfig.provider)}
                                  </span>
                                </span>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                            Chat Model
                          </p>
                          <Select
                            value={defaultAiConfig.model || "—"}
                            disabled
                          >
                            <SelectTrigger className="w-full h-9 text-xs font-medium bg-muted/30">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem
                                value={
                                  defaultAiConfig.model || "—"
                                }
                              >
                                <span className="flex items-center gap-2">
                                  {getProviderIcon(
                                    defaultAiConfig.provider || "bedrock",
                                  ) ? (
                                    <img
                                      src={getProviderIcon(
                                        defaultAiConfig.provider || "bedrock",
                                      )}
                                      alt=""
                                      className="h-4 w-4 rounded-sm object-contain"
                                    />
                                  ) : null}
                                  <span>
                                    {defaultAiConfig.model ||
                                      "—"}
                                  </span>
                                </span>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                            API Key
                          </p>
                          <Input
                            type="password"
                            name="system_managed_key"
                            id="system_managed_key"
                            autoComplete="new-password"
                            value="••••••••••••••••"
                            className="h-9 text-xs font-mono bg-muted/30"
                            disabled
                          />
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <Badge
                          variant="outline"
                          className="text-[9px] bg-primary/10 border-primary/20 text-primary font-bold"
                        >
                          SYSTEM MANAGED
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-border/50">
                    <CardHeader className="pb-3 pt-5">
                      <CardTitle className="text-base font-bold flex items-center gap-2">
                        <Database className="h-4 w-4 text-primary" />
                        Embedding configuration
                      </CardTitle>
                      <CardDescription className="text-[11px]">
                        Using optimized default models for search and retrieval.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-2">
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                            Embedding Provider
                          </p>
                          <Select
                            value={
                              defaultEmbeddingConfig.provider || "bedrock"
                            }
                            disabled
                          >
                            <SelectTrigger className="w-full h-9 text-xs font-medium bg-muted/30">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem
                                value={
                                  defaultEmbeddingConfig.provider || "bedrock"
                                }
                              >
                                <span className="flex items-center gap-2">
                                  {getProviderIcon(
                                    defaultEmbeddingConfig.provider ||
                                    "bedrock",
                                  ) ? (
                                    <img
                                      src={getProviderIcon(
                                        defaultEmbeddingConfig.provider ||
                                        "bedrock",
                                      )}
                                      alt=""
                                      className="h-4 w-4 rounded-sm object-contain"
                                    />
                                  ) : null}
                                  <span className="capitalize">
                                    {providerLabel(defaultEmbeddingConfig.provider)}
                                  </span>
                                </span>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                            Embedding Model
                          </p>
                          <Select
                            value={
                              defaultEmbeddingConfig.model ||
                              "text-embedding-3-small"
                            }
                            disabled
                          >
                            <SelectTrigger className="w-full h-9 text-xs font-medium bg-muted/30">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem
                                value={
                                  defaultEmbeddingConfig.model ||
                                  "text-embedding-3-small"
                                }
                              >
                                <span className="flex items-center gap-2">
                                  {getProviderIcon(
                                    defaultEmbeddingConfig.provider ||
                                    "bedrock",
                                  ) ? (
                                    <img
                                      src={getProviderIcon(
                                        defaultEmbeddingConfig.provider ||
                                        "bedrock",
                                      )}
                                      alt=""
                                      className="h-4 w-4 rounded-sm object-contain"
                                    />
                                  ) : null}
                                  <span>
                                    {defaultEmbeddingConfig.model ||
                                      "text-embedding-3-small"}
                                  </span>
                                </span>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <p className="text-[10px] text-muted-foreground max-w-[200px]">
                          Optimized for accuracy and speed.
                        </p>
                        <Badge
                          variant="outline"
                          className="text-[9px] bg-primary/10 border-primary/20 text-primary font-bold"
                        >
                          MANAGED
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent
                value="custom"
                className="space-y-4 animate-in fade-in duration-300"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="border-border/50">
                    <CardHeader className="pb-3 pt-5">
                      <CardTitle className="text-base font-bold flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        AI Provider
                      </CardTitle>
                      <CardDescription className="text-[11px]">
                        Configure your own models and API keys for drafting and
                        analysis.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-2">
                      <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="space-y-1.5">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                            Provider
                          </p>
                          <Select
                            defaultValue={aiProvider || undefined}
                            onValueChange={(v) => {
                              setAiProvider(v);
                              if (AI_MODEL_MAP[v]) {
                                setAiModel(AI_MODEL_MAP[v][0]);
                              }
                            }}
                          >
                            <SelectTrigger className="w-full h-9 text-xs font-medium bg-background">
                              <SelectValue placeholder="Select provider" />
                            </SelectTrigger>
                            <SelectContent>
                              {(availableProviders.length
                                ? availableProviders
                                : Object.keys(AI_MODEL_MAP).map((name) => ({
                                  name,
                                  defaultModel: AI_MODEL_MAP[name][0],
                                }))
                              ).map((p) => (
                                <SelectItem key={p.name} value={p.name}>
                                  <span className="flex items-center gap-2">
                                    {getProviderIcon(p.name) ? (
                                      <img
                                        src={getProviderIcon(p.name)}
                                        alt=""
                                        className="h-4 w-4 rounded-sm object-contain"
                                      />
                                    ) : (
                                      <div className="h-4 w-4 rounded-sm bg-muted flex items-center justify-center text-[8px] font-bold">
                                        {p.name.substring(0, 2).toUpperCase()}
                                      </div>
                                    )}
                                    <span className="capitalize">
                                      {p.name === "vertexai"
                                        ? "Vertex AI"
                                        : p.name === "bedrock"
                                          ? "AWS Bedrock"
                                          : p.name}
                                    </span>
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                            Chat Model
                          </p>
                          <Select
                            key={aiProvider}
                            value={aiModel || ""}
                            onValueChange={setAiModel}
                          >
                            <SelectTrigger className="w-full h-9 text-xs font-medium bg-background">
                              <SelectValue placeholder="Select model" />
                            </SelectTrigger>
                            <SelectContent>
                              {(AI_MODEL_MAP[aiProvider] || []).map((m) => (
                                <SelectItem key={m} value={m}>
                                  <span className="flex items-center gap-2">
                                    {getProviderIcon(
                                      aiProvider || "bedrock",
                                    ) ? (
                                      <img
                                        src={getProviderIcon(
                                          aiProvider || "bedrock",
                                        )}
                                        alt=""
                                        className="h-4 w-4 rounded-sm object-contain"
                                      />
                                    ) : null}
                                    <span>{m}</span>
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                            API Key
                          </p>
                          <Input
                            type="password"
                            name="custom_ai_api_key"
                            id="custom_ai_api_key"
                            autoComplete="new-password"
                            placeholder="Paste your API key"
                            className="h-9 text-xs font-mono"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          className="h-8 px-4 text-xs font-semibold rounded-md"
                          disabled={apiKey === ""}
                        >
                          Save AI Settings
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-border/50">
                    <CardHeader className="pb-3 pt-5">
                      <CardTitle className="text-base font-bold flex items-center gap-2">
                        <Database className="h-4 w-4 text-primary" />
                        Embedding configuration
                      </CardTitle>
                      <CardDescription className="text-[11px]">
                        Choose your own embedding models for advanced retrieval.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-2">
                      <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="space-y-1.5">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                            Embedding Provider
                          </p>
                          <Select
                            defaultValue={embeddingProvider || undefined}
                            onValueChange={(v) => {
                              setEmbeddingProvider(v);
                              if (EMBEDDING_MODEL_MAP[v]) {
                                setEmbeddingModel(EMBEDDING_MODEL_MAP[v][0]);
                              }
                            }}
                          >
                            <SelectTrigger className="w-full h-9 text-xs font-medium bg-background">
                              <SelectValue placeholder="Select provider" />
                            </SelectTrigger>
                            <SelectContent>
                              {(availableEmbeddingProviders.length
                                ? availableEmbeddingProviders
                                : Object.keys(EMBEDDING_MODEL_MAP).map(
                                  (name) => ({
                                    name,
                                    defaultModel:
                                      EMBEDDING_MODEL_MAP[name][0],
                                  }),
                                )
                              ).map((p) => (
                                <SelectItem key={p.name} value={p.name}>
                                  <span className="flex items-center gap-2">
                                    {getProviderIcon(p.name) ? (
                                      <img
                                        src={getProviderIcon(p.name)}
                                        alt=""
                                        className="h-4 w-4 rounded-sm object-contain"
                                      />
                                    ) : (
                                      <div className="h-4 w-4 rounded-sm bg-muted flex items-center justify-center text-[8px] font-bold">
                                        {p.name.substring(0, 2).toUpperCase()}
                                      </div>
                                    )}
                                    <span className="capitalize">
                                      {p.name === "vertexai"
                                        ? "Vertex AI"
                                        : p.name === "bedrock"
                                          ? "AWS Bedrock"
                                          : p.name}
                                    </span>
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                            Embedding Model
                          </p>
                          <Select
                            key={embeddingProvider}
                            value={embeddingModel || ""}
                            onValueChange={setEmbeddingModel}
                          >
                            <SelectTrigger className="w-full h-9 text-xs font-medium bg-background">
                              <SelectValue placeholder="Select embedding model" />
                            </SelectTrigger>
                            <SelectContent>
                              {(
                                EMBEDDING_MODEL_MAP[embeddingProvider] || []
                              ).map((m) => (
                                <SelectItem key={m} value={m}>
                                  <span className="flex items-center gap-2">
                                    {getProviderIcon(
                                      embeddingProvider || "bedrock",
                                    ) ? (
                                      <img
                                        src={getProviderIcon(
                                          embeddingProvider || "bedrock",
                                        )}
                                        alt=""
                                        className="h-4 w-4 rounded-sm object-contain"
                                      />
                                    ) : null}
                                    <span>{m}</span>
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-4 text-xs font-semibold rounded-md shadow-sm"
                        >
                          Test Connectivity
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 px-4 text-xs font-semibold rounded-md"
                          disabled={!embeddingProvider || !embeddingModel}
                        >
                          Save Embedding Settings
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      </motion.div>
    </motion.div>
  );
};

export default Settings;
