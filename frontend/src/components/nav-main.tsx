import { Link, useLocation } from "react-router-dom"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { NAV_ITEMS, isNavItemActive } from "@/lib/nav"

export function NavMain() {
  const { pathname } = useLocation()
  const { setOpenMobile } = useSidebar()

  return (
    <nav aria-label="Main">
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            {NAV_ITEMS.map((item) => (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton
                  tooltip={item.title}
                  isActive={isNavItemActive(item.url, pathname)}
                  // In dark mode the preset's blue sidebar-primary marks the active page.
                  className="dark:data-active:bg-sidebar-primary dark:data-active:text-sidebar-primary-foreground"
                  render={<Link to={item.url} />}
                  onClick={() => setOpenMobile(false)}
                >
                  <item.icon />
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </nav>
  )
}
