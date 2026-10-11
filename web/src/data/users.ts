export interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  lastLogin: string;
}

export const MOCK_USERS: UserData[] = [
  {
    id: "1",
    name: "John Doe",
    email: "john@company.com",
    role: "Admin",
    status: "active",
    lastLogin: "Today",
  },
  {
    id: "2",
    name: "Sarah Chen",
    email: "sarah@company.com",
    role: "Editor",
    status: "active",
    lastLogin: "Today",
  },
  {
    id: "3",
    name: "Mike Johnson",
    email: "mike@company.com",
    role: "Editor",
    status: "active",
    lastLogin: "Yesterday",
  },
  {
    id: "4",
    name: "Lisa Park",
    email: "lisa@company.com",
    role: "Viewer",
    status: "active",
    lastLogin: "3 days ago",
  },
  {
    id: "5",
    name: "James Wilson",
    email: "james@company.com",
    role: "Editor",
    status: "invited",
    lastLogin: "Never",
  },
];
