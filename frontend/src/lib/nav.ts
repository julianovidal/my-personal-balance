import {
  ArrowLeftRightIcon,
  LayoutDashboardIcon,
  SparklesIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react"

export type NavItem = {
  title: string
  url: string
  icon: LucideIcon
}

export const NAV_ITEMS: NavItem[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboardIcon },
  { title: "Accounts", url: "/accounts", icon: WalletIcon },
  { title: "Transactions", url: "/transactions", icon: ArrowLeftRightIcon },
  { title: "Classifier", url: "/classifier", icon: SparklesIcon },
]

export function isNavItemActive(url: string, pathname: string) {
  return url === "/" ? pathname === "/" : pathname.startsWith(url)
}

export function getPageTitle(pathname: string) {
  if (pathname.startsWith("/profile")) return "Profile"
  return NAV_ITEMS.find((item) => isNavItemActive(item.url, pathname))?.title ?? ""
}

export function getInitials(name: string, email: string) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return email.charAt(0).toUpperCase()
  return words
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase()
}
